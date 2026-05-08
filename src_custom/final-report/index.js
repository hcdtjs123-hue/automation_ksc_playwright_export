const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { ensureDir } = require('../config');
const { TEMPLATE_PATH } = require('./constants');
const { buildSummaryColumns, loadMultiPeriodData } = require('./loaders');
const { clearRowsFrom, clearWorksheetValues, ensureVisibleSummaryColumns } = require('./worksheet');
const { buildPendapatanSummaryReportV4 } = require('./v4');
const {
  writePendapatanDiterimaDimukaSection,
  writePendapatanSection,
  writeTotalEstPendapatanSection,
} = require('./sections');

async function buildPendapatanSummaryReport({
  dailyResult,
  mtdResult,
  ytdResult,
  multiPeriodResult,
  outputDir,
  companyName,
  reportFileTitle,
  monthlyTarget,
  outputBaseName,
}) {
  ensureTemplateExists();
  ensureDir(outputDir);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);
  const worksheet = workbook.worksheets[0];
  worksheet.views = [{ showGridLines: false }];

  const columns = await buildSummaryColumns({
    dailyResult,
    mtdResult,
    ytdResult,
  });
  const multiPeriodData = await loadMultiPeriodData(multiPeriodResult.filePath);

  clearWorksheetValues(worksheet);
  ensureVisibleSummaryColumns(worksheet);
  clearRowsFrom(worksheet, 44);

  const pendapatanSummary = writePendapatanSection(worksheet, columns, companyName, monthlyTarget);
  writePendapatanDiterimaDimukaSection(worksheet, dailyResult, multiPeriodData, monthlyTarget);
  writeTotalEstPendapatanSection(worksheet, dailyResult, pendapatanSummary, multiPeriodData, monthlyTarget);

  const targetPath = path.join(outputDir, `${outputBaseName}.xlsx`);
  await workbook.xlsx.writeFile(targetPath);
  return targetPath;
}

async function buildPendapatanSummaryReports({
  dailyResult,
  mtdResult,
  multiPeriodResult,
  outputDir,
  companyName,
  reportFileTitle,
  monthlyTarget,
  v3OutputBaseName,
  v4OutputBaseName,
  ytdResult,
}) {
  const paths = [];
  const v3Path = await buildPendapatanSummaryReport({
    dailyResult,
    mtdResult,
    ytdResult,
    multiPeriodResult,
    outputDir,
    companyName,
    reportFileTitle,
    monthlyTarget,
    outputBaseName: v3OutputBaseName,
  });
  paths.push(v3Path);

  const v4Path = await buildPendapatanSummaryReportV4({
    companyName,
    dailyResult,
    mtdResult,
    monthlyTarget,
    outputBaseName: v4OutputBaseName,
    outputDir,
  });
  paths.push(v4Path);

  return {
    paths,
    v3Path,
    v4Path,
  };
}

function ensureTemplateExists() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`Missing summary template: ${TEMPLATE_PATH}`);
  }
}

module.exports = {
  buildPendapatanSummaryReport,
  buildPendapatanSummaryReports,
};
