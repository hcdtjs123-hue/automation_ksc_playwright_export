const ExcelJS = require('exceljs');
const { parseDateStr } = require('../date');
const { normalizeNumber, normalizeText, buildMtdLabel, buildYtdLabel } = require('./utils');

async function buildSummaryColumns({ dailyResult, mtdResult, ytdResult }) {
  const dailyData = await loadProfitLossData(dailyResult.filePath);

  return [
    {
      kind: 'date',
      labelDate: parseDateStr(dailyResult.job.endDate),
      values: dailyData,
    },
    {
      kind: 'text',
      label: buildMtdLabel(mtdResult.job.startDate, mtdResult.job.endDate),
      values: await loadProfitLossData(mtdResult.filePath),
    },
    {
      kind: 'text',
      label: buildYtdLabel(ytdResult.job.startDate, ytdResult.job.endDate),
      values: await loadProfitLossData(ytdResult.filePath),
    },
  ];
}

async function loadProfitLossData(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  const values = new Map();

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const description = normalizeText(worksheet.getCell(`C${rowNumber}`).value);
    if (!description) continue;

    const amount = normalizeNumber(worksheet.getCell(`E${rowNumber}`).value);
    values.set(description, amount);
  }

  return values;
}

async function loadMultiPeriodData(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  const values = new Map();
  const totalColumn = findMultiPeriodTotalColumn(worksheet);

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const description = normalizeText(worksheet.getCell(`C${rowNumber}`).value);
    if (!description) continue;
    const amount = normalizeNumber(worksheet.getCell(rowNumber, totalColumn).value);
    values.set(description, amount);
  }

  return values;
}

function findMultiPeriodTotalColumn(worksheet) {
  for (let columnNumber = 1; columnNumber <= worksheet.columnCount; columnNumber += 1) {
    const headerText = normalizeText(worksheet.getCell(5, columnNumber).value);
    if (/^total\b/i.test(headerText)) {
      return columnNumber;
    }
  }

  throw new Error('Could not find Total column in multi period export');
}

module.exports = {
  buildSummaryColumns,
  loadProfitLossData,
  loadMultiPeriodData,
};
