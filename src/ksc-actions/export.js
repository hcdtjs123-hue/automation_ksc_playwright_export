const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { CONFIG, ensureDir } = require('../config');
const { clickFirstVisibleLocator, realClick, safeWait, waitOverlayGone } = require('../playwright-helpers');

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
    execFile(CONFIG.ahkExecutable, [CONFIG.ahkScriptPath], (error) => {
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
    });
  });
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

function getUniqueFilePath(dirPath, baseName, ext) {
  let candidate = path.join(dirPath, `${baseName}${ext}`);
  let counter = 2;

  while (fs.existsSync(candidate)) {
    candidate = path.join(dirPath, `${baseName}_${counter}${ext}`);
    counter += 1;
  }

  return candidate;
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
};
