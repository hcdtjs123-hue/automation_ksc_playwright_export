const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPeriodLabel, buildPeriodLabelUntilMonthEnd } = require('../src_custom/final-report/utils');

test('buildPeriodLabel keeps compact same-month format', () => {
  assert.equal(buildPeriodLabel('01/04/2026', '07/04/2026'), '1-7Apr');
});

test('buildPeriodLabel includes both month names across months', () => {
  assert.equal(buildPeriodLabel('28/04/2026', '03/05/2026'), '28Apr-3May');
});

test('buildPeriodLabelUntilMonthEnd extends label to end of month', () => {
  assert.equal(buildPeriodLabelUntilMonthEnd('01/04/2026', '07/04/2026'), '1-30Apr');
});
