const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { CONFIG, ensureDir, requireConfigValue, requireEnv } = require('./config');
const {
  clickFirstVisibleLocator,
  escapeRegExp,
  findPageWithText,
  getLivePages,
  getNewestPage,
  getUsablePage,
  realClick,
  safeWait,
  waitOverlayGone,
} = require('./playwright-helpers');

function runAutoHotkeySaveDialog() {
  if (process.platform !== 'win32') {
    throw new Error(
      [
        'Native Save dialog detected, but AutoHotkey fallback only works on Windows.',
        `Current platform: ${process.platform}.`,
        'Either run this export on Windows with AutoHotkey installed, or adjust the export flow so Playwright captures a normal download event.',
      ].join(' ')
    );
  }

  return new Promise((resolve, reject) => {
    execFile(
      CONFIG.ahkExecutable,
      [CONFIG.ahkScriptPath],
      (error) => {
        if (error && error.code === 'ENOENT') {
          reject(
            new Error(
              `AutoHotkey executable not found at "${CONFIG.ahkExecutable}". Set AHK_EXE_PATH correctly or install AutoHotkey v2.`
            )
          );
          return;
        }

        if (error) reject(error);
        else resolve();
      }
    );
  });
}

async function fillLogin(page) {
  const accurateEmail = requireEnv('ACCURATE_EMAIL');
  const accuratePassword = requireEnv('ACCURATE_PASSWORD');
  const emailInput = page.locator('input[name="account"]:visible').first();
  const passwordInput = page.locator('input[name="password"]:visible').first();

  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await passwordInput.waitFor({ state: 'visible', timeout: 15000 });

  await emailInput.click({ clickCount: 3 });
  await safeWait(page, 150);
  await page.keyboard.press('Backspace');
  await safeWait(page, 200);
  await emailInput.fill(accurateEmail);

  await safeWait(page, 200);

  await passwordInput.click({ clickCount: 3 });
  await safeWait(page, 150);
  await page.keyboard.press('Backspace');
  await safeWait(page, 200);
  await passwordInput.fill(accuratePassword);

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
  requireNonEmptyLabel(label, 'sidebar');
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

async function clickTile(ctx, preferredPage, label) {
  requireNonEmptyLabel(label, 'tile');
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

function requireNonEmptyLabel(label, context) {
  if (typeof label !== 'string' || !label.trim()) {
    throw new Error(`Missing ${context} label. Check src/config.js or your .env overrides.`);
  }
}

async function fillDate(page, startDate, endDate) {
  const start = page.locator('input[name="startDate"]').first();
  const end = page.locator('input[name="endDate"]').first();

  await start.waitFor({ state: 'visible', timeout: 15000 });
  await end.waitFor({ state: 'visible', timeout: 15000 });

  await start.fill('');
  await safeWait(page, 100);
  await start.fill(startDate);

  await end.fill('');
  await safeWait(page, 100);
  await end.fill(endDate);
}

async function clickShow(page) {
  const btn = page.getByRole('button', { name: /^Show$/i }).first();
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  await btn.click({ force: true });
}

async function waitReportReady(page) {
  await waitOverlayGone(page);
  await safeWait(page, 2000);

  await page
    .waitForFunction(() => {
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
    }, { timeout: 20000 })
    .catch(() => {});
}

async function clickExportThenExcel(page, fileLabel = '') {
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

  if (!exportResult.ok) {
    throw new Error('Could not click Export dropdown');
  }

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

  const fallbackDownloadsDir = path.join(os.homedir(), 'Downloads');
  const downloadsDir = CONFIG.outputDir || fallbackDownloadsDir;
  ensureDir(downloadsDir);

  let suggestedFilename = '';
  try {
    suggestedFilename = download.suggestedFilename() || '';
  } catch {}
  const ext = path.extname(suggestedFilename) || '.xls';
  const normalizedLabel = String(fileLabel || '').trim().replace(/[^\w.-]+/g, '_');
  const baseName = normalizedLabel ? `accurate_${normalizedLabel}` : `accurate_${Date.now()}`;
  const filePath = getUniqueFilePath(downloadsDir, baseName, ext);

  await download.saveAs(filePath);
  console.log('Saved:', filePath);
  return filePath;
}

function getUniqueFilePath(dirPath, baseName, ext) {
  let candidate = path.join(dirPath, `${baseName}${ext}`);
  let counter = 2;

  while (fs.existsSync(candidate)) {
    candidate = path.join(dirPath, `${baseName}_${counter}${ext}`);
    counter += 1;
  }

  return candidate;
}

module.exports = {
  clickExportThenExcel,
  clickShow,
  clickSidebar,
  clickTile,
  fillDate,
  fillLogin,
  getUsablePage,
  openCompany,
  safeWait,
  waitOverlayGone,
  waitReportReady,
};
