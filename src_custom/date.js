const { APPLIED_RUNTIME_PARAMS } = require('./config');

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function assertDateFormat(value, label) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    throw new Error(`${label} must use format DD/MM/YYYY. Received: ${value}`);
  }
}

function getConfiguredDateRange() {
  const today = todayStr();
  const startDate = (process.env.DAILY_ACCURATE_START_DATE || '').trim() || today;
  const endDate = (process.env.DAILY_ACCURATE_END_DATE || '').trim() || today;

  assertDateFormat(startDate, 'DAILY_ACCURATE_START_DATE');
  assertDateFormat(endDate, 'DAILY_ACCURATE_END_DATE');

  return {
    startDate,
    endDate,
  };
}

function getEnvTrimmed(name) {
  return String(process.env[name] || '').trim();
}

function parseDateStr(value) {
  const [day, month, year] = value.split('/').map(Number);
  return new Date(year, month - 1, day);
}

function toFileDatePart(value) {
  const [day, month, year] = value.split('/');
  return `${year}-${month}-${day}`;
}

function toCompactDatePart(value) {
  const [day, month, year] = value.split('/');
  return `${year}${month}${day}`;
}

function getFileLabelForDateRange(startDate, endDate, prefix = '') {
  if (startDate === endDate) {
    return `${prefix}${toFileDatePart(startDate)}`;
  }

  return `${prefix}${toFileDatePart(startDate)}_to_${toFileDatePart(endDate)}`;
}

function buildDateJob(label, startDate, endDate, filePrefix = '') {
  assertDateFormat(startDate, `${label}_START_DATE`);
  assertDateFormat(endDate, `${label}_END_DATE`);

  const start = parseDateStr(startDate);
  const end = parseDateStr(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error(`Failed to parse configured date range for ${label}.`);
  }

  if (end < start) {
    throw new Error(`${label}_END_DATE must be greater than or equal to ${label}_START_DATE. Received: ${startDate} -> ${endDate}`);
  }

  return {
    label: `${startDate}..${endDate}`,
    startDate,
    endDate,
    filePhase: filePrefix.replace(/_+$/g, ''),
    fileLabel: getFileLabelForDateRange(startDate, endDate, filePrefix),
  };
}

function getRequiredDateRange(prefix) {
  const startDate = (process.env[`${prefix}_ACCURATE_START_DATE`] || '').trim();
  const endDate = (process.env[`${prefix}_ACCURATE_END_DATE`] || '').trim();

  if (!startDate) {
    throw new Error(`Missing required environment variable: ${prefix}_ACCURATE_START_DATE`);
  }

  if (!endDate) {
    throw new Error(`Missing required environment variable: ${prefix}_ACCURATE_END_DATE`);
  }

  return {
    startDate,
    endDate,
  };
}

function getExportFilePrefix() {
  const configuredPrefix = (process.env.ACCURATE_EXPORT_FILE_PREFIX || '').trim();
  return configuredPrefix || 'ksc_';
}

function getCustomExportFilePrefix() {
  const configuredPrefix = (process.env.ACCURATE_CUSTOM_EXPORT_FILE_PREFIX || '').trim();
  if (configuredPrefix) {
    return configuredPrefix;
  }

  return `${getExportFilePrefix()}custom_`;
}

function getMonthNames() {
  return [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
}

function normalizeMonthInput(value, label) {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    throw new Error(`Missing required environment variable: ${label}`);
  }

  const monthNames = getMonthNames();
  const monthNumber = Number(rawValue);

  if (Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12) {
    return {
      monthNumber,
      monthLabel: monthNames[monthNumber - 1],
      filePart: String(monthNumber).padStart(2, '0'),
    };
  }

  const foundIndex = monthNames.findIndex((monthName) => monthName.toLowerCase() === rawValue.toLowerCase());
  if (foundIndex >= 0) {
    return {
      monthNumber: foundIndex + 1,
      monthLabel: monthNames[foundIndex],
      filePart: String(foundIndex + 1).padStart(2, '0'),
    };
  }

  throw new Error(`${label} must be a full month name like "February" or month number 1-12. Received: ${value}`);
}

function normalizeYearInput(value, label) {
  const rawValue = String(value || '').trim();
  if (!/^\d{4}$/.test(rawValue)) {
    throw new Error(`${label} must be a 4-digit year. Received: ${value}`);
  }

  return rawValue;
}

function getConfiguredExportJobs() {
  const customPlan = getEnvTrimmed('CUSTOM_EXPORT_PLAN');
  if (customPlan) {
    return parseCustomExportPlan(customPlan);
  }

  if (APPLIED_RUNTIME_PARAMS) {
    return [];
  }

  const baseRange = getConfiguredDateRange();
  const mtdRange = getRequiredDateRange('MTD');
  const ytdRange = getRequiredDateRange('YTD');
  const exportFilePrefix = getCustomExportFilePrefix();

  return [
    withJobType(buildDateJob('DAILY_ACCURATE', baseRange.startDate, baseRange.endDate, `${exportFilePrefix}daily_`), 'daily'),
    withJobType(buildDateJob('MTD_ACCURATE', mtdRange.startDate, mtdRange.endDate, `${exportFilePrefix}monthly_`), 'monthly'),
    withJobType(buildDateJob('YTD_ACCURATE', ytdRange.startDate, ytdRange.endDate, `${exportFilePrefix}yearly_`), 'yearly'),
  ];
}

function getConfiguredMultiPeriodExportJob() {
  if (!hasConfiguredMultiPeriodExportJob()) {
    return null;
  }

  const exportFilePrefix = getCustomExportFilePrefix();
  const fromMonth = normalizeMonthInput(process.env.MULTI_PERIOD_ACCURATE_FROM_MONTH, 'MULTI_PERIOD_ACCURATE_FROM_MONTH');
  const fromYear = normalizeYearInput(process.env.MULTI_PERIOD_ACCURATE_FROM_YEAR, 'MULTI_PERIOD_ACCURATE_FROM_YEAR');
  const toMonth = normalizeMonthInput(process.env.MULTI_PERIOD_ACCURATE_TO_MONTH, 'MULTI_PERIOD_ACCURATE_TO_MONTH');
  const toYear = normalizeYearInput(process.env.MULTI_PERIOD_ACCURATE_TO_YEAR, 'MULTI_PERIOD_ACCURATE_TO_YEAR');

  const startKey = Number(`${fromYear}${fromMonth.filePart}`);
  const endKey = Number(`${toYear}${toMonth.filePart}`);
  if (endKey < startKey) {
    throw new Error(
      [
        'MULTI_PERIOD_ACCURATE_TO_* must be greater than or equal to MULTI_PERIOD_ACCURATE_FROM_*.',
        `Received: ${fromMonth.monthLabel} ${fromYear} -> ${toMonth.monthLabel} ${toYear}`,
      ].join(' ')
    );
  }

  return {
    fromMonth: fromMonth.monthLabel,
    fromYear,
    toMonth: toMonth.monthLabel,
    toYear,
    fileLabel: `${exportFilePrefix}multi_period_${fromYear}-${fromMonth.filePart}_to_${toYear}-${toMonth.filePart}`,
  };
}

function hasConfiguredMultiPeriodExportJob() {
  const requiredNames = [
    'MULTI_PERIOD_ACCURATE_FROM_MONTH',
    'MULTI_PERIOD_ACCURATE_FROM_YEAR',
    'MULTI_PERIOD_ACCURATE_TO_MONTH',
    'MULTI_PERIOD_ACCURATE_TO_YEAR',
  ];

  const values = requiredNames.map((name) => getEnvTrimmed(name));
  const hasAny = values.some(Boolean);
  const hasAll = values.every(Boolean);

  if (hasAny && !hasAll) {
    throw new Error(
      'Multi period export env is incomplete. Fill all MULTI_PERIOD_ACCURATE_FROM_* and MULTI_PERIOD_ACCURATE_TO_* values, or leave them all empty.'
    );
  }

  return hasAll;
}

function parseCustomExportPlan(planValue) {
  const exportFilePrefix = getCustomExportFilePrefix();
  const entries = String(planValue)
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    throw new Error('CUSTOM_EXPORT_PLAN is empty. Example: daily(DAILY_1);monthly(MONTHLY_1);yearly(YEARLY_1)');
  }

  return entries.map((entry, index) => parseCustomPlanEntry(entry, index, exportFilePrefix));
}

function parseCustomPlanEntry(entry, index, exportFilePrefix) {
  const match = String(entry).match(/^([a-z]+)\(\s*([A-Z0-9_]+)\s*\)$/i);
  if (!match) {
    throw new Error(
      `Invalid CUSTOM_EXPORT_PLAN entry at position ${index + 1}: ${entry}. Use format like daily(DAILY_1) or monthly(MONTHLY_1).`
    );
  }

  const rawType = normalizeCustomPlanType(match[1].trim().toLowerCase());
  const key = match[2].trim().toUpperCase();

  if (rawType === 'daily') {
    const date = getRequiredCustomEnv(`CUSTOM_${key}_DATE`);
    return {
      ...withJobType(buildDateJob(`CUSTOM_${key}`, date, date, `${exportFilePrefix}daily_${toPlanFilePart(key)}_`), 'daily'),
      planKey: key,
      planEntry: entry,
    };
  }

  if (rawType === 'monthly') {
    const startDate = getRequiredCustomEnv(`CUSTOM_${key}_START_DATE`);
    const endDate = getRequiredCustomEnv(`CUSTOM_${key}_END_DATE`);
    return {
      ...withJobType(
        buildDateJob(`CUSTOM_${key}`, startDate, endDate, `${exportFilePrefix}monthly_${toPlanFilePart(key)}_`),
        'monthly'
      ),
      planKey: key,
      planEntry: entry,
    };
  }

  if (rawType === 'yearly') {
    const startDate = getRequiredCustomEnv(`CUSTOM_${key}_START_DATE`);
    const endDate = getRequiredCustomEnv(`CUSTOM_${key}_END_DATE`);
    return {
      ...withJobType(
        buildDateJob(`CUSTOM_${key}`, startDate, endDate, `${exportFilePrefix}yearly_${toPlanFilePart(key)}_`),
        'yearly'
      ),
      planKey: key,
      planEntry: entry,
    };
  }

  throw new Error(`Unsupported CUSTOM_EXPORT_PLAN type: ${rawType}. Supported types: daily/d, monthly/m, yearly/y.`);
}

function getRequiredCustomEnv(name) {
  const value = getEnvTrimmed(name);
  if (!value) {
    throw new Error(`Missing required environment variable for CUSTOM_EXPORT_PLAN: ${name}`);
  }

  return value;
}

function withJobType(job, jobType) {
  return {
    ...job,
    jobType,
  };
}

function toPlanFilePart(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized
    .replace(/^daily_/, '')
    .replace(/^monthly_/, '')
    .replace(/^yearly_/, '');
}

function normalizeCustomPlanType(rawType) {
  if (rawType === 'd' || rawType === 'daily') return 'daily';
  if (rawType === 'm' || rawType === 'monthly') return 'monthly';
  if (rawType === 'y' || rawType === 'yearly') return 'yearly';
  return rawType;
}

function getSummaryOutputFileBaseName(endDate, companyName, reportFileTitle) {
  return `${toCompactDatePart(endDate)} - ${companyName} - ${reportFileTitle}`;
}

module.exports = {
  buildDateJob,
  getConfiguredExportJobs,
  getConfiguredMultiPeriodExportJob,
  hasConfiguredMultiPeriodExportJob,
  getConfiguredDateRange,
  getSummaryOutputFileBaseName,
  getFileLabelForDateRange,
  getRequiredDateRange,
  parseDateStr,
  todayStr,
};
