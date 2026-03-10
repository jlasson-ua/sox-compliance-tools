const readline = require('readline');
const { validateToken, saveToken, getSavedToken, getGitHubToken, CONFIG_FILE } = require('../github-client');

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

async function question(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function runSetup() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           SOX Compliance Tools - Setup Wizard                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  // Check existing auth
  const existingToken = getGitHubToken();
  if (existingToken) {
    console.log('Checking existing authentication...');
    const result = await validateToken(existingToken);
    if (result.valid) {
      console.log(`\n✓ Already authenticated as: ${result.user}`);
      console.log('\nYou\'re all set! Run commands like:');
      console.log('  sox-tools audit-report --quarter FY26Q1');
      console.log('  sox-tools screenshots --file urls.txt\n');
      return;
    } else {
      console.log('✗ Existing token is invalid or expired.\n');
    }
  }
  
  console.log('To use this tool, you need a GitHub Personal Access Token (PAT).\n');
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  How to create a PAT:                                           │');
  console.log('│                                                                  │');
  console.log('│  1. Go to: https://github.com/settings/tokens/new               │');
  console.log('│     (or Settings > Developer settings > Personal access tokens) │');
  console.log('│                                                                  │');
  console.log('│  2. Give it a name like "sox-compliance-tools"                  │');
  console.log('│                                                                  │');
  console.log('│  3. Select expiration (recommend 90 days or custom)             │');
  console.log('│                                                                  │');
  console.log('│  4. Select scopes:                                              │');
  console.log('│     ✓ repo (Full control of private repositories)               │');
  console.log('│                                                                  │');
  console.log('│  5. Click "Generate token" and copy it                          │');
  console.log('└─────────────────────────────────────────────────────────────────┘\n');
  
  const rl = createReadline();
  
  try {
    const token = (await question(rl, 'Paste your GitHub Personal Access Token: ')).trim();
    
    if (!token) {
      console.log('\nNo token provided. Setup cancelled.\n');
      return;
    }
    
    console.log('\nValidating token...');
    const result = await validateToken(token);
    
    if (!result.valid) {
      console.log(`\n✗ Token validation failed: ${result.error}`);
      console.log('Please check that your token is correct and has the "repo" scope.\n');
      return;
    }
    
    console.log(`✓ Token valid! Authenticated as: ${result.user}`);
    
    // Save token
    saveToken(token);
    console.log(`✓ Token saved to: ${CONFIG_FILE}`);
    
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                     Setup Complete!                           ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    console.log('You can now run commands like:');
    console.log('  node bin/sox-tools.js audit-report --quarter FY26Q1');
    console.log('  node bin/sox-tools.js audit-report --list-quarters');
    console.log('  node bin/sox-tools.js screenshots --file urls.txt\n');
    
  } finally {
    rl.close();
  }
}

function registerSetupCommand(program) {
  program
    .command('setup')
    .description('Configure GitHub authentication for sox-tools')
    .action(runSetup);
}

module.exports = { registerSetupCommand, runSetup };
