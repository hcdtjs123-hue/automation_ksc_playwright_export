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
  sumAccounts,
  sumMatchingAccounts,
} = require('./utils');

const TEMPLATE_V4_PATH = path.join(__dirname, '..', '..', 'contoh', '20260414 - KSC - AYO v4.xlsx');
const AMOUNT_NUM_FMT = '#,##0.00';

const DAILY_MATCHERS = {
  tennis: ['Pendapatan - Tennis - AYO Payment', 'Tennis - AYO'],
  padel: ['Pendapatan - Padel - AYO Payment', 'Padel - AYO'],
  renang: ['Pendapatan - Kolam Renang (Voucher per Visit)', 'Kolam Renang'],
  gym: ['Pendapatan - All Club (Voucher per Visit)', 'all club'],
  others: ['Pendapatan - Lainnya (Merchandise, sewa raket, etc)', 'Lainnya'],
};

const MONTHLY_MEMBERSHIP_MATCHERS = {
  lesRenang: ['Pendapatan - Membership Les Renang'],
  renang: ['Pendapatan - Membership Renang'],
  gymClass: ['Pendapatan - Membership Gym Class'],
  gymClassRenang: ['Pendapatan - Membership Gym Class & Renang'],
};

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
  const membershipLesRenangRevenue = sumAccounts(monthlyValues, MONTHLY_MEMBERSHIP_MATCHERS.lesRenang);
  const membershipRenangRevenue = sumAccounts(monthlyValues, MONTHLY_MEMBERSHIP_MATCHERS.renang);
  const membershipGymClassRevenue = sumAccounts(monthlyValues, MONTHLY_MEMBERSHIP_MATCHERS.gymClass);
  const membershipGymClassRenangRevenue = sumAccounts(monthlyValues, MONTHLY_MEMBERSHIP_MATCHERS.gymClassRenang);
  const monthlyMembershipRevenue =
    membershipLesRenangRevenue +
    membershipRenangRevenue +
    membershipGymClassRevenue +
    membershipGymClassRenangRevenue;
  const normalizedAcademyRevenue = normalizeNumber(academyTennisRevenue);
  const totalMonthlyMembershipRevenue = monthlyMembershipRevenue + normalizedAcademyRevenue;
  const totalRevenue = monthToDateRevenue + totalMonthlyMembershipRevenue;

  worksheet.getCell('B3').value = `REVENUE ${String(companyName || 'KSC').trim()} DAILY: ${buildSnapshotLabel(
    dailyResult.job.endDate
  )}`;
  setAmountCell(worksheet.getCell('C4'), tennisRevenue);
  setAmountCell(worksheet.getCell('C5'), padelRevenue);
  setAmountCell(worksheet.getCell('C6'), renangRevenue);
  setAmountCell(worksheet.getCell('C7'), gymRevenue);
  setAmountCell(worksheet.getCell('C8'), otherRevenue);
  setAmountCell(worksheet.getCell('C9'), totalDailyRevenue);
  worksheet.getCell('B10').value = `MONTH-TO-DATE (DAILY REVENUE ${dateRangeLabel})`;
  setAmountCell(worksheet.getCell('C10'), monthToDateRevenue);
  setAmountCell(worksheet.getCell('C13'), membershipLesRenangRevenue);
  setAmountCell(worksheet.getCell('C14'), membershipRenangRevenue);
  setAmountCell(worksheet.getCell('C15'), membershipGymClassRevenue);
  setAmountCell(worksheet.getCell('C16'), membershipGymClassRenangRevenue);
  setAmountCell(worksheet.getCell('C17'), normalizedAcademyRevenue);
  worksheet.getCell('B18').value = `TOTAL MONTHLY MEMBERSHIP REVENUE (${monthlyMembershipLabel})`;
  setAmountCell(worksheet.getCell('C18'), totalMonthlyMembershipRevenue);
  setAmountCell(worksheet.getCell('C20'), totalRevenue);
  worksheet.getCell('C21').value = monthlyTarget > 0 ? totalRevenue / monthlyTarget : null;
  worksheet.getCell('C21').numFmt = '0.00%';

  if (monthlyTarget > 0) {
    worksheet.getCell('D20').value = `*TARGET: ${formatAmount(monthlyTarget)} /MONTH`;
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

function setAmountCell(cell, value) {
  cell.value = value == null ? null : value;
  cell.numFmt = AMOUNT_NUM_FMT;
}

module.exports = {
  buildPendapatanSummaryReportV4,
};
