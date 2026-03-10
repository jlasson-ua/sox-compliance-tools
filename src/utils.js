const fs = require('fs');
const path = require('path');

function extractTicket(title, pattern = 'SFCC-\\d+') {
  const regex = new RegExp(pattern);
  const match = title.match(regex);
  return match ? match[0] : null;
}

function extractPrNumber(url) {
  const match = url.match(/\/pull\/(\d+)/);
  return match ? match[1] : 'unknown';
}

function readUrlsFromFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const content = fs.readFileSync(absolutePath, 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && line.startsWith('http'));
}

function printSummaryTable(results) {
  console.log('\n' + '='.repeat(80));
  console.log('SCREENSHOT SUMMARY');
  console.log('='.repeat(80));
  console.log(
    'Ticket'.padEnd(15) +
    'PR #'.padEnd(10) +
    'File Path'
  );
  console.log('-'.repeat(80));
  
  for (const r of results) {
    console.log(
      r.ticket.padEnd(15) +
      r.prNumber.padEnd(10) +
      r.path
    );
  }
  
  console.log('='.repeat(80));
  console.log(`Total: ${results.length} screenshots captured`);
  console.log('');
}

module.exports = {
  extractTicket,
  extractPrNumber,
  readUrlsFromFile,
  printSummaryTable
};
