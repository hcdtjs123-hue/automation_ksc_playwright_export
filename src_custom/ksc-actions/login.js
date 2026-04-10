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

module.exports = {
  fillLogin,
  openCompany,
};
