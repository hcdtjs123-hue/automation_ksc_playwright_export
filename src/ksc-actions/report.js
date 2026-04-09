const { clickFirstVisibleLocator, safeWait, waitOverlayGone } = require('../playwright-helpers');

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

module.exports = {
  clickModifyInput,
  clickShow,
  fillDate,
  fillMultiPeriod,
  waitReportReady,
};
