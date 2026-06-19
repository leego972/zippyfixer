const { chromium } = require('playwright');

class BrowserController {
  constructor(emit, logger) {
    this.browser = null;
    this.page = null;
    this.emit = emit;
    this.logger = logger;
  }

  async launch() {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
    });
    this.page = await context.newPage();

    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.logger.logBug({
          title: `Console Error: ${msg.text().slice(0, 80)}`,
          description: msg.text(),
          severity: 'high',
          url: this.page.url(),
          category: 'console-error',
        });
        this.emit('console-error', { text: msg.text(), url: this.page.url() });
      }
    });

    this.page.on('pageerror', (err) => {
      this.logger.logBug({
        title: `Page JS Error: ${err.message.slice(0, 80)}`,
        description: err.message,
        severity: 'critical',
        url: this.page.url(),
        category: 'js-error',
      });
      this.emit('page-error', { message: err.message, url: this.page.url() });
    });

    this.page.on('response', (response) => {
      if (response.status() >= 400) {
        this.emit('http-error', {
          url: response.url(),
          status: response.status(),
          pageUrl: this.page.url(),
        });
        if (response.status() >= 500) {
          this.logger.logBug({
            title: `HTTP ${response.status()} on ${response.url().split('?')[0].slice(-60)}`,
            description: `Server returned ${response.status()} for ${response.url()}`,
            severity: 'critical',
            url: this.page.url(),
            category: 'http-error',
          });
        } else if (response.status() >= 400) {
          this.logger.logBug({
            title: `HTTP ${response.status()} on ${response.url().split('?')[0].slice(-60)}`,
            description: `Client error ${response.status()} for ${response.url()}`,
            severity: 'medium',
            url: this.page.url(),
            category: 'http-error',
          });
        }
      }
    });
  }

  async navigate(url) {
    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await this.page.waitForTimeout(1000);
      const title = await this.page.title();
      this.logger.logPageVisit(this.page.url(), title);
      this.emit('navigated', { url: this.page.url(), title });
      return { url: this.page.url(), title, success: true };
    } catch (err) {
      this.logger.logBug({
        title: `Navigation failed: ${url}`,
        description: err.message,
        severity: 'critical',
        url,
        category: 'navigation',
      });
      return { url, success: false, error: err.message };
    }
  }

  async getPageContent() {
    const url = this.page.url();
    const title = await this.page.title();
    const content = await this.page.evaluate(() => {
      const body = document.body;
      return {
        text: body ? body.innerText.slice(0, 6000) : '',
        links: Array.from(document.querySelectorAll('a[href]'))
          .slice(0, 30)
          .map((a) => ({ text: a.innerText.trim().slice(0, 60), href: a.href })),
        buttons: Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]'))
          .slice(0, 20)
          .map((b) => ({
            text: (b.innerText || b.value || b.getAttribute('aria-label') || '').trim().slice(0, 60),
            type: b.tagName.toLowerCase(),
            disabled: b.disabled,
          })),
        inputs: Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select'))
          .slice(0, 15)
          .map((i) => ({
            type: i.type || i.tagName.toLowerCase(),
            name: i.name,
            placeholder: i.placeholder,
            label: document.querySelector(`label[for="${i.id}"]`)?.innerText || '',
          })),
        forms: Array.from(document.querySelectorAll('form')).length,
        images: Array.from(document.querySelectorAll('img'))
          .filter((img) => !img.complete || img.naturalWidth === 0)
          .slice(0, 5)
          .map((img) => ({ src: img.src, alt: img.alt })),
      };
    });
    return { url, title, ...content };
  }

  async click(selector, description) {
    try {
      const locator = this.page.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      await locator.click({ timeout: 5000 });
      await this.page.waitForTimeout(800);
      this.logger.logAction({ type: 'click', selector, description });
      this.emit('action', { type: 'click', selector, description, url: this.page.url() });
      return { success: true, newUrl: this.page.url() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async clickByText(text, tagHint) {
    try {
      const tag = tagHint || 'button, a, [role="button"]';
      const locator = this.page.getByRole('button', { name: text, exact: false });
      const count = await locator.count();
      if (count > 0) {
        await locator.first().click({ timeout: 5000 });
      } else {
        await this.page.getByText(text, { exact: false }).first().click({ timeout: 5000 });
      }
      await this.page.waitForTimeout(800);
      this.logger.logAction({ type: 'click-text', text, description: `Clicked "${text}"` });
      this.emit('action', { type: 'click-text', text, url: this.page.url() });
      return { success: true, newUrl: this.page.url() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async fillInput(selector, value) {
    try {
      const locator = this.page.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      await locator.fill(value, { timeout: 5000 });
      await this.page.waitForTimeout(400);
      this.logger.logAction({ type: 'fill', selector, value, description: `Filled input with "${value}"` });
      this.emit('action', { type: 'fill', selector, value, url: this.page.url() });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async screenshot(name) {
    try {
      const buffer = await this.page.screenshot({ type: 'jpeg', quality: 70, fullPage: false });
      const base64 = buffer.toString('base64');
      this.logger.logScreenshot(name || `screenshot-${Date.now()}`, base64, this.page.url());
      this.emit('screenshot', { name, url: this.page.url(), preview: `data:image/jpeg;base64,${base64.slice(0, 200)}...` });
      return { success: true, base64 };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async scroll(direction) {
    try {
      if (direction === 'down') {
        await this.page.evaluate(() => window.scrollBy(0, 600));
      } else if (direction === 'up') {
        await this.page.evaluate(() => window.scrollBy(0, -600));
      } else if (direction === 'bottom') {
        await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      } else if (direction === 'top') {
        await this.page.evaluate(() => window.scrollTo(0, 0));
      }
      await this.page.waitForTimeout(400);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async checkBrokenImages() {
    const broken = await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .filter((img) => !img.complete || img.naturalWidth === 0)
        .map((img) => ({ src: img.src, alt: img.alt }));
    });
    return broken;
  }

  async checkAccessibility() {
    return await this.page.evaluate(() => {
      const issues = [];
      document.querySelectorAll('img:not([alt])').forEach((img) => {
        issues.push({ type: 'missing-alt', element: 'img', src: img.src.slice(-60) });
      });
      document.querySelectorAll('a:not([href]), a[href=""], a[href="#"]').forEach((a) => {
        issues.push({ type: 'empty-link', text: a.innerText.trim().slice(0, 40) });
      });
      document.querySelectorAll('button:not([type])').forEach((b) => {
        issues.push({ type: 'button-no-type', text: b.innerText.trim().slice(0, 40) });
      });
      document.querySelectorAll('input:not([label]):not([aria-label]):not([placeholder])').forEach((i) => {
        issues.push({ type: 'unlabeled-input', inputType: i.type, name: i.name });
      });
      return issues.slice(0, 20);
    });
  }

  async goBack() {
    try {
      await this.page.goBack({ timeout: 8000 });
      await this.page.waitForTimeout(600);
      return { success: true, url: this.page.url() };
    } catch {
      return { success: false };
    }
  }

  async currentUrl() {
    return this.page.url();
  }

  // ── NEW TOOLS ─────────────────────────────────────────────────────────────

  /** Log into a site automatically. Detects username/password fields, fills and submits. */
  async login({ url, username, password, usernameSelector, passwordSelector, submitSelector }) {
    try {
      if (url) await this.navigate(url);
      await this.page.waitForTimeout(1000);

      // Auto-detect username field
      const userSel = usernameSelector || await this._findSelector([
        'input[type="email"]', 'input[name="email"]', 'input[name="username"]',
        'input[name="user"]', 'input[name="login"]', 'input[id*="email"]',
        'input[id*="username"]', 'input[id*="user"]', 'input[placeholder*="email" i]',
        'input[placeholder*="username" i]',
      ]);
      if (!userSel) return { success: false, error: 'Could not find username/email field' };

      // Auto-detect password field
      const passSel = passwordSelector || 'input[type="password"]';

      await this.page.fill(userSel, username, { timeout: 5000 });
      await this.page.waitForTimeout(300);
      await this.page.fill(passSel, password, { timeout: 5000 });
      await this.page.waitForTimeout(300);

      // Submit — click explicit selector, or submit button, or press Enter
      if (submitSelector) {
        await this.page.click(submitSelector, { timeout: 5000 });
      } else {
        const submitBtn = await this._findSelector([
          'button[type="submit"]', 'input[type="submit"]',
          'button:has-text("Sign in")', 'button:has-text("Log in")',
          'button:has-text("Login")', 'button:has-text("Continue")',
        ]);
        if (submitBtn) {
          await this.page.click(submitBtn, { timeout: 5000 });
        } else {
          await this.page.press(passSel, 'Enter');
        }
      }

      await this.page.waitForLoadState('domcontentloaded', { timeout: 15000 });
      await this.page.waitForTimeout(1500);

      const newUrl = this.page.url();
      const title = await this.page.title();
      this.logger.logPageVisit(newUrl, title);
      this.emit('navigated', { url: newUrl, title });
      this.logger.logAction({ type: 'login', username, url: newUrl });
      this.emit('action', { type: 'login', description: `Logged in as ${username}`, url: newUrl });

      return { success: true, url: newUrl, title };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /** Scan the current page and known API-key pages to extract API keys for the user. */
  async findApiKeys() {
    const results = [];
    const visited = new Set();

    const scanPage = async () => {
      const url = this.page.url();
      if (visited.has(url)) return;
      visited.add(url);
      const text = await this.page.evaluate(() => document.body.innerText || '');
      const found = this._extractApiKeyPatterns(text, url);
      results.push(...found);
    };

    await scanPage();

    // Navigate to common API key pages
    const baseUrl = new URL(this.page.url()).origin;
    const candidates = [
      '/settings/api', '/settings/api-keys', '/settings/developer',
      '/account/api', '/account/api-keys', '/dashboard/api-keys',
      '/api-keys', '/developer', '/developers', '/keys',
      '/profile/api-keys', '/user/settings/applications',
      '/settings/tokens', '/settings/access-tokens',
    ];

    for (const path of candidates) {
      try {
        await this.page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 8000 });
        await this.page.waitForTimeout(800);
        const status = await this.page.evaluate(() => document.title);
        // Skip 404-style pages
        if (!status.toLowerCase().includes('not found') && !status.toLowerCase().includes('404')) {
          await scanPage();
        }
      } catch { /* page doesn't exist, continue */ }
    }

    // Return to original page so the browser stays in a predictable state
    try { await this.page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }); } catch { /* best effort */ }

    if (results.length === 0) {
      return {
        found: false,
        message: 'No API keys detected on visible pages. They may be hidden behind a "Show" or "Reveal" button — try clicking it, then call find_api_keys again. Or take a screenshot to see what is on the page.',
      };
    }

    return { found: true, keys: results };
  }

  _extractApiKeyPatterns(text, url) {
    const patterns = [
      { name: 'OpenAI API Key',     regex: /sk-[A-Za-z0-9\-_T]{40,}/g },
      { name: 'Anthropic API Key',  regex: /sk-ant-[A-Za-z0-9\-_]{50,}/g },
      { name: 'Groq API Key',       regex: /gsk_[A-Za-z0-9]{40,}/g },
      { name: 'Stripe Secret Key',  regex: /sk_(?:live|test)_[A-Za-z0-9]{24,}/g },
      { name: 'Stripe Publishable', regex: /pk_(?:live|test)_[A-Za-z0-9]{24,}/g },
      { name: 'GitHub Token',       regex: /ghp_[A-Za-z0-9]{36}/g },
      { name: 'GitHub Fine-grained',regex: /github_pat_[A-Za-z0-9_]{50,}/g },
      { name: 'AWS Access Key',     regex: /AKIA[A-Z0-9]{16}/g },
      { name: 'Hugging Face Token', regex: /hf_[A-Za-z0-9]{30,}/g },
      { name: 'OpenRouter Key',     regex: /sk-or-v1-[A-Za-z0-9\-_]{40,}/g },
      { name: 'Replicate Token',    regex: /r8_[A-Za-z0-9]{36,}/g },
      // NOTE: Railway tokens look like UUIDs but only appear in their specific token settings pages.
      // We do NOT use a plain UUID regex here as it produces massive false positives everywhere.
    ];
    const results = [];
    for (const { name, regex } of patterns) {
      const matches = [...new Set(text.match(regex) || [])];
      for (const key of matches) {
        results.push({ name, key, url });
      }
    }
    return results;
  }

  /** Hover over an element by CSS selector. */
  async hover(selector) {
    try {
      await this.page.locator(selector).first().hover({ timeout: 5000 });
      await this.page.waitForTimeout(500);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  }

  /** Select an option from a <select> dropdown. */
  async selectOption(selector, value) {
    try {
      await this.page.locator(selector).first().selectOption(value, { timeout: 5000 });
      await this.page.waitForTimeout(400);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  }

  /** Wait for an element to appear (or disappear) on the page. */
  async waitFor(selector, state = 'visible', timeout = 10000) {
    try {
      await this.page.locator(selector).first().waitFor({ state, timeout });
      return { success: true, found: true };
    } catch {
      return { success: false, found: false };
    }
  }

  /** Execute custom JavaScript on the page and return the result. */
  async executeJs(script) {
    try {
      // Pass as a string so Playwright runs it directly in the page context.
      // Wrap in an IIFE so both expressions and function bodies work.
      const wrapped = `(function(){ return (${script})(); })()`;
      const result = await this.page.evaluate(wrapped);
      return { success: true, result: JSON.stringify(result).slice(0, 2000) };
    } catch (err) { return { success: false, error: err.message }; }
  }

  /** Check all links on the page — report broken ones (404, 0, network error). */
  async checkLinks() {
    const links = await this.page.evaluate(() =>
      [...new Set(
        Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(h => h.startsWith('http'))
      )].slice(0, 40)
    );

    const results = [];
    for (const link of links) {
      try {
        // Use page.request so requests share the browser session's cookies —
        // this prevents false-positive 401s on internal authenticated links.
        const res = await this.page.request.fetch(link, {
          method: 'HEAD',
          timeout: 8000,
          failOnStatusCode: false,
        });
        const status = res.status();
        if (status >= 400) results.push({ url: link, status, broken: true });
        else results.push({ url: link, status, broken: false });
      } catch {
        results.push({ url: link, status: 0, broken: true, error: 'Network error / timeout' });
      }
    }

    const broken = results.filter(r => r.broken);
    return { total: links.length, broken: broken.length, brokenLinks: broken, allLinks: results };
  }

  /** Measure page performance — load time, paint metrics, resource count. */
  async checkPerformance() {
    try {
      const metrics = await this.page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const paints = Object.fromEntries(
          performance.getEntriesByType('paint').map(e => [e.name, Math.round(e.startTime)])
        );
        return {
          domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
          fullyLoaded: nav ? Math.round(nav.loadEventEnd) : null,
          firstPaint: paints['first-paint'] || null,
          firstContentfulPaint: paints['first-contentful-paint'] || null,
          resourceCount: performance.getEntriesByType('resource').length,
          transferSize: nav ? Math.round(nav.transferSize / 1024) + 'KB' : null,
        };
      });
      const score = metrics.firstContentfulPaint < 1800 ? 'Good' : metrics.firstContentfulPaint < 3000 ? 'Needs improvement' : 'Poor';
      return { ...metrics, fcpScore: score };
    } catch (err) { return { error: err.message }; }
  }

  /** Switch to a mobile viewport, check layout, then restore to desktop. */
  async checkMobile(width = 390, height = 844) {
    try {
      const originalViewport = this.page.viewportSize();
      await this.page.setViewportSize({ width, height });
      await this.page.waitForTimeout(800);

      const issues = await this.page.evaluate(() => {
        const problems = [];
        const vw = window.innerWidth;
        document.querySelectorAll('*').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > vw + 5 && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
            problems.push({ element: el.tagName + (el.className ? '.' + el.className.split(' ')[0] : ''), width: Math.round(rect.width), viewportWidth: vw });
          }
        });
        return [...new Map(problems.map(p => [p.element, p])).values()].slice(0, 10);
      });

      const buffer = await this.page.screenshot({ type: 'jpeg', quality: 70 });
      const base64 = buffer.toString('base64');
      this.logger.logScreenshot(`mobile-${width}px`, base64, this.page.url());
      this.emit('screenshot', { name: `Mobile view (${width}px)`, url: this.page.url() });

      await this.page.setViewportSize(originalViewport || { width: 1280, height: 800 });
      await this.page.waitForTimeout(400);

      return { viewportWidth: width, overflowingElements: issues, screenshot: 'saved' };
    } catch (err) { return { error: err.message }; }
  }

  /** Check SEO signals — title, meta description, OG tags, heading structure, canonical. */
  async checkSeo() {
    return await this.page.evaluate(() => {
      const get = (sel, attr = 'content') => document.querySelector(sel)?.[attr] || null;
      const title = document.title;
      const desc = get('meta[name="description"]');
      const og = {
        title: get('meta[property="og:title"]'),
        desc: get('meta[property="og:description"]'),
        image: get('meta[property="og:image"]'),
        url: get('meta[property="og:url"]'),
      };
      const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.innerText.trim().slice(0, 80));
      const canonical = get('link[rel="canonical"]', 'href');
      const robots = get('meta[name="robots"]');
      const issues = [];
      if (!title) issues.push('Missing <title> tag');
      else if (title.length < 10) issues.push(`Title too short (${title.length} chars)`);
      else if (title.length > 60) issues.push(`Title too long (${title.length} chars — truncated in Google)`);
      if (!desc) issues.push('Missing meta description');
      else if (desc.length < 50) issues.push(`Meta description too short (${desc.length} chars)`);
      else if (desc.length > 160) issues.push(`Meta description too long (${desc.length} chars)`);
      if (h1s.length === 0) issues.push('No <h1> tag found');
      if (h1s.length > 1) issues.push(`Multiple <h1> tags (${h1s.length}) — should be one per page`);
      if (!og.image) issues.push('Missing og:image (affects social sharing previews)');
      return { title, titleLength: title?.length, description: desc, descLength: desc?.length, og, h1s, canonical, robots, issues };
    });
  }

  /** Get the text content of a specific element. */
  async getElementText(selector) {
    try {
      const text = await this.page.locator(selector).first().innerText({ timeout: 5000 });
      return { text: text.trim(), selector };
    } catch (err) { return { error: err.message }; }
  }

  /** Check whether specific text exists anywhere on the current page. */
  async findTextOnPage(text) {
    const pageText = await this.page.evaluate(() => document.body.innerText);
    const found = pageText.toLowerCase().includes(text.toLowerCase());
    const count = (pageText.toLowerCase().match(new RegExp(text.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    return { found, occurrences: count, searchedFor: text };
  }

  /** Get all cookies set for the current page. */
  async checkCookies() {
    const cookies = await this.page.context().cookies();
    const flagged = cookies.filter(c => !c.httpOnly || !c.secure || c.sameSite === 'None');
    return {
      total: cookies.length,
      cookies: cookies.map(c => ({
        name: c.name,
        domain: c.domain,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite,
        expires: c.expires > 0 ? new Date(c.expires * 1000).toISOString() : 'session',
      })),
      securityWarnings: flagged.map(c => `${c.name}: ${!c.httpOnly ? 'no HttpOnly' : ''} ${!c.secure ? 'no Secure' : ''} ${c.sameSite === 'None' ? 'SameSite=None' : ''}`.trim()),
    };
  }

  // ── Helper: find first matching selector ─────────────────────────────────
  async _findSelector(selectors) {
    for (const sel of selectors) {
      try {
        const count = await this.page.locator(sel).count();
        if (count > 0) return sel;
      } catch { /* continue */ }
    }
    return null;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = { BrowserController };
