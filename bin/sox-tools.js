#!/usr/bin/env node

const { program } = require('commander');
const { registerScreenshotsCommand } = require('../src/commands/screenshots');
const { registerAuditReportCommand } = require('../src/commands/audit-report');
const { registerSetupCommand } = require('../src/commands/setup');

program
  .name('sox-tools')
  .description('SOX compliance tools for UA Digital Commerce')
  .version('1.0.0');

// Register subcommands
registerSetupCommand(program);
registerScreenshotsCommand(program);
registerAuditReportCommand(program);

program.parse();
