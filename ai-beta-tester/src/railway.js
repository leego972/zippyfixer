/**
 * Railway integration for ZippyFixer
 * Allows the AI to check deployments, service status, and logs.
 */

const RAILWAY_GQL = 'https://backboard.railway.app/graphql/v2';

class RailwayClient {
  constructor(token) {
    this.token = token;
  }

  async gql(query, variables = {}) {
    const res = await fetch(RAILWAY_GQL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    const data = await res.json();
    if (data.errors) return { error: data.errors[0]?.message || 'GraphQL error' };
    return data.data;
  }

  async listProjects() {
    const data = await this.gql(`
      query {
        projects {
          edges {
            node {
              id
              name
              description
              createdAt
              updatedAt
            }
          }
        }
      }
    `);
    if (data.error) return data;
    return (data.projects?.edges || []).map((e) => e.node);
  }

  async getProject(projectId) {
    const data = await this.gql(`
      query($id: String!) {
        project(id: $id) {
          id
          name
          description
          environments {
            edges { node { id name } }
          }
          services {
            edges {
              node {
                id
                name
                updatedAt
              }
            }
          }
        }
      }
    `, { id: projectId });
    if (data.error) return data;
    return data.project;
  }

  async getDeployments(projectId, environmentId) {
    const data = await this.gql(`
      query($projectId: String!, $environmentId: String) {
        deployments(
          input: { projectId: $projectId, environmentId: $environmentId }
          first: 10
        ) {
          edges {
            node {
              id
              status
              createdAt
              url
              staticUrl
              service { name }
              environment { name }
            }
          }
        }
      }
    `, { projectId, environmentId });
    if (data.error) return data;
    return (data.deployments?.edges || []).map((e) => e.node);
  }

  async getServiceStatus(serviceId, environmentId) {
    const data = await this.gql(`
      query($id: String!, $environmentId: String!) {
        service(id: $id) {
          id
          name
          serviceInstances {
            edges {
              node {
                healthcheckPath
                latestDeployment {
                  id
                  status
                  url
                  createdAt
                }
              }
            }
          }
        }
      }
    `, { id: serviceId, environmentId });
    if (data.error) return data;
    return data.service;
  }

  async getLogs(deploymentId) {
    const data = await this.gql(`
      query($deploymentId: String!) {
        deploymentLogs(deploymentId: $deploymentId) {
          timestamp
          message
          severity
        }
      }
    `, { deploymentId });
    if (data.error) return data;
    return (data.deploymentLogs || []).slice(-50);
  }

  async triggerRedeploy(serviceId, environmentId) {
    const data = await this.gql(`
      mutation($serviceId: String!, $environmentId: String!) {
        serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
      }
    `, { serviceId, environmentId });
    return data;
  }
}

module.exports = { RailwayClient };
