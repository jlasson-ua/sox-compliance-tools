#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const { launchBrowser, loginToGitHub } = require('../src/browser');
const { captureScreenshot } = require('../src/screenshot');
const { readUrlsFromFile, printSummaryTable } = require('../src/utils');

program
  .name('sox-screenshots')
  .description('Capture GitHub PR screenshots with timestamps for SOX compliance')
  .version('1.0.0')
  .option('-f, --file <path>', 'Read PR URLs from a file (one per line)')
  .option('-o, --output <dir>', 'Output directory for screenshots', './screenshots')
  .option('-p, --pattern <regex>', 'Jira ticket pattern to extract from PR title', 'SFCC-\\d+')
  .option('-k, --keep-open', 'Keep browser open after processing', false)
  .argument('[urls...]', 'PR URLs to screenshot')
  .action(async (urls, options) => {
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
  });

program.parse();
