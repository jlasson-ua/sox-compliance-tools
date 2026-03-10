const fs = require('fs');
const path = require('path');
const { createOctokitInteractive, fetchClosedPRs, fetchPRDetails, fetchPRCommits } = require('../github-client');

// UA Fiscal Year starts April 1
// FY26 = Apr 2025 - Mar 2026
// FY26Q1 = Apr-Jun 2025, FY26Q2 = Jul-Sep 2025, FY26Q3 = Oct-Dec 2025, FY26Q4 = Jan-Mar 2026
const QUARTER_MONTHS = {
  Q1: { startMonth: 4, endMonth: 6 },   // Apr-Jun
  Q2: { startMonth: 7, endMonth: 9 },   // Jul-Sep
  Q3: { startMonth: 10, endMonth: 12 }, // Oct-Dec
  Q4: { startMonth: 1, endMonth: 3 },   // Jan-Mar (next calendar year)
};

function parseQuarter(quarterStr) {
  // Parse formats: FY26Q1, FY2026Q1, 26Q1, Q1FY26
  const match = quarterStr.toUpperCase().match(/(?:FY)?(\d{2,4})Q([1-4])|Q([1-4])(?:FY)?(\d{2,4})/);
  if (!match) return null;
  
  let fyYear, quarter;
  if (match[1] && match[2]) {
    fyYear = match[1];
    quarter = match[2];
  } else {
    fyYear = match[4];
    quarter = match[3];
  }
  
  // Normalize 2-digit year to 4-digit
  if (fyYear.length === 2) {
    fyYear = (parseInt(fyYear) >= 50 ? '19' : '20') + fyYear;
  }
  
  const fy = parseInt(fyYear);
  const q = parseInt(quarter);
  const qDef = QUARTER_MONTHS[`Q${q}`];
  
  // Calculate calendar year for start of quarter
  // FY26Q1 (Apr-Jun) = calendar 2025
  // FY26Q4 (Jan-Mar) = calendar 2026
  let calendarYear = fy - 1; // FY26 starts in calendar 2025
  if (q === 4) {
    calendarYear = fy; // Q4 (Jan-Mar) is in the FY year itself
  }
  
  const startDate = new Date(calendarYear, qDef.startMonth - 1, 1);
  const endDate = new Date(calendarYear, qDef.endMonth, 0); // Last day of end month
  
  return {
    from: startDate.toISOString().split('T')[0],
    to: endDate.toISOString().split('T')[0],
    label: `FY${fy}Q${q}`,
  };
}

function listQuarters() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  // Determine current FY
  const currentFY = currentMonth >= 4 ? currentYear + 1 : currentYear;
  
  console.log('\nFiscal Year Quarter Reference (UA FY starts April 1):');
  console.log('=====================================================');
  
  for (let fy = currentFY - 1; fy <= currentFY + 1; fy++) {
    console.log(`\nFY${fy}:`);
    for (let q = 1; q <= 4; q++) {
      const parsed = parseQuarter(`FY${fy}Q${q}`);
      console.log(`  Q${q}: ${parsed.from} to ${parsed.to}`);
    }
  }
  console.log('');
}

// Skip words from PHP script
const SKIP_WORDS = [
  'sync team', 'team', 'down merge', 'downmerge', 'sync pr', 'tofu sync',
  'sync develop', 'sync release', 'release-', 'sync master', 'sync tofu',
  'branch sync', 'sync issue', 'sync triple', 'TTT sync', 'sync with release',
  'rebase with dev', 'create-stale'
];

function containsSkipWord(title) {
  const lower = title.toLowerCase();
  return SKIP_WORDS.some(word => lower.includes(word));
}

function extractJiraLink(title) {
  const prefix = title.split(':')[0].trim();
  if (/^[A-Z]+-\d+$/.test(prefix)) {
    return `https://underarmour.atlassian.net/browse/${prefix}`;
  }
  return '';
}

async function runAuditReport(options) {
  // Handle --list-quarters
  if (options.listQuarters) {
    listQuarters();
    return;
  }
  
  // Parse date range
  let dateFrom, dateTo, label;
  
  if (options.quarter) {
    const parsed = parseQuarter(options.quarter);
    if (!parsed) {
      console.error(`Error: Invalid quarter format "${options.quarter}". Use format like FY26Q1, FY2026Q2, etc.`);
      process.exit(1);
    }
    dateFrom = parsed.from;
    dateTo = parsed.to;
    label = parsed.label;
    console.log(`\nUsing quarter ${label}: ${dateFrom} to ${dateTo}`);
  } else if (options.from && options.to) {
    dateFrom = options.from;
    dateTo = options.to;
    label = `${dateFrom}_${dateTo}`;
  } else {
    console.error('Error: Either --quarter or both --from and --to are required.');
    console.error('Examples:');
    console.error('  --quarter FY26Q1');
    console.error('  --from 2024-04-01 --to 2024-06-30');
    console.error('\nRun with --list-quarters to see all quarter date ranges.');
    process.exit(1);
  }
  
  // Parse repo
  const [owner, repo] = options.repo.split('/');
  if (!owner || !repo) {
    console.error(`Error: Invalid repo format "${options.repo}". Use format owner/repo.`);
    process.exit(1);
  }
  
  const outputDir = path.resolve(options.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputFile = path.join(outputDir, `Github_ExportProductionPRList_${label.replace(/\//g, '_')}.csv`);
  
  console.log('\nSOX Audit Report Generator');
  console.log('==========================');
  console.log(`Repository: ${options.repo}`);
  console.log(`Base branch: ${options.base}`);
  console.log(`Date range: ${dateFrom} to ${dateTo}`);
  console.log(`Output: ${outputFile}`);
  console.log('');
  
  // Create GitHub client (with interactive prompt if no token found)
  const octokit = await createOctokitInteractive(options.token);
  
  // Fetch closed PRs
  console.log('Fetching closed PRs...');
  const issues = await fetchClosedPRs(
    octokit, owner, repo, options.base, dateFrom, dateTo,
    (page) => console.log(`  Page ${page}...`)
  );
  
  console.log(`\nFound ${issues.length} closed items. Processing...`);
  
  const results = [];
  const dateFromObj = new Date(dateFrom);
  const dateToObj = new Date(dateTo);
  
  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    
    // Skip if title contains skip words
    if (containsSkipWord(issue.title)) continue;
    
    // Check date range
    const closedAt = new Date(issue.closed_at);
    if (closedAt < dateFromObj || closedAt > dateToObj) continue;
    
    process.stdout.write(`\r  Processing PR #${issue.number} (${i + 1}/${issues.length})...`);
    
    // Helper for retrying API calls with delay
    const fetchWithRetry = async (fn, maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await fn();
        } catch (err) {
          if (attempt === maxRetries) throw err;
          // Wait longer on each retry (1s, 2s, 3s)
          await new Promise(r => setTimeout(r, attempt * 1000));
        }
      }
    };
    
    try {
      // Fetch PR details with retry
      const prNumber = issue.number;
      const details = await fetchWithRetry(() => fetchPRDetails(octokit, owner, repo, prNumber));
      
      // Skip if not merged
      if (!details.merged) continue;
      
      // Skip if base branch doesn't match
      const baseLabel = details.base?.label?.toLowerCase() || '';
      const baseRef = details.base?.ref?.toLowerCase() || '';
      if (!baseLabel.includes(options.base) && baseRef !== options.base) continue;
      
      // Fetch commits with retry
      const commits = await fetchWithRetry(() => fetchPRCommits(octokit, owner, repo, prNumber));
      
      // Small delay between PRs to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
      
      // Extract additional authors
      const firstAuthorEmail = commits[0]?.commit?.author?.email || '';
      const additionalAuthors = [];
      for (let j = 1; j < commits.length; j++) {
        const commitEmail = commits[j]?.commit?.author?.email;
        if (commitEmail && commitEmail !== firstAuthorEmail) {
          const name = commits[j].commit.author.name;
          const entry = `${name}|${commitEmail}`;
          if (!additionalAuthors.includes(entry)) {
            additionalAuthors.push(entry);
          }
        }
      }
      
      results.push({
        'Pull Request Title': issue.title,
        'Pull Request URL': issue.html_url,
        'Pull Request Creator': issue.user?.login || '',
        'JIRA Link': extractJiraLink(issue.title),
        'Pull Request Created At': details.created_at,
        'Pull Request Merged At': details.merged_at,
        'Pull Request Merged By': details.merged_by?.login || '',
        'First Code Author Name': commits[0]?.commit?.author?.name || '',
        'First Code Author Email': firstAuthorEmail,
        'Additional Authors (NAME|EMAIL)': additionalAuthors.join(','),
        'Pull Request Body': details.body || '',
      });
    } catch (err) {
      console.error(`\n  Error processing PR #${issue.number}: ${err.message.substring(0, 100)}`);
    }
  }
  
  console.log(`\n\nProcessed ${results.length} merged PRs matching criteria.`);
  
  if (results.length === 0) {
    console.log('No PRs found matching the criteria. No CSV file generated.');
    return;
  }
  
  // Write CSV
  const headers = Object.keys(results[0]);
  const csvLines = [headers.join(',')];
  
  for (const row of results) {
    const values = headers.map(h => {
      let val = row[h] || '';
      // Escape CSV values
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    });
    csvLines.push(values.join(','));
  }
  
  fs.writeFileSync(outputFile, csvLines.join('\n'), 'utf-8');
  console.log(`\nCSV saved to: ${outputFile}`);
  
  // Print summary
  console.log('\nSummary:');
  console.log(`  Total PRs: ${results.length}`);
  const uniqueAuthors = new Set(results.map(r => r['First Code Author Email']));
  console.log(`  Unique authors: ${uniqueAuthors.size}`);
}

function registerAuditReportCommand(program) {
  program
    .command('audit-report')
    .description('Generate SOX audit report CSV of merged PRs')
    .option('-q, --quarter <quarter>', 'Fiscal quarter (e.g., FY26Q1, FY2026Q2)')
    .option('--from <date>', 'Start date (YYYY-MM-DD)')
    .option('--to <date>', 'End date (YYYY-MM-DD)')
    .option('-r, --repo <owner/repo>', 'GitHub repository', 'ua-digital-commerce/ua-sfra')
    .option('-b, --base <branch>', 'Base branch filter', 'develop')
    .option('-o, --output <dir>', 'Output directory', './reports')
    .option('-t, --token <token>', 'GitHub personal access token (default: auto-detect from gh CLI)')
    .option('--list-quarters', 'Show fiscal quarter date ranges and exit')
    .action(runAuditReport);
}

module.exports = { registerAuditReportCommand, runAuditReport, parseQuarter };
