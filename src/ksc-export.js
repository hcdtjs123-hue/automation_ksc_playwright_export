const { execFileSync } = require('child_process');
const { chromium, firefox } = require('playwright');
const { CONFIG, ensureDir, logStartupConfig, validateRuntimeConfig } = require('./config');
const {
  getConfiguredExportJobs,
  getSummaryOutputFileBaseName,
} = require('./date');
const { buildPendapatanSummaryReport } = require('./final-report');
const {
  clickExportThenExcel,
  clickModifyInput,
  clickShow,
  fillDate,
  fillLogin,
  openProfitLossReport,
  openCompany,
  safeWait,
  waitOverlayGone,
  waitReportReady,
} = require('./ksc-actions');

(async () => {
  let ctx;
  let exitCode = 0;

  try {
    // Validasi env dan siapkan direktori output/profile sebelum browser dibuka.
    validateRuntimeConfig();
    ensureDir(CONFIG.outputDir);
    ensureDir(CONFIG.userDataDir);
    assertChromeProfileIsAvailable();
    logStartupConfig();

    const browserType = getBrowserType(CONFIG.browserName);
    // Satu persistent context dipakai untuk seluruh flow agar session/login tetap konsisten.
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

    ctx = await browserType.launchPersistentContext(CONFIG.userDataDir, launchOptions);

    const page = ctx.pages().find((currentPage) => !currentPage.isClosed()) || (await ctx.newPage());
    // Urutan job selalu: daily -> mtd -> ytd.
    const exportJobs = getConfiguredExportJobs();
    console.log('Export jobs =', exportJobs);

    await page.goto(CONFIG.accurateUrl, { waitUntil: 'domcontentloaded' });
    await safeWait(page, 3000);

    await fillLogin(page);

    await page.getByRole('button', { name: /enter/i }).click();
    await safeWait(page, 8000);

    let app = await openCompany(page, ctx);
    console.log('Running report flow...');

    // Masuk ke halaman Profit/Loss sekali, lalu ulangi export dengan parameter tanggal berbeda.
    app = await openProfitLossReport(ctx, app);

    const exportResults = [];

    for (let index = 0; index < exportJobs.length; index += 1) {
      const job = exportJobs[index];
      console.log(`Running export ${index + 1}/${exportJobs.length}:`, job);

      const downloadedFilePath = await runExportJob(app, job, index > 0, CONFIG.outputDir);
      exportResults.push({ job, filePath: downloadedFilePath });
      console.log(`Downloaded file ${index + 1}:`, downloadedFilePath);
    }

    const [dailyResult, mtdResult, ytdResult] = exportResults;

    const finalSummaryPath = await buildPendapatanSummaryReport({
      dailyResult,
      mtdResult,
      ytdResult,
      outputDir: CONFIG.outputDir,
      companyName: CONFIG.companyName,
      reportFileTitle: CONFIG.reportFileTitle,
      monthlyTarget: CONFIG.monthlyTarget,
      outputBaseName: getSummaryOutputFileBaseName(
        dailyResult.job.endDate,
        CONFIG.companyName,
        CONFIG.reportFileTitle
      ),
    });

    console.log('Final summary file =', finalSummaryPath);
    console.log('DONE');
  } catch (error) {
    exitCode = 1;
    console.error('ERROR:', error);
  } finally {
    if (ctx) {
      console.log('Closing browser...');
      await ctx.close().catch((closeError) => {
        exitCode = 1;
        console.error('ERROR closing browser:', closeError);
      });
    }

    process.exit(exitCode);
  }
})();

async function runExportJob(app, job, shouldModifyInput, targetDir) {
  // Export setelah job pertama harus membuka kembali form parameter terlebih dulu.
  if (shouldModifyInput) {
    await clickModifyInput(app);
  }

  await fillDate(app, job.startDate, job.endDate);
  await clickShow(app);
  await waitOverlayGone(app);
  await waitReportReady(app);
  await safeWait(app, 3000);

  const downloadedFilePath = await clickExportThenExcel(app, job.fileLabel, targetDir);

  await waitOverlayGone(app);
  await safeWait(app, 1500);

  return downloadedFilePath;
}

function getBrowserType(browserName) {
  const normalized = String(browserName || 'chromium').trim().toLowerCase();

  if (normalized === 'firefox') {
    return firefox;
  }

  return chromium;
}

function assertChromeProfileIsAvailable() {
  // Cegah reuse profile Chrome asli saat masih dipakai proses lain.
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
