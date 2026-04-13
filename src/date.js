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
  const baseRange = getConfiguredDateRange();
  const mtdRange = getRequiredDateRange('MTD');
  const ytdRange = getRequiredDateRange('YTD');
  const exportFilePrefix = getExportFilePrefix();

  return [
    buildDateJob('DAILY_ACCURATE', baseRange.startDate, baseRange.endDate, `${exportFilePrefix}daily_`),
    buildDateJob('MTD_ACCURATE', mtdRange.startDate, mtdRange.endDate, `${exportFilePrefix}mtd_`),
    buildDateJob('YTD_ACCURATE', ytdRange.startDate, ytdRange.endDate, `${exportFilePrefix}ytd_`),
  ];
}

function hasConfiguredMultiPeriodExportJob() {
  const requiredKeys = [
    'MULTI_PERIOD_ACCURATE_FROM_MONTH',
    'MULTI_PERIOD_ACCURATE_FROM_YEAR',
    'MULTI_PERIOD_ACCURATE_TO_MONTH',
    'MULTI_PERIOD_ACCURATE_TO_YEAR',
  ];

  return requiredKeys.every((key) => String(process.env[key] || '').trim());
}

function getConfiguredMultiPeriodExportJob() {
  const exportFilePrefix = getExportFilePrefix();
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
