# SOX Compliance Tools

CLI toolkit for SOX compliance tasks at UA Digital Commerce.

## Features

### Screenshots Command
Capture full-page screenshots of GitHub Pull Requests with UTC timestamps for SOX compliance audits.

- **Timestamp banner**: Injects a fixed UTC timestamp at the top of each screenshot
- **Auto-organizes by Jira ticket**: Extracts ticket ID from PR title (e.g., `SFCC-1234`) and creates a folder per ticket
- **SSO support**: Opens a headed browser so you can log in to GitHub and complete SSO authentication
- **Batch processing**: Pass multiple URLs or read from a file

### Audit Report Command
Generate a CSV report of merged PRs for SOX audit compliance.

- **Fiscal quarter support**: Specify quarters like `FY26Q1` instead of date ranges
- **Auto-detects GitHub token**: Uses `gh` CLI authentication or `GITHUB_TOKEN` env var
- **Same output format**: Compatible with the original PHP script's CSV format
- **Filters sync PRs**: Automatically excludes downmerge, sync, and release PRs

## Requirements

- Node.js 18 or higher
- npm

## Installation

```bash
git clone https://github.com/jlasson-ua/sox-compliance-tools.git
cd sox-compliance-tools
npm install
npx playwright install chromium
```

## Usage

### Screenshots

#### Pass URLs directly

```bash
node bin/sox-tools.js screenshots \
  https://github.com/ua-digital-commerce/ua-sfra/pull/22515 \
  https://github.com/ua-digital-commerce/ua-sfra/pull/22278
```

#### Read URLs from a file

Create a text file with one URL per line:

```
https://github.com/ua-digital-commerce/ua-sfra/pull/22515
https://github.com/ua-digital-commerce/ua-sfra/pull/22278
https://github.com/ua-digital-commerce/ua-sfra/pull/22036
```

Then run:

```bash
node bin/sox-tools.js screenshots --file urls.txt
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --file <path>` | Read PR URLs from a file (one per line) | - |
| `-o, --output <dir>` | Output directory for screenshots | `./screenshots` |
| `-p, --pattern <regex>` | Jira ticket pattern to extract from PR title | `SFCC-\d+` |
| `-k, --keep-open` | Keep browser open after processing | `false` |

#### Examples

```bash
# Custom output directory
node bin/sox-tools.js screenshots --output ~/work/sox-audit --file urls.txt

# Different Jira pattern (e.g., PROJ-1234)
node bin/sox-tools.js screenshots --pattern "PROJ-\d+" --file urls.txt

# Keep browser open to process more URLs manually
node bin/sox-tools.js screenshots --keep-open --file urls.txt
```

### Output Structure

Screenshots are organized by Jira ticket:

```
screenshots/
├── SFCC-3168/
│   └── pr-22515.png
├── SFCC-4631/
│   └── pr-22278.png
└── SFCC-4871/
    └── pr-22036.png
```

If no Jira ticket is found in the PR title, the folder will be named `PR-{number}`.

### Audit Report

Generate a CSV of merged PRs for SOX compliance audit.

#### Using Fiscal Quarters (Recommended)

```bash
# Run for FY26 Q1 (Apr-Jun 2025)
node bin/sox-tools.js audit-report --quarter FY26Q1

# See all quarter date ranges
node bin/sox-tools.js audit-report --list-quarters
```

#### Using Date Range

```bash
node bin/sox-tools.js audit-report --from 2024-04-01 --to 2024-06-30
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-q, --quarter <quarter>` | Fiscal quarter (e.g., FY26Q1) | - |
| `--from <date>` | Start date (YYYY-MM-DD) | - |
| `--to <date>` | End date (YYYY-MM-DD) | - |
| `-r, --repo <owner/repo>` | GitHub repository | `ua-digital-commerce/ua-sfra` |
| `-b, --base <branch>` | Base branch filter | `develop` |
| `-o, --output <dir>` | Output directory | `./reports` |
| `-t, --token <token>` | GitHub PAT (auto-detects from `gh` CLI) | - |
| `--list-quarters` | Show fiscal quarter date ranges | - |

#### Output

CSV file with columns:
- Pull Request Title
- Pull Request URL
- Pull Request Creator
- JIRA Link
- Pull Request Created At
- Pull Request Merged At
- Pull Request Merged By
- First Code Author Name
- First Code Author Email
- Additional Authors (NAME|EMAIL)
- Pull Request Body

## Adding New Commands

To add a new SOX compliance command:

1. Create a new file in `src/commands/` (e.g., `src/commands/mycommand.js`)
2. Export a `registerMyCommand(program)` function that adds the subcommand
3. Import and call it in `bin/sox-tools.js`

## License

MIT
