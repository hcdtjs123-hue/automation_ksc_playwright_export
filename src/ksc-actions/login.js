const { CONFIG, requireEnv } = require('../config');
const { escapeRegExp, getNewestPage, realClick, safeWait } = require('../playwright-helpers');

async function fillLogin(page) {
  const accurateEmail = requireEnv('ACCURATE_EMAIL');
  const accuratePassword = requireEnv('ACCURATE_PASSWORD');
  const emailInput = page.locator('input[name="account"]:visible').first();
  const passwordInput = page.locator('input[name="password"]:visible').first();

  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await passwordInput.waitFor({ state: 'visible', timeout: 15000 });

  await emailInput.click({ clickCount: 3 });
  await safeWait(page, 100);
  await page.keyboard.press('Backspace');
  await safeWait(page, 100);
  await emailInput.fill(accurateEmail);

  await safeWait(page, 100);

  await passwordInput.click({ clickCount: 3 });
  await safeWait(page, 100);
  await page.keyboard.press('Backspace');
  await safeWait(page, 100);
  await passwordInput.fill(accuratePassword);

  console.log('Login filled safely');
}

async function openCompany(page, ctx) {
  console.log('Opening company...');
  const el = page.getByText(new RegExp(`^${escapeRegExp(CONFIG.companyName)}$`)).first();
  await el.waitFor({ state: 'visible', timeout: 20000 });

  const box = await el.locator('xpath=../../..').boundingBox();
  await realClick(page, box);
  await safeWait(page, 500);
  await selectProductIfNeeded(page);

  await safeWait(page, 800);

  const app = getNewestPage(ctx);
  await app.waitForLoadState('domcontentloaded').catch(() => {});
  await safeWait(app, 800);

  console.log('App page:', app.url());
  return app;
}

async function selectProductIfNeeded(page) {
  const productLabel = String(CONFIG.productLabel || '').trim();
  if (!productLabel) {
    return;
  }

  const chooserTitle = page.getByText(/Select a Product to Open/i).first();
  const chooserVisible = await chooserTitle.isVisible().catch(() => false);
  const exactProductLabel = new RegExp(`^\\s*${escapeRegExp(productLabel)}\\s*$`);
  const productItem = page.locator('div.product-item').filter({
    has: page.locator('h6').filter({ hasText: exactProductLabel }),
  }).first();
  const productText = productItem.locator('h6').filter({ hasText: exactProductLabel }).first();
  const productVisible = await productItem.isVisible().catch(() => false);

  if (!chooserVisible && !productVisible) {
    return;
  }

  console.log(`Selecting product: ${productLabel}`);
  await productItem.waitFor({ state: 'visible', timeout: 10000 });

  const clickTargets = [
    productItem,
    productItem.locator('xpath=ancestor::button[1]').first(),
    productItem.locator('xpath=ancestor::a[1]').first(),
    productText,
  ];

  for (const target of clickTargets) {
    const visible = await target.isVisible().catch(() => false);
    if (!visible) continue;

    try {
      await target.click({ timeout: 2500 });
      await safeWait(page, 700);
      return;
    } catch {}

    const targetBox = await target.boundingBox().catch(() => null);
    if (!targetBox) continue;

    await realClick(page, targetBox);
    await safeWait(page, 700);
    return;
  }

  await productText.click({ timeout: 2500 });
  await safeWait(page, 700);
}

module.exports = {
  fillLogin,
  openCompany,
};
