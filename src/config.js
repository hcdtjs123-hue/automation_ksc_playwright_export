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

function parseAmount(value, fallback) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getEnvValue(name, fallback) {
  if (Object.prototype.hasOwnProperty.call(process.env, name)) {
    return String(process.env[name] ?? '');
  }

  return fallback;
}

const CONFIG = {
  accurateUrl: process.env.ACCURATE_URL || 'https://account.accurate.id/?lang=US',
  companyName: process.env.ACCURATE_COMPANY_NAME || 'KSC',
  productLabel: process.env.ACCURATE_PRODUCT_LABEL || 'Accurate Online',
  sidebarLabel: process.env.ACCURATE_SIDEBAR_LABEL || 'Reports',
  reportListLabel: process.env.ACCURATE_REPORT_LIST_LABEL || 'Report List',
  financialLabel: process.env.ACCURATE_FINANCIAL_LABEL || 'Financial',
  profitLossLabel: process.env.ACCURATE_PROFIT_LOSS_LABEL || 'Profit/Loss (Standard)',
  profitLossMultiPeriodLabel: process.env.ACCURATE_PROFIT_LOSS_MULTI_PERIOD_LABEL || 'Profit/Loss (Multi Period)',
  reportFileTitle: process.env.ACCURATE_REPORT_FILE_TITLE || 'AYO v3',
  monthlyTarget: parseAmount(process.env.ACCURATE_MONTHLY_TARGET, 0),
  browserName: process.env.PLAYWRIGHT_BROWSER || 'chromium',
  browserChannel: getEnvValue('PLAYWRIGHT_BROWSER_CHANNEL', 'chrome'),
  browserExecutablePath: getEnvValue('PLAYWRIGHT_BROWSER_EXECUTABLE_PATH', ''),
  chromeProfileDirectory: getEnvValue('PLAYWRIGHT_CHROME_PROFILE_DIRECTORY', 'Default'),
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
  requireConfigValue('productLabel');
  requireConfigValue('sidebarLabel');
  requireConfigValue('reportListLabel');
  requireConfigValue('financialLabel');
  requireConfigValue('profitLossLabel');
  requireConfigValue('profitLossMultiPeriodLabel');
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
    productLabel: CONFIG.productLabel,
    browserName: CONFIG.browserName,
    browserChannel: CONFIG.browserChannel,
    browserExecutablePath: CONFIG.browserExecutablePath,
    chromeProfileDirectory: CONFIG.chromeProfileDirectory,
    reportFileTitle: CONFIG.reportFileTitle,
    monthlyTarget: CONFIG.monthlyTarget,
    profitLossMultiPeriodLabel: CONFIG.profitLossMultiPeriodLabel,
    multiPeriodFromMonth: process.env.MULTI_PERIOD_ACCURATE_FROM_MONTH || '',
    multiPeriodFromYear: process.env.MULTI_PERIOD_ACCURATE_FROM_YEAR || '',
    multiPeriodToMonth: process.env.MULTI_PERIOD_ACCURATE_TO_MONTH || '',
    multiPeriodToYear: process.env.MULTI_PERIOD_ACCURATE_TO_YEAR || '',
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
