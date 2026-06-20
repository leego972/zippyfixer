/**
 * Vercel integration for ReviewGuard
 * Read projects, deployments, logs, and trigger redeploys via Vercel REST API.
 */

const VERCEL_API = 'https://api.vercel.com';

class VercelClient {
  constructor(token) {
    this.token = token;
    this.headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async req(method, path, body) {
    const res = await fetch(`${VERCEL_API}${path}`, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error?.message || `HTTP ${res.status}` };
    return data;
  }

  async listProjects() {
    const data = await this.req('GET', '/v9/projects?limit=20');
    if (data.error) return data;
    return (data.projects || []).map(p => ({
      id: p.id,
      name: p.name,
      framework: p.framework,
      productionUrl: p.alias?.[0]?.domain ? `https://${p.alias[0].domain}` : null,
      updatedAt: p.updatedAt,
    }));
  }

  async getDeployments(projectId, limit = 10) {
    const data = await this.req('GET', `/v6/deployments?projectId=${projectId}&limit=${limit}`);
    if (data.error) return data;
    return (data.deployments || []).map(d => ({
      id: d.uid,
      url: `https://${d.url}`,
      state: d.state,
      target: d.target,
      createdAt: d.createdAt,
      meta: d.meta,
    }));
  }

  async getLogs(deploymentId) {
    const data = await this.req('GET', `/v2/deployments/${deploymentId}/events`);
    if (data.error) return data;
    return (Array.isArray(data) ? data : []).slice(-50).map(e => ({
      type: e.type,
      text: e.payload?.text || e.payload?.info?.message || '',
      date: e.date,
    }));
  }

  async redeployProject(deploymentId) {
    const data = await this.req('POST', `/v13/deployments?forceNew=1`, {
      deploymentId,
    });
    if (data.error) return data;
    return { ok: true, url: data.url ? `https://${data.url}` : null, id: data.id };
  }

  async getDomains(projectId) {
    const data = await this.req('GET', `/v9/projects/${projectId}/domains`);
    if (data.error) return data;
    return (data.domains || []).map(d => ({ name: d.name, verified: d.verified }));
  }
}

module.exports = { VercelClient };
