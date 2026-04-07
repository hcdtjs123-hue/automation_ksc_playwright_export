const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { chromium, firefox } = require('playwright');

const PROJECT_ROOT = __dirname;

const CONFIG = {
  accurateUrl: process.env.ACCURATE_URL || 'https://account.accurate.id/?lang=US',
  companyName: process.env.ACCURATE_COMPANY_NAME || 'KSC',
  sidebarLabel: process.env.ACCURATE_SIDEBAR_LABEL || 'Reports',
  reportListLabel: process.env.ACCURATE_REPORT_LIST_LABEL || 'Report List',
  financialLabel: process.env.ACCURATE_FINANCIAL_LABEL || 'Financial',
  profitLossLabel: process.env.ACCURATE_PROFIT_LOSS_LABEL || 'Profit/Loss (Standard)',
  browserName: 'chromium',
  browserExecutablePath: '',
  outputDir:
    process.env.ACCURATE_OUTPUT_DIR || path.join(PROJECT_ROOT, 'output', 'playwright', 'downloads'),
  userDataDir:
    process.env.PLAYWRIGHT_USER_DATA_DIR || path.join(PROJECT_ROOT, 'output', 'playwright', 'user-data'),
  headless: parseBoolean(process.env.PLAYWRIGHT_HEADLESS, false),
  slowMo: parseNumber(process.env.PLAYWRIGHT_SLOW_MO, 300),
  ahkExecutable:
    process.env.AHK_EXE_PATH || 'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey64.exe',
  ahkScriptPath:
    process.env.AHK_SCRIPT_PATH ||
    path.join(PROJECT_ROOT, 'scripts', 'windows', 'save-accurate-export.ahk'),
};

function parseBoolean(value, fallback) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function requireEnv(name) {
  const value = (process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getBrowserType(browserName) {
  const normalized = String(browserName || 'chromium').trim().toLowerCase();
  if (normalized === 'firefox') return firefox;
  return chromium;
}

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

async function safeWait(target, ms) {
  try {
    if (target && !target.isClosed()) await target.waitForTimeout(ms);
  } catch {}
}

async function realClick(page, box) {
  if (!box) throw new Error('No bounding box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await safeWait(page, 200);
  await page.mouse.down();
  await safeWait(page, 100);
  await page.mouse.up();
}

function getLivePages(ctx) {
  return ctx.pages().filter((page) => !page.isClosed());
}

function getNewestPage(ctx) {
  const pages = getLivePages(ctx);
  return pages[pages.length - 1];
}

async function getUsablePage(ctx, preferredPage = null) {
  if (preferredPage && !preferredPage.isClosed()) return preferredPage;
  const newest = getNewestPage(ctx);
  if (!newest) throw new Error('No live page available');
  return newest;
}

async function waitOverlayGone(page) {
  await page.locator('.window-overlay').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  await page.locator('.busy-load-container').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
}

function runAutoHotkeySaveDialog() {
  if (process.platform !== 'win32') {
    throw new Error(
      [
        'Native Save dialog detected, but AutoHotkey fallback only works on Windows.',
        `Current platform: ${process.platform}.`,
      ].join(' ')
    );
  }

  return new Promise((resolve, reject) => {
    execFile(
      CONFIG.ahkExecutable,
      [CONFIG.ahkScriptPath],
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

async function fillLogin(page) {
  const email = requireEnv('ACCURATE_EMAIL');
  const password = requireEnv('ACCURATE_PASSWORD');
  const emailInput = page.locator('input[name="account"]:visible').first();
  const passwordInput = page.locator('input[name="password"]:visible').first();

  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await passwordInput.waitFor({ state: 'visible', timeout: 15000 });

  await emailInput.click({ clickCount: 3 });
  await safeWait(page, 150);
  await page.keyboard.press('Backspace');
  await safeWait(page, 200);
  await emailInput.type(email, { delay: 100 });

  await safeWait(page, 500);

  await passwordInput.click({ clickCount: 3 });
  await safeWait(page, 150);
  await page.keyboard.press('Backspace');
  await safeWait(page, 200);
  await passwordInput.type(password, { delay: 100 });

  console.log('Login filled safely');
}

async function openCompany(page, ctx) {
  console.log('Opening company...');
  const el = page.getByText(new RegExp(`^${escapeRegExp(CONFIG.companyName)}$`)).first();
  await el.waitFor({ state: 'visible', timeout: 20000 });

  const box = await el.locator('xpath=../../..').boundingBox();
  await realClick(page, box);
  await safeWait(page, 4000);

  const app = getNewestPage(ctx);
  await app.waitForLoadState('domcontentloaded').catch(() => {});
  await safeWait(app, 4000);

  console.log('App page:', app.url());
  return app;
}

async function clickSidebar(page, label) {
  console.log('Sidebar:', label);
  await waitOverlayGone(page);

  const node = page.locator(`h3:has-text("${label}")`).first();
  await node.waitFor({ state: 'attached', timeout: 15000 });

  const parents = ['..', '../..', '../../..', '../../../..'];
  for (const parent of parents) {
    const target = node.locator(`xpath=${parent}`).first();
    const box = await target.boundingBox().catch(() => null);
    const visible = await target.isVisible().catch(() => false);
    if (!visible || !box) continue;

    await realClick(page, box);
    await safeWait(page, 2000);
    console.log(`Clicked sidebar: ${label}`);
    return;
  }

  throw new Error(`Sidebar failed: ${label}`);
}

async function findPageWithText(ctx, text, timeout = 15000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const pages = getLivePages(ctx);

    for (const page of pages.slice().reverse()) {
      try {
        const locator = page.getByText(text, { exact: false }).first();
        const visible = await locator.isVisible().catch(() => false);
        if (visible) return page;
      } catch {}
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return null;
}

async function clickTile(ctx, preferredPage, label) {
  console.log('Click tile:', label);

  let page = await getUsablePage(ctx, preferredPage);
  page = (await findPageWithText(ctx, label, 5000)) || page;
  const exactLabel = new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`);

  await waitOverlayGone(page);

  const beforePages = getLivePages(ctx);
  const beforeCount = beforePages.length;

  const targetLocators = [
    page.locator('li.index-report-tab-option').filter({
      has: page.locator('span[data-bind="text: name"]').filter({ hasText: exactLabel }),
    }),
    page.locator('li.index-report-tab-option').filter({ hasText: exactLabel }),
    page.getByText(exactLabel).locator('xpath=ancestor::li[contains(@class,"index-report-tab-option")][1]'),
  ];

  let clicked = false;

  for (const target of targetLocators) {
    const candidate = target.first();
    const visible = await candidate.isVisible().catch(() => false);
    if (!visible) continue;

    const box = await candidate.boundingBox().catch(() => null);

    try {
      await candidate.click({ timeout: 3000 });
      clicked = true;
      break;
    } catch {}

    if (!clicked && box) {
      await realClick(page, box);
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    const el = page.getByText(label, { exact: false }).first();
    await el.waitFor({ state: 'visible', timeout: 20000 });

    const target = el.locator('xpath=../../..').first();
    const box = await target.boundingBox().catch(() => null);

    try {
      await target.click({ timeout: 3000 });
      clicked = true;
    } catch {}

    if (!clicked && box) {
      await realClick(page, box);
      clicked = true;
    }
  }

  if (!clicked) {
    throw new Error(`Failed clicking tile: ${label}`);
  }

  await safeWait(page, 3000);
  await waitOverlayGone(page);

  const afterPages = getLivePages(ctx);
  const afterCount = afterPages.length;

  if (afterCount > beforeCount) {
    const newest = afterPages[afterPages.length - 1];
    if (newest && !newest.isClosed()) {
      console.log(`Tile opened new page for: ${label}`);
      await newest.waitForLoadState('domcontentloaded').catch(() => {});
      await safeWait(newest, 2000);
      return newest;
    }
  }

  const refreshed = (await findPageWithText(ctx, label, 1500)) || (await getUsablePage(ctx, page));
  console.log(`Tile stayed on same page for: ${label}`);
  return refreshed;
}

async function fillDate(page, date) {
  const start = page.locator('input[name="startDate"]').first();
  const end = page.locator('input[name="endDate"]').first();

  await start.waitFor({ state: 'visible', timeout: 15000 });
  await end.waitFor({ state: 'visible', timeout: 15000 });

  await start.fill('');
  await safeWait(page, 100);
  await start.type(date, { delay: 50 });

  await end.fill('');
  await safeWait(page, 100);
  await end.type(date, { delay: 50 });
}

async function clickShow(page) {
  const btn = page.getByRole('button', { name: /^Show$/i }).first();
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  await btn.click({ force: true });
}

async function waitReportReady(page) {
  await waitOverlayGone(page);
  await safeWait(page, 2000);

  await page.waitForFunction(() => {
    const els = [...document.querySelectorAll('button, a, div, span, li')];
    return els.some((el) => {
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      const cls = typeof el.className === 'string' ? el.className.toLowerCase() : '';
      return (
        txt.includes('export') ||
        txt.includes('excel') ||
        txt.includes('xls') ||
        cls.includes('dropdown-toggle') ||
        cls.includes('module-list-button')
      );
    });
  }, { timeout: 20000 }).catch(() => {});
}

async function clickFirstVisibleLocator(page, locators, label) {
  for (const locator of locators) {
    try {
      const count = await locator.count().catch(() => 0);
      if (!count) continue;

      for (let i = 0; i < count; i += 1) {
        const item = locator.nth(i);
        const visible = await item.isVisible().catch(() => false);
        if (!visible) continue;

        await item.scrollIntoViewIfNeeded().catch(() => {});
        await safeWait(page, 150);

        try {
          await item.click({ timeout: 2500 });
          console.log(`${label} clicked by locator`);
          return { ok: true, box: await item.boundingBox().catch(() => null) };
        } catch {
          const box = await item.boundingBox().catch(() => null);
          if (box) {
            await realClick(page, box);
            console.log(`${label} clicked by realClick`);
            return { ok: true, box };
          }
        }
      }
    } catch {}
  }

  return { ok: false, box: null };
}

async function clickExportThenExcel(page) {
  console.log('Export -> Excel');

  await waitOverlayGone(page);
  await safeWait(page, 1500);

  const exportLocators = [
    page.locator('button.dropdown-toggle[name="btnExport"]'),
    page.locator('button[data-bind*="Export"][name="btnExport"]'),
    page.locator('button.dropdown-toggle'),
    page.locator('[class*="dropdown-toggle"]'),
    page.locator('.large.default.module-list-button'),
    page.locator('.default.module-list-button'),
    page.locator('a.dropdown-toggle'),
  ];

  const exportResult = await clickFirstVisibleLocator(page, exportLocators, 'Export dropdown');
  if (!exportResult.ok) throw new Error('Could not click Export dropdown');

  await safeWait(page, 1200);
  await waitOverlayGone(page);

  const exactExcelMenu = page
    .locator('a[data-bind*="exportReportToXls"]')
    .filter({ hasText: /^\s*Export to Excel\s*$/i });

  const genericMenuLocators = [
    page.locator('.dropdown-menu:visible a[data-bind*="exportReportToXls"]'),
    page.locator('a[data-bind*="exportReportToXls"]'),
    page.locator('.dropdown-menu:visible a').filter({ hasText: /^\s*Export to Excel\s*$/i }),
    page.locator('a:has-text("Export to Excel")'),
    page.locator('.dropdown-menu:visible li'),
    page.locator('.dropdown-menu:visible a'),
    page.locator('a:has-text("Excel")'),
    page.locator('a:has-text("XLS")'),
    page.locator('a:has-text("XLSX")'),
  ];

  let download = null;
  let excelClicked = false;

  if (await exactExcelMenu.first().isVisible().catch(() => false)) {
    const menuItem = exactExcelMenu.first();
    await menuItem.scrollIntoViewIfNeeded().catch(() => {});
    await safeWait(page, 150);

    try {
      [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
        menuItem.click({ timeout: 3000 }),
      ]);
      excelClicked = true;
    } catch {}

    if (!excelClicked) {
      const box = await menuItem.boundingBox().catch(() => null);
      if (box) {
        [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
          realClick(page, box),
        ]);
        excelClicked = true;
      }
    }
  }

  let excelResult = { ok: excelClicked, box: null };

  if (!excelClicked) {
    for (const locator of genericMenuLocators) {
      const count = await locator.count().catch(() => 0);
      if (!count) continue;

      for (let i = 0; i < count; i += 1) {
        const item = locator.nth(i);
        const visible = await item.isVisible().catch(() => false);
        if (!visible) continue;

        await item.scrollIntoViewIfNeeded().catch(() => {});
        await safeWait(page, 150);

        try {
          [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
            item.click({ timeout: 2500 }),
          ]);
          excelResult = { ok: true, box: await item.boundingBox().catch(() => null) };
          excelClicked = true;
          break;
        } catch {}

        const box = await item.boundingBox().catch(() => null);
        if (box) {
          [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
            realClick(page, box),
          ]);
          excelResult = { ok: true, box };
          excelClicked = true;
          break;
        }
      }

      if (excelClicked) break;
    }
  }

  if (!excelResult.ok) {
    const exportBox =
      exportResult.box ||
      (await page.locator('button.dropdown-toggle[name="btnExport"]').first().boundingBox().catch(() => null)) ||
      (await page.locator('.dropdown-toggle').first().boundingBox().catch(() => null)) ||
      (await page.locator('[class*="dropdown-toggle"]').first().boundingBox().catch(() => null));

    if (exportBox) {
      const fallbackX = Math.round(exportBox.x + exportBox.width / 2);
      const fallbackY = Math.round(exportBox.y + exportBox.height + 35);

      console.log(`Fallback Excel click at x=${fallbackX}, y=${fallbackY}`);
      await page.mouse.move(fallbackX, fallbackY);
      await safeWait(page, 150);
      await page.mouse.click(fallbackX, fallbackY);
    } else {
      throw new Error('Could not click Export to Excel');
    }
  }

  if (!download) {
    console.log('No Playwright download event. Possibly native Save dialog.');
    await runAutoHotkeySaveDialog();
    return null;
  }

  ensureDir(CONFIG.outputDir);

  let suggestedFilename = '';
  try {
    suggestedFilename = download.suggestedFilename() || '';
  } catch {}

  const ext = path.extname(suggestedFilename) || '.xls';
  const filePath = path.join(CONFIG.outputDir, `accurate_${Date.now()}${ext}`);

  await download.saveAs(filePath);
  console.log('Saved:', filePath);
  return filePath;
}

(async () => {
  requireEnv('ACCURATE_EMAIL');
  requireEnv('ACCURATE_PASSWORD');
  ensureDir(CONFIG.outputDir);
  ensureDir(CONFIG.userDataDir);

  console.log('Runtime config:', {
    accurateUrl: CONFIG.accurateUrl,
    companyName: CONFIG.companyName,
    browserName: CONFIG.browserName,
    browserExecutablePath: CONFIG.browserExecutablePath,
    outputDir: CONFIG.outputDir,
    userDataDir: CONFIG.userDataDir,
    headless: CONFIG.headless,
    slowMo: CONFIG.slowMo,
    platform: process.platform,
  });

  const browserType = getBrowserType(CONFIG.browserName);
  const launchOptions = {
    headless: CONFIG.headless,
    slowMo: CONFIG.slowMo,
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  };

  if (CONFIG.browserExecutablePath) {
    launchOptions.executablePath = CONFIG.browserExecutablePath;
  }

  const ctx = await browserType.launchPersistentContext(CONFIG.userDataDir, launchOptions);
  const page = ctx.pages().find((currentPage) => !currentPage.isClosed()) || (await ctx.newPage());

  try {
    const today = todayStr();
    console.log('Today =', today);

    await page.goto(CONFIG.accurateUrl, { waitUntil: 'domcontentloaded' });
    await safeWait(page, 3000);

    await fillLogin(page);
    await page.getByRole('button', { name: /enter/i }).click();
    await safeWait(page, 8000);

    let app = await openCompany(page, ctx);
    app = await getUsablePage(ctx, app);

    await clickSidebar(app, CONFIG.sidebarLabel);
    app = await clickTile(ctx, app, CONFIG.reportListLabel);
    app = await clickTile(ctx, app, CONFIG.financialLabel);
    app = await clickTile(ctx, app, CONFIG.profitLossLabel);

    await fillDate(app, today);
    await clickShow(app);
    await waitOverlayGone(app);
    await waitReportReady(app);
    await safeWait(app, 3000);

    await clickExportThenExcel(app);

    console.log('DONE');
  } catch (error) {
    console.error('ERROR:', error);
  }

  // await ctx.close();
})();
