const { parseDateStr } = require('../date');

function normalizeText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value).trim();
  if (typeof value === 'object' && Array.isArray(value.richText)) {
    return value.richText.map((item) => item.text || '').join('').trim();
  }
  if (typeof value === 'object' && typeof value.text === 'string') {
    return value.text.trim();
  }
  return String(value).trim();
}

function normalizeNumber(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && typeof value.result === 'number') return value.result;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSummaryDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const rawValue = String(value || '').trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawValue)) {
    return parseDateStr(rawValue);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    const [year, month, day] = rawValue.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(rawValue);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  throw new Error(`Failed to parse summary date: ${value}`);
}

function getMonthShortName(date) {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
}

function buildSnapshotLabel(dateValue) {
  const date = parseSummaryDate(dateValue);
  return `${date.getDate()}${getMonthShortName(date)}`;
}

function buildUntilMonthEndLabelFromDate(dateValue) {
  const date = parseSummaryDate(dateValue);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return `${lastDay}${getMonthShortName(date)}`;
}

function buildMtdLabel(startDate, endDate) {
  const start = parseSummaryDate(startDate);
  const end = parseSummaryDate(endDate);
  return `MTD (${start.getDate()}-${end.getDate()}${getMonthShortName(end)})`;
}

function buildYtdLabel(startDate, endDate) {
  const start = parseSummaryDate(startDate);
  const end = parseSummaryDate(endDate);
  return `YTD (${start.getDate()}${getMonthShortName(start)}-${end.getDate()}${getMonthShortName(end)})`;
}

function getMtdColumnIndex(columns) {
  const foundIndex = columns.findIndex((column) => column.kind === 'text' && /^MTD\b/i.test(column.label || ''));
  return foundIndex >= 0 ? foundIndex : 1;
}

function sumAccounts(values, accounts) {
  return accounts.reduce((sum, account) => sum + (values.get(account) || 0), 0);
}

function toExcelSerial(date) {
  const utcDate = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return utcDate / 86400000 + 25569;
}

function cloneStyle(style) {
  return JSON.parse(JSON.stringify(style || {}));
}

module.exports = {
  normalizeText,
  normalizeNumber,
  parseSummaryDate,
  getMonthShortName,
  buildSnapshotLabel,
  buildUntilMonthEndLabelFromDate,
  buildMtdLabel,
  buildYtdLabel,
  getMtdColumnIndex,
  sumAccounts,
  toExcelSerial,
  cloneStyle,
};
