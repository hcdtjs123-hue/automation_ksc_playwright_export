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
  const startDate = (process.env.ACCURATE_START_DATE || '').trim() || today;
  const endDate = (process.env.ACCURATE_END_DATE || '').trim() || today;

  assertDateFormat(startDate, 'ACCURATE_START_DATE');
  assertDateFormat(endDate, 'ACCURATE_END_DATE');

  return {
    startDate,
    endDate,
  };
}

function parseDateStr(value) {
  const [day, month, year] = value.split('/').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function toFileDatePart(value) {
  const [day, month, year] = value.split('/');
  return `${year}-${month}-${day}`;
}

function getJobFileLabel(job) {
  if (job.startDate === job.endDate) {
    return toFileDatePart(job.startDate);
  }

  return `${toFileDatePart(job.startDate)}_to_${toFileDatePart(job.endDate)}`;
}

function getConfiguredDateJobs() {
  const mode = ((process.env.ACCURATE_DATE_MODE || 'daily').trim().toLowerCase() || 'daily');
  const { startDate, endDate } = getConfiguredDateRange();
  const start = parseDateStr(startDate);
  const end = parseDateStr(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Failed to parse configured date range.');
  }

  if (end < start) {
    throw new Error(`ACCURATE_END_DATE must be greater than or equal to ACCURATE_START_DATE. Received: ${startDate} -> ${endDate}`);
  }

  if (mode === 'range') {
    return [
      {
        label: `${startDate}..${endDate}`,
        startDate,
        endDate,
      },
    ];
  }

  const jobs = [];
  const current = new Date(start);

  while (current <= end) {
    const date = formatDate(current);
    jobs.push({
      label: date,
      startDate: date,
      endDate: date,
    });
    current.setDate(current.getDate() + 1);
  }

  return jobs;
}

module.exports = {
  getConfiguredDateJobs,
  getConfiguredDateRange,
  getJobFileLabel,
  todayStr,
};
