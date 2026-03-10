const path = require('path');
const fs = require('fs');
const { extractTicket, extractPrNumber } = require('./utils');

async function injectTimestampBanner(page) {
  await page.evaluate(() => {
    const existing = document.getElementById('sox-timestamp-banner');
    if (existing) existing.remove();
    
    const ts = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');
    const banner = document.createElement('div');
    banner.id = 'sox-timestamp-banner';
    banner.textContent = 'Screenshot taken: ' + ts;
    banner.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:#f0f0f0;color:#000;font-size:14px;padding:8px 16px;z-index:999999;border-bottom:1px solid #ccc;font-family:monospace;';
    document.body.prepend(banner);
  });
}

async function captureScreenshot(page, url, outputDir, pattern) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  const title = await page.title();
  const ticket = extractTicket(title, pattern);
  const prNumber = extractPrNumber(url);
  
  const folderName = ticket || `PR-${prNumber}`;
  const folderPath = path.join(outputDir, folderName);
  
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  
  await injectTimestampBanner(page);
  
  const screenshotPath = path.join(folderPath, `pr-${prNumber}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  
  return {
    ticket: folderName,
    prNumber,
    path: screenshotPath,
    title
  };
}

module.exports = {
  captureScreenshot,
  injectTimestampBanner
};
