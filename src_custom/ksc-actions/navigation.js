const { CONFIG } = require('../config');
const {
  clickFirstVisibleLocator,
  escapeRegExp,
  findPageWithText,
  getLivePages,
  getUsablePage,
  realClick,
  safeWait,
  waitOverlayGone,
} = require('../playwright-helpers');

function requireNonEmptyLabel(label, context) {
  if (typeof label !== 'string' || !label.trim()) {
    throw new Error(`Missing ${context} label. Check src/config.js or your .env overrides.`);
  }
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
    await safeWait(page, 500);
    console.log(`Clicked sidebar: ${label}`);
    return;
  }

  throw new Error(`Sidebar failed: ${label}`);
}

async function clickTile(ctx, preferredPage, label, options = {}) {
  requireNonEmptyLabel(label, 'tile');
  console.log('Click tile:', label);

  const presearchTimeout = Number.isFinite(options.presearchTimeout) ? options.presearchTimeout : 5000;
  const postsearchTimeout = Number.isFinite(options.postsearchTimeout) ? options.postsearchTimeout : 1500;
  const fallbackVisibleTimeout = Number.isFinite(options.fallbackVisibleTimeout) ? options.fallbackVisibleTimeout : 20000;

  let page = await getUsablePage(ctx, preferredPage);
  if (presearchTimeout > 0) {
    page = (await findPageWithText(ctx, label, presearchTimeout)) || page;
  }
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
    await el.waitFor({ state: 'visible', timeout: fallbackVisibleTimeout });

    const target = el.locator('xpath=../../..').first();
    const box = await target.boundingBox().catch(() => null);

    try {
      await target.click({ timeout: 2000 });
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

  await safeWait(page, 700);
  await waitOverlayGone(page);

  const afterPages = getLivePages(ctx);
  const afterCount = afterPages.length;

  if (afterCount > beforeCount) {
    const newest = afterPages[afterPages.length - 1];
    if (newest && !newest.isClosed()) {
      console.log(`Tile opened new page for: ${label}`);
      await newest.waitForLoadState('domcontentloaded').catch(() => {});
      await safeWait(newest, 700);
      return newest;
    }
  }

  const refreshed =
    (postsearchTimeout > 0 ? await findPageWithText(ctx, label, postsearchTimeout) : null) ||
    (await getUsablePage(ctx, page));
  console.log(`Tile stayed on same page for: ${label}`);
  return refreshed;
}

async function openProfitLossReport(ctx, preferredPage) {
  return openFinancialReport(ctx, preferredPage, CONFIG.profitLossLabel);
}

async function openProfitLossMultiPeriodReport(ctx, preferredPage) {
  let app = await resolveWorkspacePage(ctx, preferredPage);

  try {
    app = await clickTile(ctx, app, CONFIG.profitLossMultiPeriodLabel, {
      presearchTimeout: 300,
      postsearchTimeout: 500,
      fallbackVisibleTimeout: 500,
    });
    return getUsablePage(ctx, app);
  } catch (directError) {
    console.log('Direct multi period tile click failed quickly, retrying after closing current report...');
  }

  await closeCurrentReportTab(app, { waitForSettled: false });
  await safeWait(app, 150);

  try {
    app = await clickTile(ctx, app, CONFIG.profitLossMultiPeriodLabel, {
      presearchTimeout: 300,
      postsearchTimeout: 500,
      fallbackVisibleTimeout: 1000,
    });
    return getUsablePage(ctx, app);
  } catch (error) {
    console.log('Retry after close failed, retrying via financial report list...');
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

async function closeCurrentReportTab(page, options = {}) {
  console.log('Closing current report tab...');
  await waitOverlayGone(page);

  const waitForSettled = options.waitForSettled !== false;

  const closeLocators = [
    page.locator('button[data-bind*="closeTab"]').first(),
    page.locator('button:has(i.icon-cancel-2)').first(),
    page.locator('i.icon-cancel-2').locator('xpath=ancestor::button[1]').first(),
  ];

  const closeResult = await clickFirstVisibleLocator(page, closeLocators, 'Close report tab button');
  if (!closeResult.ok) {
    console.log('No current report tab to close, continuing...');
    return;
  }

  if (waitForSettled) {
    await safeWait(page, 500);
    await waitOverlayGone(page);
  }
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

module.exports = {
  clickSidebar,
  clickTile,
  closeCurrentReportTab,
  openProfitLossMultiPeriodReport,
  openProfitLossReport,
};
