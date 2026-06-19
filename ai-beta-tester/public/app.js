const socket = io();
let sessionId = null;
let report = null;
let actionCount = 0;
const bugCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
let pageCount = 0;
let currentMode = 'url'; // 'url' or 'zip'

const MODEL_HINTS = {
  openai:     'Default: gpt-4o — also supports gpt-4-turbo, gpt-4o-mini',
  anthropic:  'Default: claude-3-5-sonnet-20241022 — also supports claude-3-opus-20240229',
  groq:       'Zippy uses llama-3.3-70b-versatile by default — also supports mixtral-8x7b-32768, gemma2-9b-it',
  openrouter: 'Default: openai/gpt-4o — any OpenRouter model slug works',
};

const TOOL_NAMES = {
  // Core browser
  navigate: 'Navigate', get_page_content: 'Read page', click: 'Click element',
  click_by_text: 'Click by text', fill_input: 'Fill input', screenshot: 'Screenshot',
  scroll: 'Scroll', go_back: 'Go back', check_broken_images: 'Check images',
  check_accessibility: 'Check accessibility', log_bug: 'Log bug', set_summary: 'Write summary',
  // New browser tools
  login: '🔐 Login to site', find_api_keys: '🔑 Find API keys',
  hover: 'Hover element', select_option: 'Select option',
  wait_for: 'Wait for element', execute_js: 'Run JavaScript',
  check_links: '🔗 Check links', check_performance: '⚡ Performance check',
  check_mobile: '📱 Mobile check', check_seo: '🔍 SEO audit',
  get_element_text: 'Get element text', find_text_on_page: 'Find text',
  check_cookies: '🍪 Check cookies',
  // GitHub
  github_list_repos: 'GitHub: list repos', github_list_files: 'GitHub: list files',
  github_read_file: 'GitHub: read file', github_write_file: 'GitHub: write fix',
  github_create_branch: 'GitHub: create branch', github_create_pr: 'GitHub: open PR',
  github_merge_pr: 'GitHub: merge PR', github_list_prs: 'GitHub: list PRs',
  github_search_code: 'GitHub: search code', github_create_issue: 'GitHub: create issue',
  github_get_commits: 'GitHub: get commits',
  // Railway
  railway_list_projects: 'Railway: list projects', railway_get_deployments: 'Railway: deployments',
  railway_get_logs: 'Railway: get logs', railway_redeploy: 'Railway: redeploy',
  railway_get_services: 'Railway: get services', railway_mcp_discover: 'Railway: discover tools',
  railway_mcp_execute: 'Railway: execute tool',
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const urlInput        = document.getElementById('url');
const zipFileInput    = document.getElementById('zipFile');
const zipDrop         = document.getElementById('zipDrop');
const zipDropInner    = document.getElementById('zipDropInner');
const zipLabel        = document.getElementById('zipLabel');
const urlField        = document.getElementById('urlField');
const zipField        = document.getElementById('zipField');
const tabUrl          = document.getElementById('tabUrl');
const tabZip          = document.getElementById('tabZip');
const providerSel     = document.getElementById('provider');
const modelInput      = document.getElementById('model');
const apiKeyInput     = document.getElementById('apiKey');
const toggleKeyBtn    = document.getElementById('toggleKey');
const testDepthSel    = document.getElementById('testDepth');
const instructionsTA  = document.getElementById('instructions');
const githubTokenInput  = document.getElementById('githubToken');
const railwayTokenInput = document.getElementById('railwayToken');
const toggleGithubBtn   = document.getElementById('toggleGithub');
const toggleRailwayBtn  = document.getElementById('toggleRailway');
const loginEmailInput   = document.getElementById('loginEmail');
const loginPasswordInput= document.getElementById('loginPassword');
const toggleLoginPassBtn= document.getElementById('toggleLoginPass');
const startBtn        = document.getElementById('startBtn');
const modelHints      = document.getElementById('modelHints');
const configPanel     = document.getElementById('configPanel');
const sessionPanel    = document.getElementById('sessionPanel');
const sessionTitle    = document.getElementById('sessionTitle');
const sessionMeta     = document.getElementById('sessionMeta');
const stopBtn         = document.getElementById('stopBtn');
const newTestBtn      = document.getElementById('newTestBtn');
const newTestBtn2     = document.getElementById('newTestBtn2');
const pulseDot        = document.getElementById('pulseDot');
const logStatus       = document.getElementById('logStatus');
const logScroll       = document.getElementById('logScroll');
const bugsList        = document.getElementById('bugsList');
const bugCount        = document.getElementById('bugCount');
const exportBtn           = document.getElementById('exportBtn');
const exportHtmlBtn       = document.getElementById('exportHtmlBtn');
const exportJsonBtn2      = document.getElementById('exportJsonBtn2');
const exportProjectLogBtn = document.getElementById('exportProjectLogBtn');
const summaryPanel    = document.getElementById('summaryPanel');
const summaryText     = document.getElementById('summaryText');
const statActions     = document.getElementById('statActions');
const statCritical    = document.getElementById('statCritical');
const statHigh        = document.getElementById('statHigh');
const statMedium      = document.getElementById('statMedium');
const statLow         = document.getElementById('statLow');
const statPages       = document.getElementById('statPages');

// ── Mode tabs ─────────────────────────────────────────────────────────────────
tabUrl.addEventListener('click', () => setMode('url'));
tabZip.addEventListener('click', () => setMode('zip'));

function setMode(mode) {
  currentMode = mode;
  tabUrl.classList.toggle('active', mode === 'url');
  tabZip.classList.toggle('active', mode === 'zip');
  urlField.classList.toggle('hidden', mode !== 'url');
  zipField.classList.toggle('hidden', mode !== 'zip');
}

// ── ZIP file selection ────────────────────────────────────────────────────────
zipDrop.addEventListener('click', () => zipFileInput.click());
zipDrop.addEventListener('dragover', (e) => { e.preventDefault(); zipDrop.classList.add('drag-over'); });
zipDrop.addEventListener('dragleave', () => zipDrop.classList.remove('drag-over'));
zipDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  zipDrop.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setZipFile(file);
});
zipFileInput.addEventListener('change', () => {
  if (zipFileInput.files[0]) setZipFile(zipFileInput.files[0]);
});

function setZipFile(file) {
  zipLabel.textContent = `✓ ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
  zipDrop.classList.add('has-file');
}

// ── Provider / model hints ───────────────────────────────────────────────────
providerSel.addEventListener('change', () => {
  modelHints.textContent = MODEL_HINTS[providerSel.value] || '';
  modelInput.placeholder = getModelPlaceholder(providerSel.value);
});
modelHints.textContent = MODEL_HINTS[providerSel.value];

function getModelPlaceholder(p) {
  return { openai: 'gpt-4o', anthropic: 'claude-3-5-sonnet-20241022', groq: 'llama-3.3-70b-versatile', openrouter: 'openai/gpt-4o' }[p] || '';
}
modelInput.placeholder = getModelPlaceholder(providerSel.value);

// ── Token visibility toggles ─────────────────────────────────────────────────
toggleKeyBtn.addEventListener('click', () => { apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password'; });
toggleGithubBtn.addEventListener('click', () => { githubTokenInput.type = githubTokenInput.type === 'password' ? 'text' : 'password'; });
toggleRailwayBtn.addEventListener('click', () => { railwayTokenInput.type = railwayTokenInput.type === 'password' ? 'text' : 'password'; });
toggleLoginPassBtn.addEventListener('click', () => { loginPasswordInput.type = loginPasswordInput.type === 'password' ? 'text' : 'password'; });

// ── Start test ────────────────────────────────────────────────────────────────
startBtn.addEventListener('click', async () => {
  const provider     = providerSel.value;
  const apiKey       = apiKeyInput.value.trim();
  const model        = modelInput.value.trim();
  const testDepth    = testDepthSel.value;
  const instructions = instructionsTA.value.trim();
  const githubToken  = githubTokenInput.value.trim();
  const railwayToken = railwayTokenInput.value.trim();
  const loginEmail   = loginEmailInput.value.trim();
  const loginPassword= loginPasswordInput.value;

  if (!apiKey) return showError('Please enter your API key.');

  if (currentMode === 'url') {
    const url = urlInput.value.trim();
    if (!url) return showError('Please enter a target URL.');
    if (!url.startsWith('http')) return showError('URL must start with http:// or https://');

    setStarting();
    try {
      const res = await fetch('/api/start-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, provider, apiKey, model, testDepth, instructions, githubToken, railwayToken, loginEmail, loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start');
      sessionId = data.sessionId;
      socket.emit('join-session', sessionId);
      showSession(url, provider, model, testDepth);
    } catch (err) {
      showError('Error: ' + err.message);
      resetStartBtn();
    }

  } else {
    const file = zipFileInput.files[0];
    if (!file) return showError('Please select a ZIP file.');

    setStarting();
    const form = new FormData();
    form.append('zip', file);
    form.append('provider', provider);
    form.append('apiKey', apiKey);
    form.append('model', model);
    form.append('testDepth', testDepth);
    form.append('instructions', instructions);
    form.append('githubToken', githubToken);
    form.append('railwayToken', railwayToken);
    form.append('loginEmail', loginEmail);
    form.append('loginPassword', loginPassword);

    try {
      const res = await fetch('/api/start-test-zip', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start');
      sessionId = data.sessionId;
      socket.emit('join-session', sessionId);
      showSession(`ZIP: ${file.name}`, provider, model, testDepth);
    } catch (err) {
      showError('Error: ' + err.message);
      resetStartBtn();
    }
  }
});

function setStarting() {
  startBtn.disabled = true;
  startBtn.textContent = 'Starting…';
}

function resetStartBtn() {
  startBtn.disabled = false;
  startBtn.innerHTML = `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polygon points="5,3 19,12 5,21"/></svg> Start ZippyFixer`;
}

function showError(msg) { alert(msg); }

const PROVIDER_DISPLAY = { groq: 'Zippy' };

function showSession(target, provider, model, depth) {
  configPanel.classList.add('hidden');
  sessionPanel.classList.remove('hidden');
  sessionTitle.textContent = `Testing: ${target}`;
  const displayName = PROVIDER_DISPLAY[provider] || provider.toUpperCase();
  sessionMeta.textContent = `${displayName}${model ? ' · ' + model : ''} · ${depth} depth`;
  resetStats();
  clearLog();
  clearBugs();
  summaryPanel.classList.add('hidden');
  stopBtn.classList.remove('hidden');
  newTestBtn.classList.add('hidden');
  newTestBtn2.classList.add('hidden');
  exportBtn.classList.add('hidden');
  exportHtmlBtn.classList.add('hidden');
  exportJsonBtn2.classList.add('hidden');
  exportProjectLogBtn.classList.add('hidden');
}

function resetStats() {
  actionCount = 0;
  Object.keys(bugCounts).forEach(k => bugCounts[k] = 0);
  pageCount = 0;
  statActions.textContent = statCritical.textContent = statHigh.textContent =
    statMedium.textContent = statLow.textContent = statPages.textContent = '0';
  bugCount.textContent = '0';
  pulseDot.className = 'pulse-dot';
}

function clearLog()  { logScroll.innerHTML = ''; }
function clearBugs() { bugsList.innerHTML = '<div class="empty-bugs">No bugs found yet…</div>'; }

// ── Log helpers ───────────────────────────────────────────────────────────────
function addLog(msg, type = 'status', icon = '·') {
  const now = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = document.createElement('div');
  entry.className = `log-entry type-${type}`;
  entry.innerHTML = `<span class="log-time">${now}</span><span class="log-icon">${icon}</span><span class="log-msg">${escHtml(msg)}</span>`;
  logScroll.appendChild(entry);
  logScroll.scrollTop = logScroll.scrollHeight;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Socket events ─────────────────────────────────────────────────────────────
socket.on('test-started', ({ url }) => {
  addLog(`Session started → ${url}`, 'status', '🚀');
  logStatus.textContent = 'Running…';
});

socket.on('status', ({ message }) => {
  addLog(message, 'status', '⚙');
  logStatus.textContent = message.slice(0, 70);
});

socket.on('navigated', ({ url, title }) => {
  pageCount++;
  statPages.textContent = pageCount;
  addLog(`Navigated → ${title || url}`, 'nav', '🌐');
  actionCount++;
  statActions.textContent = actionCount;
});

socket.on('action', ({ type, description, text, selector }) => {
  const label = description || text || selector || type;
  addLog(`${type === 'fill' ? 'Filled input' : 'Clicked'}: ${label}`, 'action', '👆');
  actionCount++;
  statActions.textContent = actionCount;
});

socket.on('tool-call', ({ name, args }) => {
  const friendly = TOOL_NAMES[name] || name;
  addLog(`${friendly}${args ? ': ' + String(args).slice(0, 60) : ''}`, 'action', '🔧');
  actionCount++;
  statActions.textContent = actionCount;
});

socket.on('ai-thinking', ({ iteration }) => {
  logStatus.textContent = `AI working… (step ${iteration})`;
});

socket.on('bug-logged', (bug) => {
  addLog(`BUG [${bug.severity.toUpperCase()}] ${bug.title}`, bug.severity === 'critical' ? 'critical' : 'bug', '🐛');
  if (bugCounts[bug.severity] !== undefined) {
    bugCounts[bug.severity]++;
    const el = document.getElementById(`stat${capitalize(bug.severity)}`);
    if (el) el.textContent = bugCounts[bug.severity];
  }
  appendBugCard(bug);
  bugCount.textContent = Object.values(bugCounts).reduce((a, b) => a + b, 0);
  exportBtn.classList.remove('hidden');
});

socket.on('github-pr', ({ url, title }) => {
  addLog(`PR opened: "${title}" → ${url}`, 'action', '🐙');
});

socket.on('github-merged', ({ prNumber, repo }) => {
  addLog(`PR #${prNumber} merged into ${repo}`, 'action', '✅');
});

socket.on('github-issue', ({ url, title }) => {
  addLog(`Issue created: "${title}" → ${url}`, 'action', '📌');
});

socket.on('console-error', ({ text, url }) => {
  addLog(`Console error at ${url}: ${text.slice(0, 100)}`, 'error', '⚠');
});

socket.on('page-error', ({ message }) => {
  addLog(`JS Error: ${message.slice(0, 100)}`, 'critical', '💥');
});

socket.on('http-error', ({ url, status }) => {
  addLog(`HTTP ${status} — ${String(url).slice(0, 80)}`, 'error', '🔴');
});

socket.on('screenshot', ({ name }) => {
  addLog(`Screenshot: "${name}"`, 'status', '📸');
});

socket.on('summary-set', ({ summary }) => {
  summaryText.textContent = summary;
  summaryPanel.classList.remove('hidden');
  addLog('Test summary written.', 'status', '📋');
});

socket.on('test-complete', ({ report: r }) => {
  report = r;
  pulseDot.className = 'pulse-dot done';
  logStatus.textContent = `Done — ${r.totalBugs} bug${r.totalBugs !== 1 ? 's' : ''} in ${r.duration}`;
  addLog(`✅ Complete in ${r.duration}. ${r.totalBugs} total bugs.`, 'status', '✅');
  stopBtn.classList.add('hidden');
  newTestBtn.classList.remove('hidden');
  // Always show the summary panel so action buttons are visible even if AI skipped set_summary
  summaryPanel.classList.remove('hidden');
  newTestBtn2.classList.remove('hidden');
  exportHtmlBtn.classList.remove('hidden');
  exportJsonBtn2.classList.remove('hidden');
  exportProjectLogBtn.classList.remove('hidden');
});

socket.on('test-error', ({ message }) => {
  pulseDot.className = 'pulse-dot error';
  logStatus.textContent = 'Error: ' + message.slice(0, 60);
  addLog('Error: ' + message, 'error', '❌');
  stopBtn.classList.add('hidden');
  newTestBtn.classList.remove('hidden');
});

// ── Bug card ──────────────────────────────────────────────────────────────────
function appendBugCard(bug) {
  const empty = bugsList.querySelector('.empty-bugs');
  if (empty) empty.remove();
  const card = document.createElement('div');
  card.className = `bug-card sev-${bug.severity}`;
  card.innerHTML = `
    <div class="bug-top">
      <span class="bug-id">${bug.id}</span>
      <span class="sev-badge ${bug.severity}">${bug.severity}</span>
      <span class="cat-badge">${bug.category}</span>
    </div>
    <div class="bug-title">${escHtml(bug.title)}</div>
    <div class="bug-desc">${escHtml(bug.description)}</div>
    ${bug.url ? `<div class="bug-url">${escHtml(bug.url)}</div>` : ''}
  `;
  bugsList.appendChild(card);
  bugsList.scrollTop = bugsList.scrollHeight;
}

// ── Stop / new test ───────────────────────────────────────────────────────────
stopBtn.addEventListener('click', async () => {
  if (!sessionId) return;
  await fetch(`/api/stop-test/${sessionId}`, { method: 'POST' });
  addLog('Test stopped by user.', 'status', '⏹');
  stopBtn.classList.add('hidden');
  newTestBtn.classList.remove('hidden');
  pulseDot.className = 'pulse-dot error';
  logStatus.textContent = 'Stopped';
});

[newTestBtn, newTestBtn2].forEach(btn => btn.addEventListener('click', () => {
  sessionPanel.classList.add('hidden');
  configPanel.classList.remove('hidden');
  sessionId = null;
  report = null;
  resetStartBtn();
}));

// ── Export ────────────────────────────────────────────────────────────────────
exportBtn.addEventListener('click', exportJson);
exportJsonBtn2.addEventListener('click', exportJson);

exportProjectLogBtn.addEventListener('click', () => {
  if (!sessionId) return;
  const a = document.createElement('a');
  a.href = `/api/project-log/${sessionId}`;
  a.download = `zippyfixer-${sessionId}.md`;
  a.click();
});

socket.on('project-log-ready', () => {
  exportProjectLogBtn.classList.remove('hidden');
  addLog('📋 Project log saved — ready to download.', 'status', '📋');
});

function exportJson() {
  if (!report && !sessionId) return;
  const download = (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `zippyfixer-report-${sessionId || Date.now()}.json`;
    a.click();
  };
  if (report) { download(report); return; }
  fetch(`/api/report/${sessionId}`).then(r => r.json()).then(download);
}

exportHtmlBtn.addEventListener('click', () => {
  if (!report) return;
  const blob = new Blob([generateHtmlReport(report)], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `zippyfixer-report-${sessionId}.html`;
  a.click();
});

// ── HTML report generator ─────────────────────────────────────────────────────
function generateHtmlReport(r) {
  const sevColor = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#3b82f6' };

  const bugsHtml = r.bugs.map(b => `
    <div style="border:1px solid #2e3248;border-left:4px solid ${sevColor[b.severity]||'#6366f1'};border-radius:8px;padding:14px 16px;margin-bottom:10px;background:#1a1d27;">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
        <span style="font-size:11px;color:#8b90a8;font-family:monospace;">${b.id}</span>
        <span style="background:${sevColor[b.severity]}22;color:${sevColor[b.severity]};font-size:11px;padding:2px 8px;border-radius:4px;font-weight:700;text-transform:uppercase;">${b.severity}</span>
        <span style="background:#22263a;color:#8b90a8;font-size:11px;padding:2px 8px;border-radius:4px;">${b.category}</span>
      </div>
      <div style="font-weight:600;font-size:14px;color:#e2e5f0;margin-bottom:4px;">${esc(b.title)}</div>
      <div style="font-size:13px;color:#8b90a8;line-height:1.5;margin-bottom:4px;">${esc(b.description)}</div>
      ${b.url ? `<div style="font-size:11px;color:#4a4f6a;font-family:monospace;">${esc(b.url)}</div>` : ''}
    </div>`).join('');

  const pagesHtml = (r.pagesVisited || []).map(p => `
    <div style="padding:6px 0;border-bottom:1px solid #2e3248;font-size:13px;">
      <span style="color:#8b90a8;">${p.title || 'Untitled'}</span>
      <span style="color:#4a4f6a;font-family:monospace;margin-left:8px;font-size:11px;">${p.url}</span>
    </div>`).join('');

  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>ZippyFixer Report</title>
<style>
body{background:#0f1117;color:#e2e5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;}
.wrap{max-width:900px;margin:0 auto;padding:40px 24px;}
h1{font-size:26px;font-weight:800;color:#fff;margin-bottom:4px;}
.logo{color:#00ff88;}.meta{color:#8b90a8;font-size:13px;margin-bottom:30px;}
h2{font-size:17px;font-weight:700;color:#fff;margin:28px 0 14px;}
.stats{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:30px;}
.stat{background:#1a1d27;border:1px solid #2e3248;border-radius:10px;padding:16px 10px;text-align:center;}
.sv{font-size:24px;font-weight:800;color:#fff;}.sl{font-size:11px;color:#8b90a8;text-transform:uppercase;margin-top:4px;}
.summary{background:#1a1d27;border:1px solid #2e3248;border-radius:10px;padding:18px 20px;font-size:13px;color:#8b90a8;line-height:1.7;white-space:pre-wrap;margin-bottom:20px;}
</style></head>
<body><div class="wrap">
<h1><span class="logo">Zippy</span>Fixer — Bug Report</h1>
<div class="meta">Session: ${esc(r.sessionId)} &nbsp;·&nbsp; ${new Date(r.startTime).toLocaleString()} &nbsp;·&nbsp; Duration: ${r.duration}</div>
<div class="stats">
  <div class="stat"><div class="sv">${r.totalBugs}</div><div class="sl">Total Bugs</div></div>
  <div class="stat" style="border-color:rgba(239,68,68,0.3)"><div class="sv" style="color:#ef4444">${r.bySeverity?.critical||0}</div><div class="sl">Critical</div></div>
  <div class="stat" style="border-color:rgba(249,115,22,0.3)"><div class="sv" style="color:#f97316">${r.bySeverity?.high||0}</div><div class="sl">High</div></div>
  <div class="stat" style="border-color:rgba(234,179,8,0.3)"><div class="sv" style="color:#eab308">${r.bySeverity?.medium||0}</div><div class="sl">Medium</div></div>
  <div class="stat" style="border-color:rgba(34,197,94,0.3)"><div class="sv" style="color:#22c55e">${r.bySeverity?.low||0}</div><div class="sl">Low</div></div>
  <div class="stat"><div class="sv">${(r.pagesVisited||[]).length}</div><div class="sl">Pages</div></div>
</div>
${r.summary ? `<h2>Summary</h2><div class="summary">${esc(r.summary)}</div>` : ''}
<h2>Bugs (${r.totalBugs})</h2>
${r.bugs?.length ? bugsHtml : '<p style="color:#8b90a8">No bugs found.</p>'}
<h2>Pages Visited (${(r.pagesVisited||[]).length})</h2>
${pagesHtml || '<p style="color:#8b90a8">None recorded.</p>'}
<p style="margin-top:40px;color:#4a4f6a;font-size:11px;text-align:center;">Generated by ZippyFixer — virellestudios.com</p>
</div></body></html>`;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
