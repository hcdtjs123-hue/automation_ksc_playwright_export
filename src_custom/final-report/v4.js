const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { ensureDir } = require('../config');
const { loadProfitLossData } = require('./loaders');
const {
  buildPeriodLabel,
  buildPeriodLabelUntilMonthEnd,
  buildSnapshotLabel,
  normalizeNumber,
  sumMatchingAccounts,
} = require('./utils');

const TEMPLATE_V4_PATH = path.join(__dirname, '..', '..', 'contoh', '20260414 - KSC - AYO v4.xlsx');

const DAILY_MATCHERS = {
  tennis: ['Pendapatan - Tennis - AYO Payment', 'Tennis - AYO'],
  padel: ['Pendapatan - Padel - AYO Payment', 'Padel - AYO'],
  renang: ['Pendapatan - Kolam Renang (Voucher per Visit)', 'Kolam Renang'],
  gym: ['Pendapatan - All Club (Voucher per Visit)', 'all club'],
  others: ['Pendapatan - Lainnya (Merchandise, sewa raket, etc)', 'Lainnya'],
};

const MONTHLY_MEMBERSHIP_MATCHERS = [/membership/i, /uang pangkal/i];

async function buildPendapatanSummaryReportV4({
  academyTennisRevenue,
  companyName,
  dailyResult,
  mtdResult,
  monthlyTarget,
  outputBaseName,
  outputDir,
}) {
  ensureTemplateExists();
  ensureDir(outputDir);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_V4_PATH);
  const worksheet = workbook.worksheets[0];
  worksheet.views = [{ showGridLines: false }];

  const dailyValues = await loadProfitLossData(dailyResult.filePath);
  const monthlyValues = await loadProfitLossData(mtdResult.filePath);
  const dateRangeLabel = buildPeriodLabel(mtdResult.job.startDate, mtdResult.job.endDate);
  const monthlyMembershipLabel = buildPeriodLabelUntilMonthEnd(mtdResult.job.startDate, mtdResult.job.endDate);

  const tennisRevenue = sumMatchingAccounts(dailyValues, DAILY_MATCHERS.tennis);
  const padelRevenue = sumMatchingAccounts(dailyValues, DAILY_MATCHERS.padel);
  const renangRevenue = sumMatchingAccounts(dailyValues, DAILY_MATCHERS.renang);
  const gymRevenue = sumMatchingAccounts(dailyValues, DAILY_MATCHERS.gym);
  const otherRevenue = sumMatchingAccounts(dailyValues, DAILY_MATCHERS.others);
  const totalDailyRevenue = tennisRevenue + padelRevenue + renangRevenue + gymRevenue + otherRevenue;
  const monthToDateRevenue = normalizeNumber(
    mtdResult?.job?.startDate && mtdResult?.job?.endDate
      ? sumMatchingAccounts(monthlyValues, [
          ...DAILY_MATCHERS.tennis,
          ...DAILY_MATCHERS.padel,
          ...DAILY_MATCHERS.renang,
          ...DAILY_MATCHERS.gym,
          ...DAILY_MATCHERS.others,
        ])
      : 0
  );
  const monthlyMembershipRevenue = sumMatchingAccounts(monthlyValues, MONTHLY_MEMBERSHIP_MATCHERS);
  const normalizedAcademyRevenue = normalizeNumber(academyTennisRevenue);
  const totalMonthlyMembershipRevenue = monthlyMembershipRevenue + normalizedAcademyRevenue;
  const totalRevenue = monthToDateRevenue + totalMonthlyMembershipRevenue;

  worksheet.getCell('B3').value = `REVENUE ${String(companyName || 'KSC').trim()} DAILY: ${buildSnapshotLabel(
    dailyResult.job.endDate
  )}`;
  worksheet.getCell('C4').value = tennisRevenue;
  worksheet.getCell('C5').value = padelRevenue;
  worksheet.getCell('C6').value = renangRevenue;
  worksheet.getCell('C7').value = gymRevenue;
  worksheet.getCell('C8').value = otherRevenue;
  worksheet.getCell('C9').value = totalDailyRevenue;
  worksheet.getCell('B10').value = `MONTH-TO-DATE (DAILY REVENUE ${dateRangeLabel})`;
  worksheet.getCell('C10').value = monthToDateRevenue;
  worksheet.getCell('C13').value = monthlyMembershipRevenue;
  worksheet.getCell('C14').value = normalizedAcademyRevenue;
  worksheet.getCell('B15').value = `TOTAL MONTHLY MEMBERSHIP REVENUE (${monthlyMembershipLabel})`;
  worksheet.getCell('C15').value = totalMonthlyMembershipRevenue;
  worksheet.getCell('C17').value = totalRevenue;
  worksheet.getCell('C18').value = monthlyTarget > 0 ? totalRevenue / monthlyTarget : null;
  worksheet.getCell('C18').numFmt = '0.00%';

  if (monthlyTarget > 0) {
    worksheet.getCell('D17').value = `*TARGET: ${formatAmount(monthlyTarget)} /MONTH`;
  }

  const targetPath = path.join(outputDir, `${outputBaseName}.xlsx`);
  await workbook.xlsx.writeFile(targetPath);
  return targetPath;
}

function ensureTemplateExists() {
  if (!fs.existsSync(TEMPLATE_V4_PATH)) {
    throw new Error(`Missing summary v4 template: ${TEMPLATE_V4_PATH}`);
  }
}

function formatAmount(value) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(normalizeNumber(value));
}

module.exports = {
  buildPendapatanSummaryReportV4,
};
