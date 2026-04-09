const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { CONFIG, ensureDir, requireEnv } = require('./config');
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
    page.locator(`div.report-li[title*="${label}"]`),
    page.locator('div.report-li').filter({
      has: page.locator('.report-li-text').filter({ hasText: exactLabel }),
    }),
    page.locator('div.report-li').filter({ hasText: exactLabel }),
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

async function clickModifyInput(page) {
  console.log('Modify Input');

  await waitOverlayGone(page);

  const modifyButtonLocators = [
    page.locator('button[name="btnModifyInput"]').first(),
    page.locator('button[data-bind*="modifyInput"]').first(),
  ];

  const modifyResult = await clickFirstVisibleLocator(page, modifyButtonLocators, 'Modify Input button');

  if (!modifyResult.ok) {
    throw new Error('Could not click Modify Input button');
  }

  await safeWait(page, 1200);
  await page.locator('input[name="startDate"]:visible').first().waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('input[name="endDate"]:visible').first().waitFor({ state: 'visible', timeout: 15000 });
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

async function openProfitLossReport(ctx, preferredPage) {
  return openFinancialReport(ctx, preferredPage, CONFIG.profitLossLabel);
}

async function openProfitLossMultiPeriodReport(ctx, preferredPage) {
  let app = await resolveWorkspacePage(ctx, preferredPage);
  await closeCurrentReportTab(app);
  await safeWait(app, 1500);

  try {
    app = await clickTile(ctx, app, CONFIG.profitLossMultiPeriodLabel);
    return getUsablePage(ctx, app);
  } catch (error) {
    console.log('Direct multi period tile click failed, retrying via financial report list...');
    return openFinancialReport(ctx, app, CONFIG.profitLossMultiPeriodLabel);
  }
}

async function openFinancialReport(ctx, preferredPage, reportLabel) {
  let app = await resolveWorkspacePage(ctx, preferredPage);

  await clickSidebar(app, CONFIG.sidebarLabel);
  app = await clickTile(ctx, app, CONFIG.reportListLabel);
  app = await clickTile(ctx, app, CONFIG.financialLabel);
  app = await clickTile(ctx, app, reportLabel);

  return getUsablePage(ctx, app);
}

async function closeCurrentReportTab(page) {
  console.log('Closing current report tab...');
  await waitOverlayGone(page);

  const closeLocators = [
    page.locator('button[data-bind*="closeTab"]').first(),
    page.locator('button:has(i.icon-cancel-2)').first(),
    page.locator('i.icon-cancel-2').locator('xpath=ancestor::button[1]').first(),
  ];

  const closeResult = await clickFirstVisibleLocator(page, closeLocators, 'Close report tab button');
  if (!closeResult.ok) {
    throw new Error('Could not click current report close button');
  }

  await safeWait(page, 1500);
  await waitOverlayGone(page);
}

async function fillMultiPeriod(page, job) {
  await waitOverlayGone(page);
  await page.getByText(/Report Parameter/i).first().waitFor({ state: 'visible', timeout: 15000 });

  const startRow = page.locator('.row.no-margin').filter({
    has: page.locator('label').filter({ hasText: /^\s*From Period\s*$/i }),
  }).first();
  const endRow = page.locator('.row.no-margin').filter({
    has: page.locator('label').filter({ hasText: /^\s*to Period\s*$/i }),
  }).first();

  const startMonthSelect = startRow.locator('select[name="periodStartMonth"]').first();
  const startYearInput = startRow.locator('.input-control.number input:visible').first();
  const endMonthSelect = endRow.locator('select[name="periodEndMonth"]').first();
  const endYearInput = endRow.locator('.input-control.number input:visible').first();

  await startMonthSelect.waitFor({ state: 'visible', timeout: 15000 });
  await startYearInput.waitFor({ state: 'visible', timeout: 15000 });
  await endMonthSelect.waitFor({ state: 'visible', timeout: 15000 });
  await endYearInput.waitFor({ state: 'visible', timeout: 15000 });

  await setSelectValue(startMonthSelect, job.fromMonth);
  await fillTextInput(startYearInput, job.fromYear);
  await setSelectValue(endMonthSelect, job.toMonth);
  await fillTextInput(endYearInput, job.toYear);
}

async function clickExportThenExcel(page, fileLabel = '', targetDir = CONFIG.outputDir) {
  console.log('Export -> Excel');

  await waitOverlayGone(page);
  await safeWait(page, 1500);

  const fallbackDownloadsDir = path.join(os.homedir(), 'Downloads');
  const downloadsDir = targetDir || CONFIG.outputDir || fallbackDownloadsDir;
  ensureDir(downloadsDir);
  const downloadWatch = createDownloadWatch([downloadsDir, fallbackDownloadsDir]);

  const normalizedLabel = String(fileLabel || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const baseName = normalizedLabel || `export_${Date.now()}`;

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
    const browserManagedFile = await waitForDownloadedFile(downloadWatch, 30000);
    if (browserManagedFile) {
      const movedFilePath = moveDownloadedFile(browserManagedFile, downloadsDir, baseName);
      console.log('Saved browser-managed download:', movedFilePath);
      return movedFilePath;
    }

    console.log('No Playwright download event. Possibly native Save dialog.');
    await runAutoHotkeySaveDialog();

    const nativeSavedFile = await waitForDownloadedFile(downloadWatch, 30000);
    if (nativeSavedFile) {
      const movedFilePath = moveDownloadedFile(nativeSavedFile, downloadsDir, baseName);
      console.log('Saved native download:', movedFilePath);
      return movedFilePath;
    }

    return null;
  }

  let suggestedFilename = '';
  try {
    suggestedFilename = download.suggestedFilename() || '';
  } catch {}
  const ext = path.extname(suggestedFilename) || '.xls';
  const filePath = getUniqueFilePath(downloadsDir, baseName, ext);

  await download.saveAs(filePath);
  console.log('Saved:', filePath);
  return filePath;
}

async function resolveWorkspacePage(ctx, preferredPage) {
  const candidates = [];

  if (preferredPage && !preferredPage.isClosed()) {
    candidates.push(preferredPage);
  }

  for (const page of getLivePages(ctx).slice().reverse()) {
    if (preferredPage && page === preferredPage) continue;
    candidates.push(page);
  }

  const importantLabels = [
    CONFIG.sidebarLabel,
    CONFIG.reportListLabel,
    CONFIG.financialLabel,
    CONFIG.profitLossLabel,
    CONFIG.profitLossMultiPeriodLabel,
  ];

  for (const page of candidates) {
    for (const label of importantLabels) {
      const visible = await page
        .getByText(label, { exact: false })
        .first()
        .isVisible()
        .catch(() => false);

      if (visible) {
        return page;
      }
    }
  }

  for (const label of importantLabels) {
    const matchedPage = await findPageWithText(ctx, label, 2000);
    if (matchedPage) {
      return matchedPage;
    }
  }

  return getUsablePage(ctx, preferredPage);
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

async function setSelectValue(selectLocator, value) {
  try {
    await selectLocator.selectOption({ label: value });
    return;
  } catch {}

  const selected = await selectLocator.evaluate((select, desiredValue) => {
    const normalize = (input) => String(input || '').trim().toLowerCase();
    const wanted = normalize(desiredValue);
    const options = Array.from(select.options || []);
    const matchingOption = options.find((option) => {
      return normalize(option.label) === wanted || normalize(option.text) === wanted || normalize(option.value) === wanted;
    });

    if (!matchingOption) {
      return false;
    }

    select.value = matchingOption.value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, value);

  if (!selected) {
    throw new Error(`Could not select option "${value}"`);
  }
}

async function fillTextInput(locator, value) {
  await locator.click({ clickCount: 3 });
  await locator.press('Backspace').catch(() => {});
  await locator.fill(String(value));
}

function createDownloadWatch(dirPaths) {
  const snapshots = new Map();

  for (const dirPath of dirPaths) {
    if (!dirPath) continue;
    ensureDir(dirPath);
    snapshots.set(dirPath, new Set(getDirectoryFileNames(dirPath)));
  }

  return {
    startedAt: Date.now(),
    snapshots,
  };
}

async function waitForDownloadedFile(downloadWatch, timeoutMs = 30000) {
  const startedAt = downloadWatch.startedAt;
  const snapshots = downloadWatch.snapshots;
  const waitStartedAt = Date.now();

  while (Date.now() - waitStartedAt < timeoutMs) {
    for (const [dirPath, existingNames] of snapshots.entries()) {
      const newFilePath = findNewDownloadInDirectory(dirPath, existingNames, startedAt);
      if (newFilePath) {
        return newFilePath;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return null;
}

function findNewDownloadInDirectory(dirPath, existingNames, startedAt) {
  if (!fs.existsSync(dirPath)) {
    return null;
  }

  const candidates = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const filePath = path.join(dirPath, entry.name);
      const stat = fs.statSync(filePath);
      return {
        filePath,
        name: entry.name,
        mtimeMs: stat.mtimeMs,
      };
    })
    .filter((entry) => isCompletedDownloadFile(entry.name))
    .filter((entry) => !existingNames.has(entry.name) || entry.mtimeMs >= startedAt - 1000)
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  return candidates[0]?.filePath || null;
}

function getDirectoryFileNames(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
}

function isCompletedDownloadFile(fileName) {
  const lowerName = fileName.toLowerCase();

  if (
    lowerName.endsWith('.crdownload') ||
    lowerName.endsWith('.part') ||
    lowerName.endsWith('.tmp') ||
    lowerName.endsWith('.partial')
  ) {
    return false;
  }

  return /\.(xls|xlsx|csv)$/i.test(fileName);
}

function moveDownloadedFile(sourcePath, targetDir, baseName) {
  ensureDir(targetDir);

  const ext = path.extname(sourcePath) || '.xls';
  const targetPath = getUniqueFilePath(targetDir, baseName, ext);
  const samePath = path.resolve(sourcePath) === path.resolve(targetPath);

  if (samePath) {
    return sourcePath;
  }

  try {
    fs.renameSync(sourcePath, targetPath);
  } catch (error) {
    if (error && error.code === 'EXDEV') {
      fs.copyFileSync(sourcePath, targetPath);
      fs.unlinkSync(sourcePath);
    } else {
      throw error;
    }
  }

  return targetPath;
}

module.exports = {
  clickExportThenExcel,
  closeCurrentReportTab,
  clickModifyInput,
  clickShow,
  clickSidebar,
  clickTile,
  fillDate,
  fillMultiPeriod,
  fillLogin,
  getUsablePage,
  openProfitLossMultiPeriodReport,
  openProfitLossReport,
  openCompany,
  safeWait,
  waitOverlayGone,
  waitReportReady,
};
