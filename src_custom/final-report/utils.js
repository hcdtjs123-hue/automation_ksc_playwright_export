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
  return `MTD (${buildPeriodLabel(startDate, endDate)})`;
}

function buildYtdLabel(startDate, endDate) {
  const start = parseSummaryDate(startDate);
  const end = parseSummaryDate(endDate);
  return `YTD (${start.getDate()}${getMonthShortName(start)}-${end.getDate()}${getMonthShortName(end)})`;
}

function buildPeriodLabel(startDate, endDate) {
  const start = parseSummaryDate(startDate);
  const end = parseSummaryDate(endDate);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

  if (sameMonth) {
    return `${start.getDate()}-${end.getDate()}${getMonthShortName(end)}`;
  }

  return `${start.getDate()}${getMonthShortName(start)}-${end.getDate()}${getMonthShortName(end)}`;
}

function buildPeriodLabelUntilMonthEnd(startDate, dateValue) {
  const start = parseSummaryDate(startDate);
  const date = parseSummaryDate(dateValue);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return buildPeriodLabel(start, monthEnd);
}

function normalizeMatchKey(value) {
  return normalizeText(value).toLowerCase();
}

function sumMatchingAccounts(values, matchers) {
  let total = 0;

  for (const [account, amount] of values.entries()) {
    if (matchesAccount(account, matchers)) {
      total += amount || 0;
    }
  }

  return total;
}

function matchesAccount(account, matchers) {
  const normalizedAccount = normalizeMatchKey(account);

  return matchers.some((matcher) => {
    if (matcher instanceof RegExp) {
      return matcher.test(account) || matcher.test(normalizedAccount);
    }

    const normalizedMatcher = normalizeMatchKey(matcher);
    return normalizedAccount === normalizedMatcher || normalizedAccount.includes(normalizedMatcher);
  });
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
  buildPeriodLabel,
  buildPeriodLabelUntilMonthEnd,
  buildMtdLabel,
  buildYtdLabel,
  getMtdColumnIndex,
  sumAccounts,
  sumMatchingAccounts,
  toExcelSerial,
  cloneStyle,
};
