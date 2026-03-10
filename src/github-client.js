const { Octokit } = require('@octokit/rest');
const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const os = require('os');
const fetch = require('node-fetch');

const CONFIG_DIR = path.join(os.homedir(), '.sox-tools');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {
    // Config file corrupted or unreadable
  }
  return {};
}

function saveConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

function saveToken(token) {
  const config = readConfig();
  config.github_token = token;
  saveConfig(config);
}

function getSavedToken() {
  const config = readConfig();
  return config.github_token || null;
}

function getGitHubToken() {
  // 1. Try environment variable
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }
  
  // 2. Try gh CLI
  try {
    const token = execSync('gh auth token', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    if (token) return token;
  } catch (e) {
    // gh CLI not available or not authenticated
  }
  
  // 3. Try saved token in ~/.sox-tools/config.json
  const savedToken = getSavedToken();
  if (savedToken) return savedToken;
  
  return null;
}

async function promptForToken() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│  No GitHub token found.                                     │');
  console.log('│                                                             │');
  console.log('│  To create a Personal Access Token (PAT):                   │');
  console.log('│  1. Go to: https://github.com/settings/tokens/new           │');
  console.log('│  2. Select scopes: repo (full control)                      │');
  console.log('│  3. Generate and copy the token                             │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');
  
  return new Promise((resolve) => {
    rl.question('Enter your GitHub Personal Access Token: ', async (token) => {
      token = token.trim();
      if (!token) {
        rl.close();
        resolve(null);
        return;
      }
      
      rl.question('Save this token for future use? (y/n): ', (answer) => {
        rl.close();
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          saveToken(token);
          console.log(`Token saved to ${CONFIG_FILE}\n`);
        }
        resolve(token);
      });
    });
  });
}

async function validateToken(token) {
  try {
    const octokit = new Octokit({ auth: token, request: { fetch } });
    const { data } = await octokit.rest.users.getAuthenticated();
    return { valid: true, user: data.login };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

function createOctokit(token) {
  const authToken = token || getGitHubToken();
  
  if (!authToken) {
    throw new Error('GitHub token required. Run: sox-tools setup');
  }
  
  return new Octokit({ 
    auth: authToken,
    request: { fetch }
  });
}

async function createOctokitInteractive(token) {
  let authToken = token || getGitHubToken();
  
  if (!authToken) {
    authToken = await promptForToken();
  }
  
  if (!authToken) {
    throw new Error('GitHub token required. Run: sox-tools setup');
  }
  
  return new Octokit({ 
    auth: authToken,
    request: { fetch }
  });
}

async function fetchClosedPRs(octokit, owner, repo, base, dateFrom, dateTo, onPage) {
  const prs = [];
  let page = 1;
  const dateFromObj = new Date(dateFrom);
  const MAX_PAGES = 50; // Safety limit to prevent infinite loops
  
  while (page <= MAX_PAGES) {
    if (onPage) onPage(page);
    
    // Fetch closed issues sorted by closed date (most recent first)
    // We use 'since' as a rough filter but rely on post-filtering for exact range
    const { data } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: 'closed',
      per_page: 100,
      page,
      sort: 'created',
      direction: 'desc',
    });
    
    if (data.length === 0) break;
    
    // Filter to only PRs (issues API returns both issues and PRs)
    const prItems = data.filter(item => item.pull_request);
    prs.push(...prItems);
    
    // Check if ALL items on this page were closed before our date range
    // This indicates we've gone far enough back
    const allBeforeDateRange = data.every(item => {
      const closedAt = new Date(item.closed_at);
      return closedAt < dateFromObj;
    });
    
    if (allBeforeDateRange) {
      break;
    }
    
    if (data.length < 100) break;
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
  createOctokitInteractive,
  fetchClosedPRs,
  fetchPRDetails,
  fetchPRCommits,
  validateToken,
  saveToken,
  getSavedToken,
  CONFIG_FILE,
};
