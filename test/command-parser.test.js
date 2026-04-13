const test = require('node:test');
const assert = require('node:assert/strict');
const { getExportUsageText, parseExportCommand } = require('../src_bot/command-parser');

test('parseExportCommand parses mixed export segments and multiperiod', () => {
  const result = parseExportCommand(
    '/export daily 01/04/2026 monthly 01/04/2026 30/04/2026 yearly 01/01/2026 30/04/2026 multiperiod May 2026 June 2026'
  );

  assert.deepEqual(result, {
    exportPlan: [
      { date: '01/04/2026', type: 'daily' },
      { endDate: '30/04/2026', startDate: '01/04/2026', type: 'monthly' },
      { endDate: '30/04/2026', startDate: '01/01/2026', type: 'yearly' },
    ],
    multiPeriod: {
      fromMonth: 'May',
      fromYear: '2026',
      toMonth: 'June',
      toYear: '2026',
    },
  });
});

test('parseExportCommand supports multiperiod-only command', () => {
  const result = parseExportCommand('/export multiperiod February 2026 April 2026');

  assert.deepEqual(result, {
    exportPlan: [],
    multiPeriod: {
      fromMonth: 'February',
      fromYear: '2026',
      toMonth: 'April',
      toYear: '2026',
    },
  });
});

test('parseExportCommand rejects invalid dates with readable message', () => {
  assert.throws(() => parseExportCommand('/export daily 31/02/2026'), {
    message: 'Tanggal tidak valid untuk daily: 31/02/2026',
  });
});

test('getExportUsageText includes core syntax examples', () => {
  const usage = getExportUsageText();

  assert.match(usage, /\/export daily DD\/MM\/YYYY/);
  assert.match(usage, /\/export multiperiod Month YYYY Month YYYY/);
});
