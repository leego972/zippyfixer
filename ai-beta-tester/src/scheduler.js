/**
 * Scheduled monitoring for ReviewGuard.
 * Stores cron schedules, runs tests automatically, sends email/webhook reports.
 */

const { v4: uuidv4 } = require('uuid');
const { notifySlack, notifyDiscord, sendEmailReport } = require('./notifications');

class Scheduler {
  constructor(runTest) {
    this.runTest = runTest;
    this.schedules = new Map();
    this.cron = null;
  }

  _loadCron() {
    if (!this.cron) this.cron = require('node-cron');
    return this.cron;
  }

  add({ url, provider, apiKey, model, testDepth, cronExpression, notify }) {
    const cron = this._loadCron();
    if (!cron.validate(cronExpression)) {
      return { error: `Invalid cron expression: "${cronExpression}". Example: "0 9 * * *" runs daily at 9am.` };
    }

    const id = uuidv4();
    const task = cron.schedule(cronExpression, async () => {
      const { BugLogger } = require('./bug-logger');
      const sessionId = uuidv4();
      const logger = new BugLogger(sessionId);
      const emit = () => {};

      try {
        await this.runTest({ url, provider, apiKey, model, testDepth, sessionId, logger, emit, isStopped: () => false });
        logger.saveProjectLog();
        const report = logger.getReport();
        if (notify?.slackWebhook) await notifySlack(notify.slackWebhook, report).catch(() => {});
        if (notify?.discordWebhook) await notifyDiscord(notify.discordWebhook, report).catch(() => {});
        if (notify?.email) await sendEmailReport(notify.email, report).catch(() => {});
      } catch (err) {
        console.error(`[Scheduler] Test failed for ${url}:`, err.message);
      }
    });

    this.schedules.set(id, {
      id, url, provider, model, testDepth, cronExpression,
      notify: { slackWebhook: notify?.slackWebhook, discordWebhook: notify?.discordWebhook, email: notify?.email?.to },
      task,
      createdAt: new Date().toISOString(),
      nextRun: null,
    });

    return { id, url, cronExpression, message: `Schedule created — will run: ${cronExpression}` };
  }

  remove(id) {
    const schedule = this.schedules.get(id);
    if (!schedule) return { error: 'Schedule not found' };
    schedule.task.stop();
    this.schedules.delete(id);
    return { ok: true, id };
  }

  list() {
    return [...this.schedules.values()].map(({ id, url, provider, model, testDepth, cronExpression, notify, createdAt }) => ({
      id, url, provider, model, testDepth, cronExpression, notify, createdAt,
    }));
  }
}

module.exports = { Scheduler };
