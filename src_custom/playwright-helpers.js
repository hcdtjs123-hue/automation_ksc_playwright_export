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
  await safeWait(page, 0);
  await page.mouse.down();
  await safeWait(page, 0);
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return null;
}

async function clickFirstVisibleLocator(page, locators, label, options = {}) {
  const startedAt = Date.now();
  const beforeClickWaitMs = Number.isFinite(options.beforeClickWaitMs) ? options.beforeClickWaitMs : 0;
  const clickTimeout = Number.isFinite(options.clickTimeout) ? options.clickTimeout : 2000;
  const noWaitAfter = options.noWaitAfter === true;
  const captureBoxAfterClick = options.captureBoxAfterClick !== false;

  for (const locator of locators) {
    try {
      const firstItem = locator.first();
      const firstVisible = await firstItem.isVisible().catch(() => false);
      if (firstVisible) {
        console.log(`${label} ready for action in ${Date.now() - startedAt}ms`);
        await safeWait(page, beforeClickWaitMs);

        try {
          await firstItem.click({ timeout: clickTimeout, noWaitAfter });
          console.log(`${label} clicked by locator`);
          return {
            ok: true,
            box: captureBoxAfterClick ? await firstItem.boundingBox().catch(() => null) : null,
          };
        } catch {
          await firstItem.scrollIntoViewIfNeeded().catch(() => {});
          const firstBox = await firstItem.boundingBox().catch(() => null);
          if (firstBox) {
            await realClick(page, firstBox);
            console.log(`${label} clicked by realClick`);
            return { ok: true, box: firstBox };
          }
        }
      }

      const count = await locator.count().catch(() => 0);
      if (!count) continue;

      for (let i = 0; i < count; i += 1) {
        if (i === 0 && firstVisible) continue;
        const item = locator.nth(i);
        const visible = await item.isVisible().catch(() => false);
        if (!visible) continue;

        console.log(`${label} ready for action in ${Date.now() - startedAt}ms`);
        await safeWait(page, beforeClickWaitMs);

        try {
          await item.click({ timeout: clickTimeout, noWaitAfter });
          console.log(`${label} clicked by locator`);
          return {
            ok: true,
            box: captureBoxAfterClick ? await item.boundingBox().catch(() => null) : null,
          };
        } catch {
          await item.scrollIntoViewIfNeeded().catch(() => {});
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

module.exports = {
  clickFirstVisibleLocator,
  escapeRegExp,
  findPageWithText,
  getLivePages,
  getNewestPage,
  getUsablePage,
  realClick,
  safeWait,
  waitOverlayGone,
};
