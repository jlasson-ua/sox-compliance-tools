const path = require('path');
const { readUrlsFromFile, printSummaryTable } = require('../utils');

async function runScreenshots(urls, options) {
  // Lazy-load Playwright dependencies only when this command runs
  const { launchBrowser, loginToGitHub } = require('../browser');
  const { captureScreenshot } = require('../screenshot');
  let allUrls = [...urls];
  
  if (options.file) {
    const fileUrls = readUrlsFromFile(options.file);
    allUrls = [...allUrls, ...fileUrls];
  }
  
  if (allUrls.length === 0) {
    console.error('Error: No URLs provided. Pass URLs as arguments or use --file option.');
    process.exit(1);
  }
  
  const outputDir = path.resolve(options.output);
  console.log(`\nSOX PR Screenshot Tool`);
  console.log(`======================`);
  console.log(`URLs to process: ${allUrls.length}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Jira pattern: ${options.pattern}`);
  console.log(`Keep browser open: ${options.keepOpen}`);
  
  const { browser, page } = await launchBrowser();
  
  try {
    await loginToGitHub(page);
    
    const results = [];
    
    for (let i = 0; i < allUrls.length; i++) {
      const url = allUrls[i];
      console.log(`\n[${i + 1}/${allUrls.length}] Processing: ${url}`);
      
      try {
        const result = await captureScreenshot(page, url, outputDir, options.pattern);
        results.push(result);
        console.log(`  ✓ Saved: ${result.ticket}/pr-${result.prNumber}.png`);
      } catch (err) {
        console.error(`  ✗ Failed: ${err.message}`);
        results.push({
          ticket: 'ERROR',
          prNumber: url,
          path: err.message,
          title: ''
        });
      }
    }
    
    printSummaryTable(results);
    
    if (options.keepOpen) {
      console.log('Browser left open. Press Ctrl+C to exit when done.');
      await new Promise(() => {});
    }
  } finally {
    if (!options.keepOpen) {
      await browser.close();
    }
  }
}

function registerScreenshotsCommand(program) {
  program
    .command('screenshots')
    .description('Capture GitHub PR screenshots with timestamps for SOX compliance')
    .option('-f, --file <path>', 'Read PR URLs from a file (one per line)')
    .option('-o, --output <dir>', 'Output directory for screenshots', './screenshots')
    .option('-p, --pattern <regex>', 'Jira ticket pattern to extract from PR title', 'SFCC-\\d+')
    .option('-k, --keep-open', 'Keep browser open after processing', false)
    .argument('[urls...]', 'PR URLs to screenshot')
    .action(runScreenshots);
}

module.exports = { registerScreenshotsCommand, runScreenshots };
