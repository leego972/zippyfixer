/**
 * GitHub integration for ZippyFixer
 * Allows the AI to read repos, find issues, and push fixes directly.
 */

class GitHubClient {
  constructor(token) {
    this.token = token;
    this.base = 'https://api.github.com';
  }

  async req(method, path, body) {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
    return data;
  }

  async listRepos() {
    const data = await this.req('GET', '/user/repos?per_page=30&sort=updated');
    if (data.error) return data;
    return data.map((r) => ({
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      private: r.private,
      language: r.language,
      defaultBranch: r.default_branch,
      url: r.html_url,
      updatedAt: r.updated_at,
    }));
  }

  async getRepo(owner, repo) {
    return await this.req('GET', `/repos/${owner}/${repo}`);
  }

  async listContents(owner, repo, path = '') {
    const data = await this.req('GET', `/repos/${owner}/${repo}/contents/${path}`);
    if (data.error) return data;
    if (Array.isArray(data)) {
      return data.map((f) => ({ name: f.name, path: f.path, type: f.type, size: f.size, sha: f.sha }));
    }
    return data;
  }

  async getFile(owner, repo, filePath) {
    const data = await this.req('GET', `/repos/${owner}/${repo}/contents/${filePath}`);
    if (data.error) return data;
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return { path: data.path, content, sha: data.sha, size: data.size };
  }

  async createOrUpdateFile(owner, repo, filePath, content, message, sha) {
    const encoded = Buffer.from(content).toString('base64');
    const body = { message, content: encoded };
    if (sha) body.sha = sha;
    return await this.req('PUT', `/repos/${owner}/${repo}/contents/${filePath}`, body);
  }

  async createBranch(owner, repo, branchName, fromBranch = 'main') {
    const ref = await this.req('GET', `/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`);
    if (ref.error) {
      const mainRef = await this.req('GET', `/repos/${owner}/${repo}/git/ref/heads/master`);
      if (mainRef.error) return mainRef;
      return await this.req('POST', `/repos/${owner}/${repo}/git/refs`, {
        ref: `refs/heads/${branchName}`,
        sha: mainRef.object.sha,
      });
    }
    return await this.req('POST', `/repos/${owner}/${repo}/git/refs`, {
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha,
    });
  }

  async createPullRequest(owner, repo, { title, body, head, base = 'main' }) {
    return await this.req('POST', `/repos/${owner}/${repo}/pulls`, { title, body, head, base });
  }

  async mergePullRequest(owner, repo, prNumber, { mergeMethod = 'squash', commitTitle } = {}) {
    const body = { merge_method: mergeMethod };
    if (commitTitle) body.commit_title = commitTitle;
    return await this.req('PUT', `/repos/${owner}/${repo}/pulls/${prNumber}/merge`, body);
  }

  async listPullRequests(owner, repo, state = 'open') {
    const data = await this.req('GET', `/repos/${owner}/${repo}/pulls?state=${state}&per_page=10`);
    if (data.error) return data;
    return data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      head: pr.head.ref,
      base: pr.base.ref,
      url: pr.html_url,
      createdAt: pr.created_at,
    }));
  }

  async listIssues(owner, repo) {
    const data = await this.req('GET', `/repos/${owner}/${repo}/issues?state=open&per_page=20`);
    if (data.error) return data;
    return data.map((i) => ({ number: i.number, title: i.title, state: i.state, url: i.html_url, createdAt: i.created_at }));
  }

  async createIssue(owner, repo, { title, body, labels = [] }) {
    return await this.req('POST', `/repos/${owner}/${repo}/issues`, { title, body, labels });
  }

  async getCommits(owner, repo) {
    const data = await this.req('GET', `/repos/${owner}/${repo}/commits?per_page=10`);
    if (data.error) return data;
    return data.map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.slice(0, 100),
      author: c.commit.author.name,
      date: c.commit.author.date,
    }));
  }

  async searchCode(query, owner, repo) {
    const q = repo ? `${query}+repo:${owner}/${repo}` : `${query}+user:${owner}`;
    const data = await this.req('GET', `/search/code?q=${encodeURIComponent(q)}&per_page=10`);
    if (data.error) return data;
    return (data.items || []).map((i) => ({ path: i.path, repo: i.repository.full_name, url: i.html_url }));
  }
}

module.exports = { GitHubClient };
