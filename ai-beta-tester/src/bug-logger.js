const fs = require('fs');
const path = require('path');

class BugLogger {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.startTime = new Date();
    this.bugs = [];
    this.actions = [];
    this.screenshots = [];
    this.pagesVisited = [];
    this.testSummary = '';

    // Project log entries — written in real-time
    this.fixes = [];
    this.githubActions = [];
    this.railwayActions = [];
    this.testErrors = [];

    // Path where the project log markdown is saved as the test runs
    this.projectLogDir = path.join(__dirname, '..', 'logs');
    this.projectLogPath = path.join(this.projectLogDir, `zippyfixer-${sessionId}.md`);

    // Ensure logs directory exists and write initial log header immediately
    try {
      fs.mkdirSync(this.projectLogDir, { recursive: true });
      this._writeLogHeader();
    } catch { /* non-fatal */ }
  }

  // ── Core logging ─────────────────────────────────────────────────────────

  logBug({ title, description, severity, url, selector, category }) {
    const bug = {
      id: `BUG-${String(this.bugs.length + 1).padStart(3, '0')}`,
      title: title || 'Untitled Bug',
      description: description || '',
      severity: severity || 'medium',
      url: url || '',
      selector: selector || '',
      category: category || 'general',
      timestamp: new Date().toISOString(),
    };
    this.bugs.push(bug);
    this._appendToLog(this._formatBugEntry(bug));
    return bug;
  }

  logAction(action) {
    this.actions.push({ ...action, timestamp: new Date().toISOString() });
  }

  logScreenshot(name, base64Data, url) {
    this.screenshots.push({ name, base64Data, url, timestamp: new Date().toISOString() });
  }

  logPageVisit(url, title) {
    if (!this.pagesVisited.find((p) => p.url === url)) {
      this.pagesVisited.push({ url, title, timestamp: new Date().toISOString() });
    }
  }

  setSummary(summary) {
    this.testSummary = summary;
    this._appendToLog(`\n---\n\n## 📋 Test Summary\n\n${summary}\n`);
  }

  // ── Project log: fixes ───────────────────────────────────────────────────

  logFix({ bugIds = [], branch, file, description, commit, prNumber, prUrl }) {
    const entry = {
      timestamp: new Date().toISOString(),
      bugIds,
      branch: branch || '',
      file: file || '',
      description: description || '',
      commit: commit || '',
      prNumber: prNumber || null,
      prUrl: prUrl || '',
    };
    this.fixes.push(entry);
    this._appendToLog(this._formatFixEntry(entry));
  }

  // ── Project log: GitHub actions ──────────────────────────────────────────

  logGitHubAction({ action, details = '', url = '', repo = '', prNumber = null }) {
    const entry = { timestamp: new Date().toISOString(), action, details, url, repo, prNumber };
    this.githubActions.push(entry);
    this._appendToLog(this._formatGitHubEntry(entry));
  }

  // ── Project log: Railway actions ─────────────────────────────────────────

  logRailwayAction({ action, project = '', service = '', details = '' }) {
    const entry = { timestamp: new Date().toISOString(), action, project, service, details };
    this.railwayActions.push(entry);
    this._appendToLog(this._formatRailwayEntry(entry));
  }

  // ── Project log: errors ──────────────────────────────────────────────────

  logTestError({ message, context = '', tool = '' }) {
    const entry = { timestamp: new Date().toISOString(), message, context, tool };
    this.testErrors.push(entry);
    this._appendToLog(this._formatErrorEntry(entry));
  }

  // ── Report / full project log ─────────────────────────────────────────────

  getReport() {
    const endTime = new Date();
    const durationMs = endTime - this.startTime;
    const duration = `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`;

    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    this.bugs.forEach((b) => { if (bySeverity[b.severity] !== undefined) bySeverity[b.severity]++; });

    return {
      sessionId: this.sessionId,
      startTime: this.startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration,
      totalBugs: this.bugs.length,
      bySeverity,
      bugs: this.bugs,
      actions: this.actions,
      screenshots: this.screenshots,
      pagesVisited: this.pagesVisited,
      summary: this.testSummary,
      fixes: this.fixes,
      githubActions: this.githubActions,
      railwayActions: this.railwayActions,
      testErrors: this.testErrors,
    };
  }

  /** Generate the full markdown project log and finalise it on disk. */
  generateProjectLog() {
    const endTime = new Date();
    const durationMs = endTime - this.startTime;
    const duration = `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`;
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    this.bugs.forEach((b) => { if (bySeverity[b.severity] !== undefined) bySeverity[b.severity]++; });

    const t = (iso) => new Date(iso).toLocaleTimeString('en', { hour12: false });
    const sev = (s) => ({ critical: '🔴', high: '🟠', medium: '🟡', low: '🟢', info: '🔵' }[s] || '⚪');

    const lines = [
      `# ZippyFixer — Project Log`,
      ``,
      `| | |`,
      `|---|---|`,
      `| **Session** | \`${this.sessionId}\` |`,
      `| **Started** | ${this.startTime.toLocaleString()} |`,
      `| **Duration** | ${duration} |`,
      `| **Total Bugs** | ${this.bugs.length} (🔴 ${bySeverity.critical} critical · 🟠 ${bySeverity.high} high · 🟡 ${bySeverity.medium} medium · 🟢 ${bySeverity.low} low) |`,
      `| **Fixes Applied** | ${this.fixes.length} |`,
      `| **GitHub Actions** | ${this.githubActions.length} |`,
      `| **Pages Tested** | ${this.pagesVisited.length} |`,
      ``,
      `---`,
      ``,
    ];

    // Pages visited
    if (this.pagesVisited.length) {
      lines.push(`## 🌐 Pages Tested\n`);
      this.pagesVisited.forEach((p, i) => {
        lines.push(`${i + 1}. **${p.title || 'Untitled'}** — \`${p.url}\``);
      });
      lines.push(``);
    }

    // Bugs
    lines.push(`## 🐛 Bugs Found (${this.bugs.length})\n`);
    if (this.bugs.length === 0) {
      lines.push(`_No bugs found._\n`);
    } else {
      this.bugs.forEach((b) => {
        lines.push(`### ${sev(b.severity)} ${b.id} — ${b.title}`);
        lines.push(``);
        lines.push(`| Field | Value |`);
        lines.push(`|---|---|`);
        lines.push(`| **Severity** | ${b.severity.toUpperCase()} |`);
        lines.push(`| **Category** | ${b.category} |`);
        lines.push(`| **Time** | ${t(b.timestamp)} |`);
        if (b.url) lines.push(`| **URL** | \`${b.url}\` |`);
        if (b.selector) lines.push(`| **Element** | \`${b.selector}\` |`);
        lines.push(``);
        lines.push(`> ${b.description}`);
        lines.push(``);
      });
    }

    // Fixes
    if (this.fixes.length) {
      lines.push(`## 🔧 Fixes Applied (${this.fixes.length})\n`);
      this.fixes.forEach((f, i) => {
        lines.push(`### Fix ${i + 1} — ${f.description || 'Code fix'} \`${t(f.timestamp)}\``);
        lines.push(``);
        if (f.branch) lines.push(`- **Branch:** \`${f.branch}\``);
        if (f.file) lines.push(`- **File:** \`${f.file}\``);
        if (f.commit) lines.push(`- **Commit:** ${f.commit}`);
        if (f.prUrl) lines.push(`- **PR:** [#${f.prNumber}](${f.prUrl})`);
        if (f.bugIds.length) lines.push(`- **Fixes bugs:** ${f.bugIds.join(', ')}`);
        lines.push(``);
      });
    }

    // GitHub actions
    if (this.githubActions.length) {
      lines.push(`## 🐙 GitHub Actions\n`);
      lines.push(`| Time | Action | Details |`);
      lines.push(`|---|---|---|`);
      this.githubActions.forEach((g) => {
        const detail = g.url ? `[${g.details || g.action}](${g.url})` : (g.details || '—');
        lines.push(`| ${t(g.timestamp)} | ${g.action} | ${detail} |`);
      });
      lines.push(``);
    }

    // Railway actions
    if (this.railwayActions.length) {
      lines.push(`## 🚂 Railway Actions\n`);
      lines.push(`| Time | Action | Project | Details |`);
      lines.push(`|---|---|---|---|`);
      this.railwayActions.forEach((r) => {
        lines.push(`| ${t(r.timestamp)} | ${r.action} | ${r.project || '—'} | ${r.details || '—'} |`);
      });
      lines.push(``);
    }

    // Errors
    if (this.testErrors.length) {
      lines.push(`## ⚠️ Errors Encountered\n`);
      this.testErrors.forEach((e, i) => {
        lines.push(`**${i + 1}.** \`${t(e.timestamp)}\` ${e.tool ? `[${e.tool}]` : ''} ${e.message}`);
        if (e.context) lines.push(`   _${e.context}_`);
      });
      lines.push(``);
    }

    // Summary
    if (this.testSummary) {
      lines.push(`## 📋 Summary\n`);
      lines.push(this.testSummary);
      lines.push(``);
    }

    lines.push(`---`);
    lines.push(`_Generated by ZippyFixer — virellestudios.com_`);

    return lines.join('\n');
  }

  /** Save the final version of the project log to disk. Returns the file path. */
  saveProjectLog() {
    try {
      fs.mkdirSync(this.projectLogDir, { recursive: true });
      const content = this.generateProjectLog();
      fs.writeFileSync(this.projectLogPath, content, 'utf8');
      return this.projectLogPath;
    } catch (err) {
      console.error('[ProjectLog] Save error:', err.message);
      return null;
    }
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  _writeLogHeader() {
    const header = [
      `# ZippyFixer — Project Log`,
      ``,
      `**Session:** \`${this.sessionId}\``,
      `**Started:** ${this.startTime.toLocaleString()}`,
      ``,
      `---`,
      ``,
      `## 🌐 Pages Tested`,
      ``,
    ].join('\n');
    try { fs.writeFileSync(this.projectLogPath, header, 'utf8'); } catch { /* non-fatal */ }
  }

  _appendToLog(text) {
    try { fs.appendFileSync(this.projectLogPath, '\n' + text, 'utf8'); } catch { /* non-fatal */ }
  }

  _formatBugEntry(b) {
    const sev = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢', info: '🔵' };
    const t = new Date(b.timestamp).toLocaleTimeString('en', { hour12: false });
    return [
      ``,
      `### ${sev[b.severity] || '⚪'} ${b.id} [${b.severity.toUpperCase()}] — ${b.title}`,
      `_${t} · ${b.category}${b.url ? ' · ' + b.url : ''}_`,
      ``,
      `> ${b.description}`,
    ].join('\n');
  }

  _formatFixEntry(f) {
    const t = new Date(f.timestamp).toLocaleTimeString('en', { hour12: false });
    const parts = [`\n### 🔧 Fix Applied — ${t}`];
    if (f.description) parts.push(`**${f.description}**`);
    if (f.branch) parts.push(`- Branch: \`${f.branch}\``);
    if (f.file) parts.push(`- File: \`${f.file}\``);
    if (f.commit) parts.push(`- Commit: ${f.commit}`);
    if (f.prUrl) parts.push(`- PR: [#${f.prNumber}](${f.prUrl})`);
    return parts.join('\n');
  }

  _formatGitHubEntry(g) {
    const t = new Date(g.timestamp).toLocaleTimeString('en', { hour12: false });
    const link = g.url ? ` → [view](${g.url})` : '';
    return `\n> 🐙 **${t}** GitHub: ${g.action}${g.details ? ' — ' + g.details : ''}${link}`;
  }

  _formatRailwayEntry(r) {
    const t = new Date(r.timestamp).toLocaleTimeString('en', { hour12: false });
    return `\n> 🚂 **${t}** Railway: ${r.action}${r.project ? ' (' + r.project + ')' : ''}${r.details ? ' — ' + r.details : ''}`;
  }

  _formatErrorEntry(e) {
    const t = new Date(e.timestamp).toLocaleTimeString('en', { hour12: false });
    return `\n> ⚠️ **${t}** Error${e.tool ? ' [' + e.tool + ']' : ''}: ${e.message}`;
  }
}

module.exports = { BugLogger };
