/**
 * Slack & Discord webhook notifications for ReviewGuard.
 * Sends a summary when a test finishes.
 */

async function notifySlack(webhookUrl, report) {
  const bugs = report.bugs || [];
  const critical = bugs.filter(b => b.severity === 'critical').length;
  const high = bugs.filter(b => b.severity === 'high').length;

  const color = critical > 0 ? '#ff4444' : high > 0 ? '#ff8800' : '#00ff88';
  const emoji = critical > 0 ? '🔴' : high > 0 ? '🟡' : '🟢';

  const payload = {
    attachments: [{
      color,
      title: `${emoji} ReviewGuard Test Complete — ${report.url || 'Unknown URL'}`,
      text: report.summary || 'Test finished.',
      fields: [
        { title: 'Total Bugs', value: String(bugs.length), short: true },
        { title: 'Critical', value: String(critical), short: true },
        { title: 'High', value: String(high), short: true },
        { title: 'Pages Tested', value: String(report.pagesVisited?.length || 1), short: true },
      ],
      footer: 'ReviewGuard',
      ts: Math.floor(Date.now() / 1000),
    }],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status };
}

async function notifyDiscord(webhookUrl, report) {
  const bugs = report.bugs || [];
  const critical = bugs.filter(b => b.severity === 'critical').length;
  const high = bugs.filter(b => b.severity === 'high').length;
  const emoji = critical > 0 ? '🔴' : high > 0 ? '🟡' : '🟢';
  const color = critical > 0 ? 0xff4444 : high > 0 ? 0xff8800 : 0x00ff88;

  const payload = {
    embeds: [{
      title: `${emoji} ReviewGuard Test Complete`,
      description: `**URL:** ${report.url || 'Unknown'}\n\n${(report.summary || 'Test finished.').slice(0, 500)}`,
      color,
      fields: [
        { name: 'Total Bugs', value: String(bugs.length), inline: true },
        { name: 'Critical', value: String(critical), inline: true },
        { name: 'High', value: String(high), inline: true },
      ],
      footer: { text: 'ReviewGuard' },
      timestamp: new Date().toISOString(),
    }],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status };
}

async function sendEmailReport(config, report) {
  const nodemailer = require('nodemailer');
  const bugs = report.bugs || [];
  const critical = bugs.filter(b => b.severity === 'critical').length;
  const high = bugs.filter(b => b.severity === 'high').length;

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort || 587,
    secure: config.smtpPort === 465,
    auth: { user: config.smtpUser, pass: config.smtpPass },
  });

  const bugRows = bugs.slice(0, 20).map(b =>
    `<tr><td style="padding:6px;border-bottom:1px solid #eee">${b.severity.toUpperCase()}</td><td style="padding:6px;border-bottom:1px solid #eee">${b.title}</td></tr>`
  ).join('');

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#00cc66">ReviewGuard Test Report</h2>
      <p><strong>URL:</strong> ${report.url || 'Unknown'}</p>
      <p><strong>Total bugs:</strong> ${bugs.length} &nbsp;|&nbsp; <strong>Critical:</strong> ${critical} &nbsp;|&nbsp; <strong>High:</strong> ${high}</p>
      <p>${report.summary || ''}</p>
      ${bugRows ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:16px">
        <tr><th style="text-align:left;padding:6px;background:#f5f5f5">Severity</th><th style="text-align:left;padding:6px;background:#f5f5f5">Bug</th></tr>
        ${bugRows}
      </table>` : ''}
      <p style="color:#888;font-size:12px;margin-top:24px">Sent by ReviewGuard</p>
    </div>`;

  await transporter.sendMail({
    from: config.smtpUser,
    to: config.to,
    subject: `ReviewGuard: ${bugs.length} bug${bugs.length !== 1 ? 's' : ''} found on ${report.url || 'your site'}`,
    html,
  });
  return { ok: true };
}

module.exports = { notifySlack, notifyDiscord, sendEmailReport };
