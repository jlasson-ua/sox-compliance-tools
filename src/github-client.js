const { Octokit } = require('@octokit/rest');
const { execSync } = require('child_process');
const fetch = require('node-fetch');

function getGitHubToken() {
  // Try to get token from gh CLI first
  try {
    const token = execSync('gh auth token', { encoding: 'utf-8' }).trim();
    if (token) return token;
  } catch (e) {
    // gh CLI not available or not authenticated
  }
  
  // Fall back to environment variable
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }
  
  return null;
}

function createOctokit(token) {
  const authToken = token || getGitHubToken();
  
  if (!authToken) {
    throw new Error('GitHub token required. Either:\n  - Run "gh auth login" to authenticate with gh CLI\n  - Set GITHUB_TOKEN environment variable\n  - Pass --token <token> option');
  }
  
  return new Octokit({ 
    auth: authToken,
    request: { fetch }
  });
}

async function fetchClosedPRs(octokit, owner, repo, base, dateFrom, dateTo, onPage) {
  const prs = [];
  let page = 1;
  
  while (true) {
    if (onPage) onPage(page);
    
    const { data } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: 'closed',
      base,
      per_page: 30,
      page,
      since: dateFrom,
    });
    
    if (data.length === 0) break;
    
    // Filter to only PRs (issues API returns both issues and PRs)
    const prItems = data.filter(item => item.pull_request);
    prs.push(...prItems);
    
    if (data.length < 30) break;
    page++;
  }
  
  return prs;
}

async function fetchPRDetails(octokit, owner, repo, prNumber) {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });
  return data;
}

async function fetchPRCommits(octokit, owner, repo, prNumber) {
  const { data } = await octokit.rest.pulls.listCommits({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });
  return data;
}

module.exports = {
  getGitHubToken,
  createOctokit,
  fetchClosedPRs,
  fetchPRDetails,
  fetchPRCommits,
};
