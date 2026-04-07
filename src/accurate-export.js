const { execFileSync } = require('child_process');
const { chromium, firefox } = require('playwright');
const { CONFIG, ensureDir, logStartupConfig, validateRuntimeConfig } = require('./config');
const { getConfiguredDateJobs, getJobFileLabel } = require('./date');
const {
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
} = require('./accurate-actions');

(async () => {
  validateRuntimeConfig();
  ensureDir(CONFIG.outputDir);
  ensureDir(CONFIG.userDataDir);
  assertChromeProfileIsAvailable();
  logStartupConfig();

  const browserType = getBrowserType(CONFIG.browserName);
  const launchOptions = {
    headless: CONFIG.headless,
    slowMo: CONFIG.slowMo,
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  };

  if (CONFIG.browserName === 'chromium' && CONFIG.browserChannel) {
    launchOptions.channel = CONFIG.browserChannel;
  }

  if (CONFIG.browserName === 'chromium' && CONFIG.chromeProfileDirectory) {
    launchOptions.args = [`--profile-directory=${CONFIG.chromeProfileDirectory}`];
  }

  if (CONFIG.browserExecutablePath) {
    launchOptions.executablePath = CONFIG.browserExecutablePath;
  }

  const ctx = await browserType.launchPersistentContext(CONFIG.userDataDir, launchOptions);

  const page = ctx.pages().find((currentPage) => !currentPage.isClosed()) || (await ctx.newPage());

  try {
    const dateJobs = getConfiguredDateJobs();
    console.log('Date jobs =', dateJobs);

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

    const downloadedFiles = [];

    for (let index = 0; index < dateJobs.length; index += 1) {
      const job = dateJobs[index];
      console.log(`Running report ${index + 1}/${dateJobs.length}:`, job);

      await fillDate(app, job.startDate, job.endDate);
      await clickShow(app);
      await waitOverlayGone(app);
      await waitReportReady(app);
      await safeWait(app, 3000);

      const downloadedFilePath = await clickExportThenExcel(app, getJobFileLabel(job));
      if (downloadedFilePath) {
        downloadedFiles.push(downloadedFilePath);
      }

      await waitOverlayGone(app);
      await safeWait(app, 1500);
    }

    console.log('Downloaded files =', downloadedFiles);
    console.log('DONE');
  } catch (error) {
    console.error('ERROR:', error);
  }

  // await ctx.close();
})();

function getBrowserType(browserName) {
  const normalized = String(browserName || 'chromium').trim().toLowerCase();

  if (normalized === 'firefox') {
    return firefox;
  }

  return chromium;
}

function assertChromeProfileIsAvailable() {
  const isChromeProfileMode =
    CONFIG.browserName === 'chromium' &&
    CONFIG.browserExecutablePath &&
    /google-chrome|chrome\.exe/i.test(CONFIG.browserExecutablePath) &&
    /google-chrome|chrome/i.test(CONFIG.userDataDir);

  if (!isChromeProfileMode) {
    return;
  }

  const activeChromeProcesses = getActiveChromeProcesses();
  if (activeChromeProcesses.length === 0) {
    return;
  }

  throw new Error(
    [
      'Chrome profile appears to be in use by another running Chrome process.',
      'Close all Google Chrome windows and background processes first, then run this script again.',
      `Detected processes: ${activeChromeProcesses.join(' | ')}`,
    ].join(' ')
  );
}

function getActiveChromeProcesses() {
  try {
    const output = execFileSync('pgrep', ['-a', 'chrome'], { encoding: 'utf8' });
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => /google-chrome|google-chrome-stable|chrome\.exe/i.test(line));
  } catch (error) {
    if (error && typeof error.status === 'number' && error.status === 1) {
      return [];
    }

    return [];
  }
}
