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
  await safeWait(page, 100);
  await page.mouse.down();
  await safeWait(page, 50);
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
        await safeWait(page, 75);

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
