# SOX PR Screenshots

CLI tool to capture full-page screenshots of GitHub Pull Requests with UTC timestamps for SOX compliance audits.

## Features

- **Timestamp banner**: Injects a fixed UTC timestamp at the top of each screenshot
- **Auto-organizes by Jira ticket**: Extracts ticket ID from PR title (e.g., `SFCC-1234`) and creates a folder per ticket
- **SSO support**: Opens a headed browser so you can log in to GitHub and complete SSO authentication
- **Batch processing**: Pass multiple URLs or read from a file

## Requirements

- Node.js 18 or higher
- npm

## Installation

```bash
git clone https://github.com/jlasson-ua/sox-pr-screenshots.git
cd sox-pr-screenshots
npm install
npx playwright install chromium
```

## Usage

### Pass URLs directly

```bash
node bin/sox-screenshots.js \
  https://github.com/ua-digital-commerce/ua-sfra/pull/22515 \
  https://github.com/ua-digital-commerce/ua-sfra/pull/22278
```

### Read URLs from a file

Create a text file with one URL per line:

```
https://github.com/ua-digital-commerce/ua-sfra/pull/22515
https://github.com/ua-digital-commerce/ua-sfra/pull/22278
https://github.com/ua-digital-commerce/ua-sfra/pull/22036
```

Then run:

```bash
node bin/sox-screenshots.js --file urls.txt
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --file <path>` | Read PR URLs from a file (one per line) | - |
| `-o, --output <dir>` | Output directory for screenshots | `./screenshots` |
| `-p, --pattern <regex>` | Jira ticket pattern to extract from PR title | `SFCC-\d+` |
| `-k, --keep-open` | Keep browser open after processing | `false` |

### Examples

```bash
# Custom output directory
node bin/sox-screenshots.js --output ~/work/sox-audit --file urls.txt

# Different Jira pattern (e.g., PROJ-1234)
node bin/sox-screenshots.js --pattern "PROJ-\d+" --file urls.txt

# Keep browser open to process more URLs manually
node bin/sox-screenshots.js --keep-open --file urls.txt
```

## Output Structure

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

## How It Works

1. Launches a headed Chromium browser
2. Navigates to GitHub login and waits for you to authenticate (including SSO)
3. For each PR URL:
   - Navigates to the page
   - Extracts the Jira ticket from the page title
   - Injects a UTC timestamp banner at the top of the page
   - Takes a full-page screenshot
   - Saves to `{output}/{TICKET}/pr-{number}.png`
4. Prints a summary table of all captured screenshots

## License

MIT
