const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { chromium } = require('playwright');

function exists(targetPath) {
  try {
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

function envValue(name) {
  return (process.env[name] || '').trim();
}

function printCheck(label, ok, detail) {
  const status = ok ? 'OK' : 'FAIL';
  console.log(`[${status}] ${label}${detail ? ` - ${detail}` : ''}`);
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const envPath = path.join(projectRoot, '.env');
  const ahkScriptPath =
    process.env.AHK_SCRIPT_PATH ||
    path.join(projectRoot, 'scripts', 'windows', 'ksc-save-export.ahk');
  const browserName = process.env.PLAYWRIGHT_BROWSER || 'chromium';
  const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'chrome';
  const browserExecutablePath = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE_PATH || '';
  const chromeProfileDirectory = process.env.PLAYWRIGHT_CHROME_PROFILE_DIRECTORY || 'Default';
  const outputDir = process.env.ACCURATE_OUTPUT_DIR || path.join(projectRoot, 'output', 'playwright', 'ksc_downloads');
  const userDataDir =
    process.env.PLAYWRIGHT_USER_DATA_DIR || path.join(projectRoot, 'output', 'playwright', 'ksc_user-data');
  const chromiumPath = chromium.executablePath();

  printCheck('.env file', exists(envPath), envPath);
  printCheck('ACCURATE_EMAIL', Boolean(envValue('ACCURATE_EMAIL')), 'set required login email');
  printCheck('ACCURATE_PASSWORD', Boolean(envValue('ACCURATE_PASSWORD')), 'set required login password');
  printCheck('ACCURATE_REPORT_FILE_TITLE', Boolean(envValue('ACCURATE_REPORT_FILE_TITLE') || 'AYO v3'), 'used in final filename');
  printCheck('ACCURATE_MONTHLY_TARGET', Boolean(envValue('ACCURATE_MONTHLY_TARGET')), 'used for Target/Bln and %Pencapaian');
  printCheck('DAILY_ACCURATE_START_DATE', Boolean(envValue('DAILY_ACCURATE_START_DATE')), 'required for first export');
  printCheck('DAILY_ACCURATE_END_DATE', Boolean(envValue('DAILY_ACCURATE_END_DATE')), 'required for first export');
  printCheck('MTD_ACCURATE_START_DATE', Boolean(envValue('MTD_ACCURATE_START_DATE')), 'required for second export');
  printCheck('MTD_ACCURATE_END_DATE', Boolean(envValue('MTD_ACCURATE_END_DATE')), 'required for second export');
  printCheck('YTD_ACCURATE_START_DATE', Boolean(envValue('YTD_ACCURATE_START_DATE')), 'required for third export');
  printCheck('YTD_ACCURATE_END_DATE', Boolean(envValue('YTD_ACCURATE_END_DATE')), 'required for third export');
  printCheck('AHK script', exists(ahkScriptPath), ahkScriptPath);
  printCheck('Browser target', Boolean(browserName), `${browserName}${browserChannel ? ` via channel ${browserChannel}` : ''}`);
  printCheck('Chrome profile directory', Boolean(chromeProfileDirectory), chromeProfileDirectory);
  if (browserExecutablePath) {
    printCheck('Browser executable', exists(browserExecutablePath), browserExecutablePath);
  } else {
    console.log('[INFO] Browser executable path not set; Playwright channel/browser default will be used.');
  }
  printCheck('Playwright Chromium', exists(chromiumPath), chromiumPath);

  if (!exists(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  printCheck('Output directory', exists(outputDir), outputDir);

  if (!exists(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  printCheck('Persistent user data dir', exists(userDataDir), userDataDir);

  if (process.platform === 'win32') {
    const ahkExePath =
      process.env.AHK_EXE_PATH || 'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey64.exe';
    printCheck('AutoHotkey executable', exists(ahkExePath), ahkExePath);
  } else {
    console.log('[INFO] AutoHotkey executable check skipped on non-Windows platform.');
  }
}

main();
