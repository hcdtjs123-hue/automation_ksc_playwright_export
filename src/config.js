const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const PROJECT_ROOT = path.resolve(__dirname, '..');

function parseBoolean(value, fallback) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const CONFIG = {
  accurateUrl: process.env.ACCURATE_URL || 'https://account.accurate.id/?lang=US',
  companyName: process.env.ACCURATE_COMPANY_NAME || 'KSC',
  sidebarLabel: process.env.ACCURATE_SIDEBAR_LABEL || 'Reports',
  reportListLabel: process.env.ACCURATE_REPORT_LIST_LABEL || 'Report List',
  financialLabel: process.env.ACCURATE_FINANCIAL_LABEL || 'Financial',
  profitLossLabel: process.env.ACCURATE_PROFIT_LOSS_LABEL || 'Profit/Loss (Standard)',
  reportFileTitle: process.env.ACCURATE_REPORT_FILE_TITLE || 'AYO v3',
  browserName: process.env.PLAYWRIGHT_BROWSER || 'chromium',
  browserChannel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'chrome',
  browserExecutablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE_PATH || '',
  chromeProfileDirectory: process.env.PLAYWRIGHT_CHROME_PROFILE_DIRECTORY || 'Default',
  outputDir:
    process.env.ACCURATE_OUTPUT_DIR || path.join(PROJECT_ROOT, 'output', 'playwright', 'ksc_downloads'),
  userDataDir:
    process.env.PLAYWRIGHT_USER_DATA_DIR || path.join(PROJECT_ROOT, 'output', 'playwright', 'ksc_user-data'),
  headless: parseBoolean(process.env.PLAYWRIGHT_HEADLESS, false),
  slowMo: parseNumber(process.env.PLAYWRIGHT_SLOW_MO, 300),
  ahkExecutable:
    process.env.AHK_EXE_PATH || 'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey64.exe',
  ahkScriptPath:
    process.env.AHK_SCRIPT_PATH ||
    path.join(PROJECT_ROOT, 'scripts', 'windows', 'ksc-save-export.ahk'),
};

function requireEnv(name) {
  const value = (process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function validateRuntimeConfig() {
  requireEnv('ACCURATE_EMAIL');
  requireEnv('ACCURATE_PASSWORD');
  requireConfigValue('accurateUrl');
  requireConfigValue('companyName');
  requireConfigValue('sidebarLabel');
  requireConfigValue('reportListLabel');
  requireConfigValue('financialLabel');
  requireConfigValue('profitLossLabel');
}

function requireConfigValue(name) {
  const value = CONFIG[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required config value: ${name}`);
  }

  return value;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function logStartupConfig() {
  console.log('Runtime config:', {
    accurateUrl: CONFIG.accurateUrl,
    companyName: CONFIG.companyName,
    browserName: CONFIG.browserName,
    browserChannel: CONFIG.browserChannel,
    browserExecutablePath: CONFIG.browserExecutablePath,
    chromeProfileDirectory: CONFIG.chromeProfileDirectory,
    reportFileTitle: CONFIG.reportFileTitle,
    outputDir: CONFIG.outputDir,
    userDataDir: CONFIG.userDataDir,
    headless: CONFIG.headless,
    slowMo: CONFIG.slowMo,
    platform: process.platform,
  });
}

module.exports = {
  CONFIG,
  PROJECT_ROOT,
  ensureDir,
  logStartupConfig,
  requireEnv,
  requireConfigValue,
  validateRuntimeConfig,
};
