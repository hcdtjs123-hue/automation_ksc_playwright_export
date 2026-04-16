const DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const MONTH_PATTERN = /^[A-Za-z]+$/;

function parseExportCommand(text) {
  const tokens = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0 || !/^\/export(?:@[\w_]+)?$/i.test(tokens[0])) {
    throw new Error('Command harus dimulai dengan /export');
  }

  const exportPlan = [];
  let multiPeriod = null;
  let cursor = 1;

  while (cursor < tokens.length) {
    const keyword = String(tokens[cursor] || '').trim().toLowerCase();

    if (keyword === 'daily') {
      const date = readDateToken(tokens, cursor + 1, 'daily');
      exportPlan.push({ date, type: 'daily' });
      cursor += 2;
      continue;
    }

    if (keyword === 'monthly') {
      const startDate = readDateToken(tokens, cursor + 1, 'monthly');
      const endDate = readDateToken(tokens, cursor + 2, 'monthly');
      exportPlan.push({ endDate, startDate, type: 'monthly' });
      cursor += 3;
      continue;
    }

    if (keyword === 'yearly') {
      const startDate = readDateToken(tokens, cursor + 1, 'yearly');
      const endDate = readDateToken(tokens, cursor + 2, 'yearly');
      exportPlan.push({ endDate, startDate, type: 'yearly' });
      cursor += 3;
      continue;
    }

    if (keyword === 'multiperiod' || keyword === 'multi-period') {
      if (multiPeriod) {
        throw new Error('multiperiod hanya boleh disebut sekali dalam satu command.');
      }

      const fromMonth = readMonthToken(tokens, cursor + 1, 'multiperiod');
      const fromYear = readYearToken(tokens, cursor + 2, 'multiperiod');
      const toMonth = readMonthToken(tokens, cursor + 3, 'multiperiod');
      const toYear = readYearToken(tokens, cursor + 4, 'multiperiod');
      multiPeriod = { fromMonth, fromYear, toMonth, toYear };
      cursor += 5;
      continue;
    }

    throw new Error(`Token tidak dikenali pada /export: ${tokens[cursor]}`);
  }

  if (exportPlan.length === 0 && !multiPeriod) {
    throw new Error('Command /export harus berisi minimal satu segmen export atau multiperiod.');
  }

  return {
    exportPlan,
    multiPeriod,
  };
}

function getExportUsageText() {
  return [
    'Format command:',
    '/export daily DD/MM/YYYY',
    '/export monthly DD/MM/YYYY DD/MM/YYYY',
    '/export yearly DD/MM/YYYY DD/MM/YYYY',
    '/export multiperiod Month YYYY Month YYYY',
    '/export daily 01/04/2026 monthly 01/04/2026 30/04/2026 multiperiod May 2026 June 2026',
    '/export daily 01/04/2026 monthly 01/04/2026 30/04/2026 yearly 01/01/2026 30/04/2026 multiperiod May 2026 June 2026',
    '',
    'Catatan:',
    '- Tanpa yearly, bot hanya kirim file export yang diminta.',
    '- Summary v3 dan v4 saat ini dibuat jika command berisi daily + monthly + yearly + multiperiod.',
  ].join('\n');
}

function readDateToken(tokens, index, label) {
  const value = String(tokens[index] || '').trim();
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`Format tanggal untuk ${label} harus DD/MM/YYYY.`);
  }

  const [, ddRaw, mmRaw, yyyyRaw] = value.match(DATE_PATTERN);
  const day = Number(ddRaw);
  const month = Number(mmRaw);
  const year = Number(yyyyRaw);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Tanggal tidak valid untuk ${label}: ${value}`);
  }

  return value;
}

function readMonthToken(tokens, index, label) {
  const value = String(tokens[index] || '').trim();
  if (!MONTH_PATTERN.test(value)) {
    throw new Error(`Nama bulan untuk ${label} harus berupa huruf, misalnya May atau June.`);
  }

  return value;
}

function readYearToken(tokens, index, label) {
  const value = String(tokens[index] || '').trim();
  if (!/^\d{4}$/.test(value)) {
    throw new Error(`Tahun untuk ${label} harus 4 digit.`);
  }

  return value;
}

module.exports = {
  getExportUsageText,
  parseExportCommand,
};
