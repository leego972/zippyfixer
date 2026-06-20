const { GitHubClient } = require('./github');
const { RailwayClient } = require('./railway');
const { VercelClient } = require('./vercel');

const TOOLS = [
  // ── Browser tools ──
  {
    name: 'navigate',
    description: 'Navigate the browser to a URL',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'Full URL to navigate to' } }, required: ['url'] },
  },
  {
    name: 'get_page_content',
    description: 'Get current page content: visible text, links, buttons, inputs, and forms',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'click',
    description: 'Click an element by CSS selector',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the element' },
        description: { type: 'string', description: 'What you are clicking' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'click_by_text',
    description: 'Click an element by its visible text (button, link, etc.)',
    parameters: { type: 'object', properties: { text: { type: 'string', description: 'Visible text of the element' } }, required: ['text'] },
  },
  {
    name: 'fill_input',
    description: 'Fill a text input, textarea, or select field',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the input' },
        value: { type: 'string', description: 'Value to type in' },
      },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'screenshot',
    description: 'Take a screenshot of the current page state',
    parameters: { type: 'object', properties: { name: { type: 'string', description: 'Descriptive name for this screenshot' } } },
  },
  {
    name: 'scroll',
    description: 'Scroll the page',
    parameters: { type: 'object', properties: { direction: { type: 'string', enum: ['down', 'up', 'top', 'bottom'] } }, required: ['direction'] },
  },
  {
    name: 'go_back',
    description: 'Navigate back to the previous page',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'check_broken_images',
    description: 'Check for broken or missing images on the current page',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'check_accessibility',
    description: 'Check for basic accessibility issues: missing alt text, unlabeled inputs, empty links',
    parameters: { type: 'object', properties: {} },
  },

  {
    name: 'login',
    description: 'Log into a website automatically. Detects the login form, fills credentials, and submits. Use this to access authenticated areas like dashboards or API key pages.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Login page URL (optional — leave blank if already on it)' },
        username: { type: 'string', description: 'Email or username to log in with' },
        password: { type: 'string', description: 'Password' },
        usernameSelector: { type: 'string', description: 'CSS selector for username field (auto-detected if omitted)' },
        passwordSelector: { type: 'string', description: 'CSS selector for password field (auto-detected if omitted)' },
        submitSelector: { type: 'string', description: 'CSS selector for submit button (auto-detected if omitted)' },
      },
      required: ['username', 'password'],
    },
  },
  {
    name: 'find_api_keys',
    description: 'After logging in, scan the current page and navigate to common API key pages (/settings/api, /account/api-keys, etc.) to extract any API keys visible. Returns keys found.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'hover',
    description: 'Hover over an element to reveal tooltips, dropdown menus, or hover states',
    parameters: {
      type: 'object',
      properties: { selector: { type: 'string', description: 'CSS selector for the element to hover' } },
      required: ['selector'],
    },
  },
  {
    name: 'select_option',
    description: 'Select a value from a <select> dropdown element',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the <select> element' },
        value: { type: 'string', description: 'Value or label to select' },
      },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'wait_for',
    description: 'Wait for an element to appear or disappear on the page before continuing',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to wait for' },
        state: { type: 'string', enum: ['visible', 'hidden', 'attached', 'detached'], description: 'State to wait for (default: visible)' },
        timeout: { type: 'number', description: 'Max wait time in ms (default: 10000)' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'execute_js',
    description: 'Run custom JavaScript on the page and return the result. Useful for checking values, triggering events, or reading page state.',
    parameters: {
      type: 'object',
      properties: { script: { type: 'string', description: 'JS expression — must be a function body, e.g. () => document.title' } },
      required: ['script'],
    },
  },
  {
    name: 'check_links',
    description: 'Check all links on the current page for broken ones (404, network errors, etc.)',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'check_performance',
    description: 'Measure page load performance — DOM ready time, First Contentful Paint, fully loaded time, resource count',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'check_mobile',
    description: 'Switch to a mobile viewport, take a screenshot, check for horizontal overflow/layout issues, then restore desktop viewport',
    parameters: {
      type: 'object',
      properties: {
        width: { type: 'number', description: 'Mobile viewport width in px (default: 390 — iPhone 15)' },
        height: { type: 'number', description: 'Mobile viewport height in px (default: 844)' },
      },
    },
  },
  {
    name: 'check_seo',
    description: 'Audit the page for SEO issues: title length, meta description, Open Graph tags, heading structure, canonical URL, robots meta',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_element_text',
    description: 'Get the visible text content of a specific element on the page',
    parameters: {
      type: 'object',
      properties: { selector: { type: 'string', description: 'CSS selector for the element' } },
      required: ['selector'],
    },
  },
  {
    name: 'find_text_on_page',
    description: 'Check whether specific text exists anywhere on the current page',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Text to search for (case-insensitive)' } },
      required: ['text'],
    },
  },
  {
    name: 'check_cookies',
    description: 'List all cookies set for the current page and flag any security issues (missing HttpOnly, Secure, SameSite)',
    parameters: { type: 'object', properties: {} },
  },

  // ── Visual Regression ──
  {
    name: 'take_baseline',
    description: 'Take a full-page PNG screenshot and save it as the visual baseline for a named page. Run this first before making changes, then use compare_to_baseline after to detect visual regressions.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Unique name for this baseline (e.g. "homepage", "login-page")' } },
      required: ['name'],
    },
  },
  {
    name: 'compare_to_baseline',
    description: 'Compare the current page screenshot to a saved baseline. Returns the % of pixels that changed and whether the pages match (within 1% threshold). Saves a diff image.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Baseline name to compare against (same name used in take_baseline)' } },
      required: ['name'],
    },
  },

  // ── Multi-page Crawl ──
  {
    name: 'crawl_site',
    description: 'Automatically discover and test all pages on the current site. Follows internal links, checks broken images on each page, and returns a full site map.',
    parameters: {
      type: 'object',
      properties: { maxPages: { type: 'number', description: 'Maximum number of pages to crawl (default: 10, max recommended: 30)' } },
    },
  },

  // ── Lighthouse / Performance ──
  {
    name: 'run_lighthouse',
    description: 'Run a full Lighthouse-style audit on the current URL using Google PageSpeed Insights. Returns real scores for Performance, Accessibility, Best Practices, and SEO plus Core Web Vitals.',
    parameters: {
      type: 'object',
      properties: {
        strategy: { type: 'string', enum: ['mobile', 'desktop'], description: 'Test on mobile or desktop (default: mobile)' },
      },
    },
  },

  // ── API Endpoint Testing ──
  {
    name: 'test_api_endpoint',
    description: 'Test a REST or GraphQL API endpoint directly. Checks status code, response time, and optionally validates a JSON path exists in the response.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full API endpoint URL' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], description: 'HTTP method (default: GET)' },
        headers: { type: 'object', description: 'Request headers as key-value pairs (e.g. Authorization, Content-Type)' },
        body: { type: 'object', description: 'Request body (JSON object, for POST/PUT/PATCH)' },
        expectedStatus: { type: 'number', description: 'Expected HTTP status code (e.g. 200, 201)' },
        expectedJsonPath: { type: 'string', description: 'Dot-notation JSON path to verify exists in response (e.g. "data.id" or "items.0.name")' },
      },
      required: ['url'],
    },
  },

  // ── Recording & Replay ──
  {
    name: 'start_recording',
    description: 'Start recording all browser actions (navigate, click, fill, scroll) into a replayable test flow.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'stop_recording',
    description: 'Stop recording and save the captured flow to disk with the given name. The flow can later be replayed with replay_flow.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Name for this recorded flow (e.g. "checkout-flow", "login-test")' } },
      required: ['name'],
    },
  },
  {
    name: 'replay_flow',
    description: 'Replay a previously recorded test flow step-by-step and report which steps passed or failed.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Name of the flow to replay (must match a name used in stop_recording)' } },
      required: ['name'],
    },
  },

  // ── Vercel tools ──
  {
    name: 'vercel_list_projects',
    description: 'List all Vercel projects for the authenticated token',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'vercel_get_deployments',
    description: 'Get recent deployments for a Vercel project',
    parameters: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'Vercel project ID' } },
      required: ['projectId'],
    },
  },
  {
    name: 'vercel_get_logs',
    description: 'Get logs for a specific Vercel deployment',
    parameters: {
      type: 'object',
      properties: { deploymentId: { type: 'string', description: 'Vercel deployment ID (uid from vercel_get_deployments)' } },
      required: ['deploymentId'],
    },
  },
  {
    name: 'vercel_redeploy',
    description: 'Trigger a redeployment on Vercel for a specific deployment',
    parameters: {
      type: 'object',
      properties: { deploymentId: { type: 'string', description: 'Vercel deployment ID to redeploy' } },
      required: ['deploymentId'],
    },
  },

  // ── GitHub tools ──
  {
    name: 'github_list_repos',
    description: 'List the authenticated user\'s GitHub repositories',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'github_list_files',
    description: 'List files and folders in a GitHub repository path',
    parameters: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'GitHub username or org' },
        repo: { type: 'string', description: 'Repository name' },
        path: { type: 'string', description: 'Path inside the repo (leave blank for root)' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'github_read_file',
    description: 'Read the contents of a file from a GitHub repository',
    parameters: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'GitHub username or org' },
        repo: { type: 'string', description: 'Repository name' },
        path: { type: 'string', description: 'File path inside the repo' },
      },
      required: ['owner', 'repo', 'path'],
    },
  },
  {
    name: 'github_write_file',
    description: 'Create or update a file in a GitHub repository to fix a bug or apply a change',
    parameters: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'GitHub username or org' },
        repo: { type: 'string', description: 'Repository name' },
        path: { type: 'string', description: 'File path inside the repo' },
        content: { type: 'string', description: 'Full new file content' },
        message: { type: 'string', description: 'Commit message describing the fix' },
        sha: { type: 'string', description: 'Current file SHA (required when updating existing file)' },
      },
      required: ['owner', 'repo', 'path', 'content', 'message'],
    },
  },
  {
    name: 'github_create_branch',
    description: 'Create a new branch in a GitHub repository (use before making fixes)',
    parameters: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'GitHub username or org' },
        repo: { type: 'string', description: 'Repository name' },
        branch: { type: 'string', description: 'New branch name (e.g. fix/broken-button)' },
        from: { type: 'string', description: 'Base branch name (defaults to main)' },
      },
      required: ['owner', 'repo', 'branch'],
    },
  },
  {
    name: 'github_create_pr',
    description: 'Open a Pull Request with your fixes',
    parameters: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'GitHub username or org' },
        repo: { type: 'string', description: 'Repository name' },
        title: { type: 'string', description: 'PR title' },
        body: { type: 'string', description: 'PR description with list of bugs fixed' },
        head: { type: 'string', description: 'Branch containing your changes' },
        base: { type: 'string', description: 'Target branch (defaults to main)' },
      },
      required: ['owner', 'repo', 'title', 'body', 'head'],
    },
  },
  {
    name: 'github_merge_pr',
    description: 'Merge an open Pull Request into its base branch. Use after creating a PR with fixes to land the changes immediately.',
    parameters: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'GitHub username or org' },
        repo: { type: 'string', description: 'Repository name' },
        pr_number: { type: 'number', description: 'Pull request number (from github_create_pr response)' },
        merge_method: { type: 'string', enum: ['merge', 'squash', 'rebase'], description: 'Merge strategy — squash is cleanest (default)' },
        commit_title: { type: 'string', description: 'Optional merge commit title' },
      },
      required: ['owner', 'repo', 'pr_number'],
    },
  },
  {
    name: 'github_list_prs',
    description: 'List open (or closed) pull requests in a repository',
    parameters: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Default: open' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'github_search_code',
    description: 'Search for code patterns, error messages, or function names inside a GitHub repository. Useful for finding the root cause of a bug.',
    parameters: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        query: { type: 'string', description: 'Search term, e.g. "TypeError", "handleSubmit", "useEffect"' },
      },
      required: ['owner', 'repo', 'query'],
    },
  },
  {
    name: 'github_create_issue',
    description: 'Log a bug as a GitHub Issue in the repository',
    parameters: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'GitHub username or org' },
        repo: { type: 'string', description: 'Repository name' },
        title: { type: 'string', description: 'Issue title' },
        body: { type: 'string', description: 'Issue body with bug description and steps to reproduce' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Labels to apply (e.g. ["bug"])' },
      },
      required: ['owner', 'repo', 'title', 'body'],
    },
  },
  {
    name: 'github_get_commits',
    description: 'Get recent commits for a GitHub repository',
    parameters: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'GitHub username or org' },
        repo: { type: 'string', description: 'Repository name' },
      },
      required: ['owner', 'repo'],
    },
  },

  // ── Railway MCP tools (preferred — auto-discovers ALL Railway capabilities) ──
  {
    name: 'railway_mcp_discover',
    description: 'List ALL tools available from Railway MCP server. Call this first to see every Railway capability available.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'railway_mcp_execute',
    description: 'Execute any Railway MCP tool by name with given arguments. Use railway_mcp_discover first to see available tool names.',
    parameters: {
      type: 'object',
      properties: {
        tool: { type: 'string', description: 'Exact Railway MCP tool name (from railway_mcp_discover)' },
        args: { type: 'object', description: 'Arguments object for the tool' },
      },
      required: ['tool'],
    },
  },

  // ── Railway tools ──
  {
    name: 'railway_list_projects',
    description: 'List all Railway projects for the authenticated user',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'railway_get_deployments',
    description: 'Get recent deployments for a Railway project',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Railway project ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'railway_get_logs',
    description: 'Get deployment logs from Railway to check for runtime errors',
    parameters: {
      type: 'object',
      properties: {
        deploymentId: { type: 'string', description: 'Railway deployment ID' },
      },
      required: ['deploymentId'],
    },
  },
  {
    name: 'railway_redeploy',
    description: 'Trigger a redeploy on Railway (use after pushing a fix)',
    parameters: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Railway service ID' },
        environmentId: { type: 'string', description: 'Railway environment ID' },
      },
      required: ['serviceId', 'environmentId'],
    },
  },

  // ── Logging tools ──
  {
    name: 'log_bug',
    description: 'Log a bug or issue found during testing',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short bug title (max 80 characters)' },
        description: { type: 'string', description: 'Full description: what happened, what was expected, steps to reproduce' },
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'], description: 'critical=crash, high=major broken feature, medium=partial, low=cosmetic, info=suggestion' },
        category: { type: 'string', enum: ['ui', 'functionality', 'navigation', 'performance', 'accessibility', 'content', 'http-error', 'js-error', 'console-error', 'missing-feature', 'general'], description: 'Bug category' },
        selector: { type: 'string', description: 'CSS selector or element reference (optional)' },
      },
      required: ['title', 'description', 'severity', 'category'],
    },
  },
  {
    name: 'set_summary',
    description: 'Set the final test summary — call this LAST after all testing and fixes are complete',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Full test summary: quality rating, key findings, fixes applied, remaining recommendations' },
      },
      required: ['summary'],
    },
  },
];

function buildSystemPrompt(url, instructions, testDepth, hasGitHub, hasRailway, loginEmail, loginPassword) {
  const depth = testDepth || 'standard';
  const actionTargets = { quick: '10–15', standard: '25–40', deep: '50–70' };
  const hasLogin = !!(loginEmail && loginPassword);

  return `You are Guard — an expert QA engineer, beta tester, and developer. You test websites like a real user AND fix bugs directly in the source code when given access.

TARGET: ${url}
DEPTH: ${depth.toUpperCase()} (aim for ${actionTargets[depth] || '25–40'} meaningful actions)
${hasGitHub ? '✅ GitHub access: you CAN read repos, make code changes, create branches and PRs' : ''}
${hasRailway ? '✅ Railway access: you CAN check deployments, read logs, trigger redeploys' : ''}
${hasLogin ? `✅ Login credentials provided:
  - Username/Email: ${loginEmail}
  - Password: ${loginPassword}
  → Call the login tool early to access authenticated areas. Test the full app including logged-in features.` : ''}

TESTING CHECKLIST:
1. Navigation — all links, menus, internal routes working? Dead links? 404s?
2. Forms — validation, submission, error messages, success feedback
3. Buttons — every button responds and does what it implies?
4. Images — check_broken_images on each page
5. Content — placeholder text ("Lorem ipsum"), missing text, incomplete sections?
6. Console & HTTP errors — auto-logged, but also run check_accessibility
7. Accessibility — missing alt text, unlabeled inputs, empty links
8. Missing features — things that look like features but don't work
${hasGitHub ? `
GITHUB WORKFLOW (when repo is provided):
- Use github_list_repos to find the right repo
- Use github_search_code to find the root cause in the codebase
- Use github_read_file to inspect the broken code
- Create a fix branch: github_create_branch (e.g. fix/login-validation)
- Apply fixes: github_write_file with clear commit messages
- Open a PR: github_create_pr summarizing all bugs fixed
- MERGE the PR immediately: github_merge_pr (use squash method)
- Log unfixed bugs as issues: github_create_issue with label "bug"
` : ''}
${hasRailway ? `
RAILWAY WORKFLOW:
- Use railway_list_projects to find the project
- Check railway_get_deployments to see deployment status
- If a deployment failed, read railway_get_logs for error details
- After pushing a fix via GitHub, trigger railway_redeploy
` : ''}
LOGIN & API KEY WORKFLOW (when user provides credentials):
- Call login with the site URL, username, and password to access their account
- After login, call find_api_keys to scan for keys on the dashboard/settings pages
- Present any keys found clearly in the summary
- You can use this for OpenAI, Anthropic, Guard/Groq, Railway, Stripe, GitHub, and more

ADDITIONAL CHECKS (run on every page):
- check_seo — flag missing/bad title, description, og:image
- check_performance — flag any FCP > 3s as a high bug
- check_mobile — flag any horizontal overflow on mobile as medium bug
- check_links — flag broken links as medium bugs
- check_cookies — flag insecure cookies as medium security bugs

SEVERITY GUIDE:
- critical: crash/won't load/data loss
- high: core feature broken
- medium: partially broken
- low: cosmetic
- info: suggestion

${instructions ? `USER INSTRUCTIONS:\n${instructions}` : ''}

Start testing now. Be thorough. When done, call set_summary with a full report of what you found and what you fixed.`;
}

async function executeTool(name, args, browser, logger, emit, tokens = {}) {
  emit('tool-call', { name, args: JSON.stringify(args).slice(0, 150) });

  // GitHub tools
  if (name.startsWith('github_')) {
    if (!tokens.github) return { error: 'No GitHub token provided. Add it in the GitHub Token field.' };
    const gh = new GitHubClient(tokens.github);
    try {
      switch (name) {
        case 'github_list_repos': return await gh.listRepos();
        case 'github_list_files': return await gh.listContents(args.owner, args.repo, args.path || '');
        case 'github_read_file': return await gh.getFile(args.owner, args.repo, args.path);
        case 'github_write_file': {
          const write = await gh.createOrUpdateFile(args.owner, args.repo, args.path, args.content, args.message, args.sha);
          logger.logGitHubAction({ action: 'File updated', details: args.path, repo: `${args.owner}/${args.repo}` });
          logger.logFix({ file: args.path, description: args.message || `Updated ${args.path}`, commit: write?.commit?.sha || '' });
          return write;
        }
        case 'github_create_branch': {
          const branch = await gh.createBranch(args.owner, args.repo, args.branch, args.from);
          logger.logGitHubAction({ action: 'Branch created', details: args.branch, repo: `${args.owner}/${args.repo}` });
          return branch;
        }
        case 'github_create_pr': {
          const pr = await gh.createPullRequest(args.owner, args.repo, { title: args.title, body: args.body, head: args.head, base: args.base });
          emit('github-pr', { url: pr.html_url, title: args.title });
          logger.logGitHubAction({ action: 'PR opened', details: `#${pr.number} — ${args.title}`, url: pr.html_url, repo: `${args.owner}/${args.repo}`, prNumber: pr.number });
          return pr;
        }
        case 'github_merge_pr': {
          const merged = await gh.mergePullRequest(args.owner, args.repo, args.pr_number, {
            mergeMethod: args.merge_method || 'squash',
            commitTitle: args.commit_title,
          });
          emit('github-merged', { prNumber: args.pr_number, repo: `${args.owner}/${args.repo}` });
          logger.logGitHubAction({ action: 'PR merged', details: `#${args.pr_number} (${args.merge_method || 'squash'})`, repo: `${args.owner}/${args.repo}`, prNumber: args.pr_number });
          return merged;
        }
        case 'github_list_prs':
          return await gh.listPullRequests(args.owner, args.repo, args.state || 'open');
        case 'github_search_code':
          return await gh.searchCode(args.query, args.owner, args.repo);
        case 'github_create_issue': {
          const issue = await gh.createIssue(args.owner, args.repo, { title: args.title, body: args.body, labels: args.labels || ['bug'] });
          emit('github-issue', { url: issue.html_url, title: args.title });
          logger.logGitHubAction({ action: 'Issue created', details: args.title, url: issue.html_url, repo: `${args.owner}/${args.repo}` });
          return issue;
        }
        case 'github_get_commits': return await gh.getCommits(args.owner, args.repo);
        default: return { error: `Unknown GitHub tool: ${name}` };
      }
    } catch (err) { return { error: err.message }; }
  }

  // Railway tools
  if (name.startsWith('railway_')) {
    if (!tokens.railway) return { error: 'No Railway token provided. Add it in the Railway Token field.' };

    // Railway MCP tools — auto-discover all Railway capabilities
    if (name === 'railway_mcp_discover') {
      try {
        const { getRailwayMcpClient } = require('./railway-mcp');
        const mcp = getRailwayMcpClient(tokens.railway);
        const tools = await mcp.listTools();
        if (!tools.length) return { message: 'No MCP tools found. Try using railway_list_projects instead.' };
        return tools.map(t => `• ${t.name}: ${t.description}`).join('\n');
      } catch (err) { return { error: `Railway MCP discover failed: ${err.message}` }; }
    }

    if (name === 'railway_mcp_execute') {
      try {
        const { getRailwayMcpClient } = require('./railway-mcp');
        const mcp = getRailwayMcpClient(tokens.railway);
        const result = await mcp.callTool(args.tool, args.args || {});
        const text = (result.content || []).map(c => c.text).join('\n');
        if (result.isError) {
          logger.logTestError({ tool: `railway_mcp_execute(${args.tool})`, message: text });
          return { error: text };
        }
        logger.logRailwayAction({ action: args.tool, details: text.slice(0, 120) });
        return text || 'Railway tool executed successfully.';
      } catch (err) {
        logger.logTestError({ tool: `railway_mcp_execute(${args.tool})`, message: err.message });
        return { error: `Railway MCP execute failed: ${err.message}` };
      }
    }

    // Fallback: legacy GraphQL Railway tools
    const rw = new RailwayClient(tokens.railway);
    try {
      let result;
      switch (name) {
        case 'railway_list_projects':
          result = await rw.listProjects();
          logger.logRailwayAction({ action: 'List projects' });
          return result;
        case 'railway_get_deployments':
          result = await rw.getDeployments(args.projectId);
          logger.logRailwayAction({ action: 'Get deployments', project: args.projectId });
          return result;
        case 'railway_get_logs':
          result = await rw.getLogs(args.deploymentId);
          logger.logRailwayAction({ action: 'Get logs', details: `deployment ${args.deploymentId}` });
          return result;
        case 'railway_redeploy':
          result = await rw.triggerRedeploy(args.serviceId, args.environmentId);
          logger.logRailwayAction({ action: 'Redeploy triggered', details: `service ${args.serviceId}` });
          return result;
        default: return { error: `Unknown Railway tool: ${name}` };
      }
    } catch (err) {
      logger.logTestError({ tool: name, message: err.message });
      return { error: err.message };
    }
  }

  // Vercel tools
  if (name.startsWith('vercel_')) {
    if (!tokens.vercel) return { error: 'No Vercel token provided. Enter your Vercel token in the form.' };
    const vc = new VercelClient(tokens.vercel);
    try {
      switch (name) {
        case 'vercel_list_projects':   return await vc.listProjects();
        case 'vercel_get_deployments': return await vc.getDeployments(args.projectId);
        case 'vercel_get_logs':        return await vc.getLogs(args.deploymentId);
        case 'vercel_redeploy':        return await vc.redeployProject(args.deploymentId);
        default: return { error: `Unknown Vercel tool: ${name}` };
      }
    } catch (err) {
      return { error: err.message };
    }
  }

  // Browser & logging tools
  try {
    switch (name) {
      case 'navigate':              return await browser.navigate(args.url);
      case 'get_page_content':      return await browser.getPageContent();
      case 'click':                 return await browser.click(args.selector, args.description);
      case 'click_by_text':         return await browser.clickByText(args.text);
      case 'fill_input':            return await browser.fillInput(args.selector, args.value);
      case 'screenshot':            return await browser.screenshot(args.name);
      case 'scroll':                return await browser.scroll(args.direction);
      case 'go_back':               return await browser.goBack();
      case 'check_broken_images':   return await browser.checkBrokenImages();
      case 'check_accessibility':   return await browser.checkAccessibility();

      // ── New browser tools ──
      case 'login':                 return await browser.login(args);
      case 'find_api_keys':         return await browser.findApiKeys();
      case 'hover':                 return await browser.hover(args.selector);
      case 'select_option':         return await browser.selectOption(args.selector, args.value);
      case 'wait_for':              return await browser.waitFor(args.selector, args.state, args.timeout);
      case 'execute_js':            return await browser.executeJs(args.script);
      case 'check_links':           return await browser.checkLinks();
      case 'check_performance':     return await browser.checkPerformance();
      case 'check_mobile':          return await browser.checkMobile(args.width, args.height);
      case 'check_seo':             return await browser.checkSeo();
      case 'get_element_text':      return await browser.getElementText(args.selector);
      case 'find_text_on_page':     return await browser.findTextOnPage(args.text);
      case 'check_cookies':         return await browser.checkCookies();

      // ── Visual Regression ──
      case 'take_baseline':         return await browser.takeBaseline(args.name);
      case 'compare_to_baseline':   return await browser.compareToBaseline(args.name);

      // ── Multi-page Crawl ──
      case 'crawl_site':            return await browser.crawlSite(args.maxPages || 10);

      // ── Lighthouse ──
      case 'run_lighthouse': {
        const url = browser.page.url();
        const strategy = args.strategy || 'mobile';
        try {
          const res = await fetch(
            `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}`
          );
          const data = await res.json();
          if (data.error) return { error: data.error.message };
          const cats = data.lighthouseResult?.categories || {};
          const audits = data.lighthouseResult?.audits || {};
          return {
            url,
            strategy,
            scores: {
              performance: Math.round((cats.performance?.score || 0) * 100),
              accessibility: Math.round((cats.accessibility?.score || 0) * 100),
              bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
              seo: Math.round((cats.seo?.score || 0) * 100),
            },
            coreWebVitals: {
              lcp: audits['largest-contentful-paint']?.displayValue,
              fid: audits['max-potential-fid']?.displayValue,
              cls: audits['cumulative-layout-shift']?.displayValue,
              fcp: audits['first-contentful-paint']?.displayValue,
              tbt: audits['total-blocking-time']?.displayValue,
              tti: audits['interactive']?.displayValue,
            },
            opportunities: Object.values(audits)
              .filter(a => a.score !== null && a.score < 0.9 && a.details?.type === 'opportunity')
              .slice(0, 8)
              .map(a => ({ title: a.title, description: a.description?.split('.')[0], savings: a.displayValue })),
          };
        } catch (err) {
          return { error: `Lighthouse audit failed: ${err.message}` };
        }
      }

      // ── API Endpoint Testing ──
      case 'test_api_endpoint':     return await browser.testApiEndpoint(args);

      // ── Recording & Replay ──
      case 'start_recording':       return browser.startRecording();
      case 'stop_recording':        return browser.stopRecording(args.name);
      case 'replay_flow':           return await browser.replayFlow(args.name);

      case 'log_bug': {
        const bug = logger.logBug({ ...args, url: await browser.currentUrl() });
        emit('bug-logged', bug);
        return { success: true, bugId: bug.id };
      }
      case 'set_summary':
        logger.setSummary(args.summary);
        emit('summary-set', { summary: args.summary });
        return { success: true };
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { TOOLS, buildSystemPrompt, executeTool };
