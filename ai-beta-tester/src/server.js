const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { runBetaTest } = require('./tester');
const { BugLogger } = require('./bug-logger');
const { ZipAppRunner } = require('./zip-runner');
const { Scheduler } = require('./scheduler');
const { notifySlack, notifyDiscord, sendEmailReport } = require('./notifications');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Multer: accept ZIP files up to 500MB in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/zip' ||
                file.mimetype === 'application/x-zip-compressed' ||
                file.originalname.endsWith('.zip');
    cb(ok ? null : new Error('Only ZIP files are accepted'), ok);
  },
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const activeSessions = new Map();
const scheduler = new Scheduler(runBetaTest);

// ── Helper: fire notifications after a test completes ─────────────────────
async function fireNotifications(notify, report) {
  if (!notify) return;
  const jobs = [];
  if (notify.slackWebhook) jobs.push(notifySlack(notify.slackWebhook, report).catch(() => {}));
  if (notify.discordWebhook) jobs.push(notifyDiscord(notify.discordWebhook, report).catch(() => {}));
  if (notify.email?.smtpHost && notify.email?.to) jobs.push(sendEmailReport(notify.email, report).catch(() => {}));
  await Promise.all(jobs);
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Start test by URL ──────────────────────────────────────────────────────
app.post('/api/start-test', async (req, res) => {
  const {
    url, provider, apiKey, model, testDepth, instructions,
    githubToken, railwayToken, vercelToken,
    loginEmail, loginPassword,
    slackWebhook, discordWebhook, emailTo, smtpHost, smtpPort, smtpUser, smtpPass,
  } = req.body;

  if (!url || !provider || !apiKey) {
    return res.status(400).json({ error: 'url, provider, and apiKey are required' });
  }

  const sessionId = uuidv4();
  const logger = new BugLogger(sessionId);
  activeSessions.set(sessionId, { status: 'running', logger, stopped: false });
  res.json({ sessionId });

  const emit = (event, data) => io.to(sessionId).emit(event, data);
  const notify = {
    slackWebhook: slackWebhook || null,
    discordWebhook: discordWebhook || null,
    email: emailTo && smtpHost ? { to: emailTo, smtpHost, smtpPort: smtpPort || 587, smtpUser, smtpPass } : null,
  };

  runBetaTest({
    url, provider, apiKey, model, testDepth, instructions,
    tokens: { github: githubToken || '', railway: railwayToken || '', vercel: vercelToken || '' },
    loginEmail: loginEmail || '', loginPassword: loginPassword || '',
    sessionId, logger, emit,
    isStopped: () => activeSessions.get(sessionId)?.stopped,
  })
    .then(async () => {
      if (activeSessions.get(sessionId)) activeSessions.get(sessionId).status = 'complete';
      logger.saveProjectLog();
      const report = logger.getReport();
      emit('test-complete', { report });
      emit('project-log-ready', { sessionId });
      await fireNotifications(notify, report);
    })
    .catch(async (err) => {
      if (activeSessions.get(sessionId)) activeSessions.get(sessionId).status = 'error';
      logger.saveProjectLog();
      emit('test-error', { message: err.message });
      await fireNotifications(notify, logger.getReport());
    });
});

// ── Start test by ZIP upload ───────────────────────────────────────────────
app.post('/api/start-test-zip', upload.single('zip'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ZIP file is required' });

  const {
    provider, apiKey, model, testDepth, instructions,
    githubToken, railwayToken, vercelToken,
    loginEmail, loginPassword,
    slackWebhook, discordWebhook, emailTo, smtpHost, smtpPort, smtpUser, smtpPass,
  } = req.body;

  if (!provider || !apiKey) {
    return res.status(400).json({ error: 'provider and apiKey are required' });
  }

  const sessionId = uuidv4();
  const logger = new BugLogger(sessionId);
  const zipRunner = new ZipAppRunner();
  activeSessions.set(sessionId, { status: 'running', logger, stopped: false, zipRunner });
  res.json({ sessionId });

  const emit = (event, data) => io.to(sessionId).emit(event, data);
  const notify = {
    slackWebhook: slackWebhook || null,
    discordWebhook: discordWebhook || null,
    email: emailTo && smtpHost ? { to: emailTo, smtpHost, smtpPort: smtpPort || 587, smtpUser, smtpPass } : null,
  };

  try {
    const url = await zipRunner.start(req.file.buffer, emit);
    await runBetaTest({
      url, provider, apiKey, model, testDepth, instructions,
      tokens: { github: githubToken || '', railway: railwayToken || '', vercel: vercelToken || '' },
      loginEmail: loginEmail || '', loginPassword: loginPassword || '',
      sessionId, logger, emit,
      isStopped: () => activeSessions.get(sessionId)?.stopped,
    });
    if (activeSessions.get(sessionId)) activeSessions.get(sessionId).status = 'complete';
    logger.saveProjectLog();
    const report = logger.getReport();
    emit('test-complete', { report });
    emit('project-log-ready', { sessionId });
    await fireNotifications(notify, report);
  } catch (err) {
    if (activeSessions.get(sessionId)) activeSessions.get(sessionId).status = 'error';
    logger.saveProjectLog();
    emit('test-error', { message: err.message });
    await fireNotifications(notify, logger.getReport());
  } finally {
    await zipRunner.stop();
  }
});

// ── Report / stop / project log ────────────────────────────────────────────
app.get('/api/report/:sessionId', (req, res) => {
  const session = activeSessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session.logger.getReport());
});

app.get('/api/project-log/:sessionId', (req, res) => {
  const session = activeSessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const md = session.logger.generateProjectLog();
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="reviewguard-${req.params.sessionId}.md"`);
  res.send(md);
});

app.post('/api/stop-test/:sessionId', (req, res) => {
  const session = activeSessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  session.stopped = true;
  if (session.zipRunner) session.zipRunner.stop().catch(() => {});
  try { session.logger.saveProjectLog(); } catch { /* non-fatal */ }
  res.json({ ok: true });
});

// ── Scheduled Monitoring ───────────────────────────────────────────────────
app.post('/api/schedule', (req, res) => {
  const {
    url, provider, apiKey, model, testDepth, cronExpression,
    slackWebhook, discordWebhook, emailTo, smtpHost, smtpPort, smtpUser, smtpPass,
  } = req.body;

  if (!url || !provider || !apiKey || !cronExpression) {
    return res.status(400).json({ error: 'url, provider, apiKey, and cronExpression are required' });
  }

  const notify = {
    slackWebhook: slackWebhook || null,
    discordWebhook: discordWebhook || null,
    email: emailTo && smtpHost ? { to: emailTo, smtpHost, smtpPort: smtpPort || 587, smtpUser, smtpPass } : null,
  };

  const result = scheduler.add({ url, provider, apiKey, model, testDepth, cronExpression, notify });
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.get('/api/schedules', (req, res) => {
  res.json(scheduler.list());
});

app.delete('/api/schedule/:id', (req, res) => {
  const result = scheduler.remove(req.params.id);
  if (result.error) return res.status(404).json(result);
  res.json(result);
});

// ── Socket.io ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('join-session', (sessionId) => socket.join(sessionId));
});

const PORT = process.env.PORT || 3747;
server.listen(PORT, () => {
  console.log(`\n⚡ ReviewGuard is running!`);
  console.log(`👉 Open: http://localhost:${PORT}\n`);
});
