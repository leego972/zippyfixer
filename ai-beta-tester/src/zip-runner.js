/**
 * ZippyFixer — ZIP App Runner
 * Extracts a user's ZIP, detects the app type, starts it locally,
 * and returns a localhost URL ready for AI browser testing.
 */

const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const http = require('http');

const STARTUP_TIMEOUT = 30000; // 30s max to wait for app to boot

class ZipAppRunner {
  constructor() {
    this.tempDir = null;
    this.process = null;
    this.port = null;
    this.staticServer = null;
  }

  /**
   * Extract zip buffer → detect app type → start → return { url, cleanup }
   */
  async start(zipBuffer, emit) {
    // 1. Extract to temp dir
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zippyfixer-'));
    emit('status', { message: `Extracting ZIP to temp directory...` });

    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(this.tempDir, true);

    // Flatten one-level wrapper folders (e.g. my-app/index.html → index.html)
    const entries = fs.readdirSync(this.tempDir);
    if (entries.length === 1) {
      const only = path.join(this.tempDir, entries[0]);
      if (fs.statSync(only).isDirectory()) {
        this.tempDir = only;
      }
    }

    emit('status', { message: `ZIP extracted. Detecting app type...` });

    const appType = this._detectAppType();
    emit('status', { message: `Detected: ${appType} app. Starting...` });

    this.port = await this._findFreePort();

    if (appType === 'static') {
      await this._startStaticServer(emit);
    } else if (appType === 'node') {
      await this._startNodeApp(emit);
    } else {
      throw new Error('Could not detect app type. ZIP must contain an index.html or a package.json with a start script.');
    }

    const url = `http://localhost:${this.port}`;
    emit('status', { message: `App running at ${url} — starting AI test...` });
    return url;
  }

  _detectAppType() {
    const files = fs.readdirSync(this.tempDir);
    if (files.includes('package.json')) {
      const pkg = JSON.parse(fs.readFileSync(path.join(this.tempDir, 'package.json'), 'utf8'));
      if (pkg.scripts?.start || pkg.scripts?.dev || pkg.main) return 'node';
    }
    // Static: has index.html in root or a public/dist folder
    if (
      files.includes('index.html') ||
      files.includes('dist') ||
      files.includes('public') ||
      files.includes('build')
    ) return 'static';
    if (files.includes('package.json')) return 'node';
    return 'unknown';
  }

  async _startStaticServer(emit) {
    // Find the root to serve
    let serveDir = this.tempDir;
    for (const candidate of ['dist', 'build', 'public', 'out']) {
      const d = path.join(this.tempDir, candidate);
      if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
        serveDir = d;
        break;
      }
    }

    emit('status', { message: `Serving static files from ${path.basename(serveDir)}/` });

    const express = require('express');
    const app = express();
    app.use(express.static(serveDir));
    app.get('*', (req, res) => {
      const indexPath = path.join(serveDir, 'index.html');
      if (fs.existsSync(indexPath)) res.sendFile(indexPath);
      else res.status(404).send('Not found');
    });

    await new Promise((resolve, reject) => {
      this.staticServer = app.listen(this.port, '0.0.0.0', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async _startNodeApp(emit) {
    const pkg = JSON.parse(fs.readFileSync(path.join(this.tempDir, 'package.json'), 'utf8'));

    // Install deps if node_modules missing
    if (!fs.existsSync(path.join(this.tempDir, 'node_modules'))) {
      emit('status', { message: 'Installing dependencies (npm install)...' });
      await this._runCommand('npm', ['install', '--silent', '--prefer-offline'], this.tempDir);
    }

    // Choose start command
    const scriptKey = pkg.scripts?.start ? 'start' : pkg.scripts?.dev ? 'dev' : null;
    const cmd = scriptKey ? ['npm', ['run', scriptKey]] : ['node', [pkg.main || 'index.js']];

    emit('status', { message: `Starting app (${cmd[0]} ${cmd[1].join(' ')})...` });

    this.process = spawn(cmd[0], cmd[1], {
      cwd: this.tempDir,
      env: { ...process.env, PORT: String(this.port), NODE_ENV: 'development' },
      stdio: 'pipe',
    });

    this.process.stderr?.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) emit('status', { message: `[app] ${msg.slice(0, 120)}` });
    });

    // Wait for port to open
    await this._waitForPort(this.port, STARTUP_TIMEOUT, emit);
  }

  _runCommand(cmd, args, cwd) {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, { cwd, stdio: 'pipe' });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
      });
    });
  }

  async _waitForPort(port, timeout, emit) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const open = await this._isPortOpen(port);
      if (open) return;
      await new Promise((r) => setTimeout(r, 500));
      emit('status', { message: `Waiting for app to start on port ${port}...` });
    }
    throw new Error(`App did not start within ${timeout / 1000}s. Check that it reads the PORT environment variable.`);
  }

  _isPortOpen(port) {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${port}`, () => { resolve(true); req.destroy(); });
      req.on('error', () => resolve(false));
      req.setTimeout(500, () => { resolve(false); req.destroy(); });
    });
  }

  async _findFreePort() {
    return new Promise((resolve, reject) => {
      const srv = require('net').createServer();
      srv.listen(0, '127.0.0.1', () => {
        const port = srv.address().port;
        srv.close(() => resolve(port));
      });
      srv.on('error', reject);
    });
  }

  async stop() {
    if (this.process) { this.process.kill('SIGTERM'); this.process = null; }
    if (this.staticServer) { this.staticServer.close(); this.staticServer = null; }
    if (this.tempDir && this.tempDir.startsWith(os.tmpdir())) {
      try { fs.rmSync(this.tempDir, { recursive: true, force: true }); } catch (_) {}
    }
  }
}

module.exports = { ZipAppRunner };
