const { chromium } = require('playwright');
const readline = require('readline');

async function waitForEnter(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

async function launchBrowser() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  return { browser, context, page };
}

async function loginToGitHub(page) {
  await page.goto('https://github.com/login');
  console.log('\n🔐 Browser opened at GitHub login page.');
  console.log('   Please log in and complete SSO authentication.\n');
  await waitForEnter('Press Enter when you are logged in and ready to continue...');
}

module.exports = {
  launchBrowser,
  loginToGitHub,
  waitForEnter
};
