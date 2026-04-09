const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { ensureDir, PROJECT_ROOT } = require('./config');
const { parseDateStr } = require('./date');

const TEMPLATE_PATH = path.join(PROJECT_ROOT, 'contoh', '20260312 - KSC - AYO v3.xlsx');
const MAX_TEMPLATE_COLUMN = 40;
const FOLLOWUP_SECTION_START_ROW = 21;
const FOLLOWUP_SECTION_OFFSET = 3;

const PENDAPATAN_ROWS = [
  { row: 4, section: '1. Tennis', description: 'Tennis AYO Payment', accounts: ['Pendapatan - Tennis - AYO Payment'] },
  { row: 5, section: '', description: 'Tennis Manual Payment', accounts: ['Pendapatan - Tennis Manual Payment'] },
  { row: 6, section: 'Total Tennis', description: '', totalOfRows: [4, 5] },
  { row: 7, section: '2. Padel', description: 'Padel - AYO Payment', accounts: ['Pendapatan - Padel - AYO Payment'] },
  { row: 8, section: 'Total Padel', description: '', totalOfRows: [7] },
  {
    row: 9,
    section: '3. Renang',
    description: 'Kolam Renang (Voucher per visit)',
    accounts: ['Pendapatan - Kolam Renang (Voucher per Visit)'],
  },
  { row: 10, section: '', description: 'Membership Les Renang', accounts: ['Pendapatan - Membership Les Renang'] },
  { row: 11, section: '', description: 'Membership Renang', accounts: ['Pendapatan - Membership Renang'] },
  { row: 12, section: 'Total Renang', description: '', totalOfRows: [9, 10, 11] },
  { row: 13, section: '4. Gym', description: 'Membership Gym Class', accounts: ['Pendapatan - Membership Gym Class'] },
  { row: 14, section: 'Total Gym', description: '', totalOfRows: [13] },
  {
    row: 15,
    section: '5. Others',
    description: 'All Club (Voucher per visit)',
    accounts: ['Pendapatan - All Club (Voucher per Visit)'],
  },
  {
    row: 16,
    section: '',
    description: 'Lainnya (Merchandise, sewa raket, etc)',
    accounts: ['Pendapatan - Lainnya (Merchandise, sewa raket, etc)'],
  },
  {
    row: 17,
    section: '',
    description: 'Membership Gym Class & Renang',
    accounts: ['Pendapatan - Membership Gym Class & Renang'],
  },
  { row: 18, section: 'Total Others', description: '', totalOfRows: [15, 16, 17] },
  { row: 19, section: 'Total Pendapatan', description: '', totalOfRows: [6, 8, 12, 14, 18] },
  { row: 20, section: 'Target/Bln', description: '' },
  { row: 21, section: '%Pencapaian', description: '' },
];

async function buildPendapatanSummaryReport({
  dailyResult,
  mtdResult,
  ytdResult,
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
  pushFollowupSectionsDown(worksheet);

  const columns = await buildSummaryColumns({
    dailyResult,
    mtdResult,
    ytdResult,
  });

  clearWorksheetValues(worksheet);
  ensureVisibleSummaryColumns(worksheet);
  writePendapatanSection(worksheet, columns, companyName, monthlyTarget);
  clearRowsFrom(worksheet, 22);

  const targetPath = path.join(outputDir, `${outputBaseName}.xlsx`);
  await workbook.xlsx.writeFile(targetPath);
  return targetPath;
}

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

function writePendapatanSection(worksheet, columns, companyName, monthlyTarget) {
  worksheet.getCell('B2').value = `Pendapatan ${companyName}`;
  worksheet.getCell('B3').value = 'Section';
  worksheet.getCell('C3').value = 'DESCRIPTION';

  const dateHeaderStyle = cloneStyle(worksheet.getCell('D3').style);
  const textHeaderStyle = cloneStyle(worksheet.getCell('G3').style);

  for (let index = 0; index < columns.length; index += 1) {
    const columnNumber = 4 + index;
    const headerCell = worksheet.getCell(3, columnNumber);
    if (columns[index].kind === 'date') {
      headerCell.value = toExcelSerial(columns[index].labelDate);
      headerCell.style = cloneStyle(dateHeaderStyle);
    } else {
      headerCell.value = columns[index].label;
      headerCell.style = cloneStyle(textHeaderStyle);
    }
  }

  const rowValuesByColumn = new Map();
  const mtdColumnIndex = getMtdColumnIndex(columns);

  for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
    const sourceValues = columns[columnIndex].values;

    for (const rowConfig of PENDAPATAN_ROWS) {
      if (!rowValuesByColumn.has(rowConfig.row)) {
        rowValuesByColumn.set(rowConfig.row, []);
      }

      const targetValues = rowValuesByColumn.get(rowConfig.row);
      if (rowConfig.accounts) {
        targetValues[columnIndex] = sumAccounts(sourceValues, rowConfig.accounts);
      }
    }
  }

  for (const rowConfig of PENDAPATAN_ROWS) {
    if (rowConfig.totalOfRows) {
      const totals = [];
      for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
        const total = rowConfig.totalOfRows.reduce((sum, sourceRow) => {
          return sum + (rowValuesByColumn.get(sourceRow)?.[columnIndex] || 0);
        }, 0);
        totals[columnIndex] = total;
      }
      rowValuesByColumn.set(rowConfig.row, totals);
    }
  }

  const hasMonthlyTarget = Number.isFinite(monthlyTarget) && monthlyTarget > 0;
  rowValuesByColumn.set(
    20,
    columns.map((_, columnIndex) => (hasMonthlyTarget && columnIndex === mtdColumnIndex ? monthlyTarget : null))
  );
  rowValuesByColumn.set(
    21,
    columns.map((_, columnIndex) => {
      if (!hasMonthlyTarget || columnIndex !== mtdColumnIndex) return null;
      const totalPendapatan = rowValuesByColumn.get(19)?.[columnIndex] || 0;
      return totalPendapatan / monthlyTarget;
    })
  );

  for (const rowConfig of PENDAPATAN_ROWS) {
    worksheet.getCell(`B${rowConfig.row}`).value = rowConfig.section || null;
    worksheet.getCell(`C${rowConfig.row}`).value = rowConfig.description || null;

    const sourceStyle = cloneStyle(worksheet.getCell(`D${rowConfig.row}`).style);
    const values = rowValuesByColumn.get(rowConfig.row) || [];

    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const columnNumber = 4 + columnIndex;
      const targetCell = worksheet.getCell(rowConfig.row, columnNumber);
      const value = values[columnIndex];
      targetCell.style = cloneStyle(sourceStyle);
      if (rowConfig.row === 21) {
        targetCell.numFmt = '0.00%';
      }
      targetCell.value = value == null ? null : value;
    }
  }

  makeCellBold(worksheet.getCell('B21'));
}

function clearWorksheetValues(worksheet) {
  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    for (let columnNumber = 1; columnNumber <= MAX_TEMPLATE_COLUMN; columnNumber += 1) {
      worksheet.getCell(rowNumber, columnNumber).value = null;
    }
  }
}

function ensureVisibleSummaryColumns(worksheet) {
  // Template lama menyembunyikan beberapa kolom tengah. Summary baru butuh D/E/F tetap terlihat.
  worksheet.getColumn(4).hidden = false;
  worksheet.getColumn(5).hidden = false;
  worksheet.getColumn(6).hidden = false;
  worksheet.getColumn(7).hidden = true;
  worksheet.getColumn(8).hidden = true;

  if (!worksheet.getColumn(4).width) worksheet.getColumn(4).width = 12;
  worksheet.getColumn(5).width = 15.38;
  worksheet.getColumn(6).width = 17.88;
}

function clearRowsFrom(worksheet, startRow) {
  for (let rowNumber = startRow; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    for (let columnNumber = 1; columnNumber <= MAX_TEMPLATE_COLUMN; columnNumber += 1) {
      worksheet.getCell(rowNumber, columnNumber).value = null;
    }
  }
}

function pushFollowupSectionsDown(worksheet) {
  const blankRows = Array.from({ length: FOLLOWUP_SECTION_OFFSET }, () => []);
  worksheet.spliceRows(FOLLOWUP_SECTION_START_ROW, 0, ...blankRows);
}

function sumAccounts(values, accounts) {
  return accounts.reduce((sum, account) => sum + (values.get(account) || 0), 0);
}

function getMtdColumnIndex(columns) {
  const foundIndex = columns.findIndex((column) => column.kind === 'text' && /^MTD\b/i.test(column.label || ''));
  return foundIndex >= 0 ? foundIndex : 1;
}

function makeCellBold(cell) {
  cell.font = {
    ...(cell.font || {}),
    bold: true,
  };
}

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

function buildMtdLabel(startDate, endDate) {
  const start = parseDateStr(startDate);
  const end = parseDateStr(endDate);
  return `MTD (${start.getDate()}-${end.getDate()}${getMonthShortName(end)})`;
}

function buildYtdLabel(startDate, endDate) {
  const start = parseDateStr(startDate);
  const end = parseDateStr(endDate);
  return `YTD (${start.getDate()}${getMonthShortName(start)}-${end.getDate()}${getMonthShortName(end)})`;
}

function getMonthShortName(date) {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
}

function toExcelSerial(date) {
  const utcDate = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return utcDate / 86400000 + 25569;
}

function ensureTemplateExists() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`Missing summary template: ${TEMPLATE_PATH}`);
  }
}

function cloneStyle(style) {
  return JSON.parse(JSON.stringify(style || {}));
}

module.exports = {
  buildPendapatanSummaryReport,
};
