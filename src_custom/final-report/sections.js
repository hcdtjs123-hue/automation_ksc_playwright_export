const { B_SECTION_ROWS, C_SECTION_ROWS, MULTI_PERIOD_ACCOUNTS, PENDAPATAN_ROWS } = require('./constants');
const {
  buildSnapshotLabel,
  buildUntilMonthEndLabelFromDate,
  cloneStyle,
  getMonthShortName,
  getMtdColumnIndex,
  parseSummaryDate,
  sumAccounts,
  toExcelSerial,
} = require('./utils');
const {
  copyRowStyles,
  makeCellBold,
  replaceMergeRange,
  setAmountCell,
  setPercentCell,
  writeAmountPercentRow,
  writeSectionHeaderRow,
  writeTargetRow,
  mergeCellsSafe,
} = require('./worksheet');

function writePendapatanSection(worksheet, columns, companyName, monthlyTarget) {
  replaceMergeRange(worksheet, 'B1:H1');
  worksheet.getCell('B1').value = `A. Pendapatan ${companyName}`;
  makeCellBold(worksheet.getCell('B1'));
  worksheet.getCell('B3').value = 'Section';
  worksheet.getCell('C3').value = 'DESCRIPTION';

  const dateHeaderStyle = cloneStyle(worksheet.getCell('D3').style);
  const textHeaderStyle = cloneStyle(worksheet.getCell('E3').style);

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
    makeCellBold(headerCell);
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
  return {
    totalPendapatanMtd: rowValuesByColumn.get(19)?.[mtdColumnIndex] || 0,
  };
}

function writePendapatanDiterimaDimukaSection(worksheet, dailyResult, multiPeriodData, monthlyTarget) {
  const snapshotLabel = buildSnapshotLabel(dailyResult.job.endDate);
  const untilLabel = buildUntilMonthEndLabelFromDate(dailyResult.job.endDate);
  const titleFont = cloneStyle(worksheet.getCell(`B${B_SECTION_ROWS.title}`).font);
  const totalValue = MULTI_PERIOD_ACCOUNTS.reduce((sum, item) => sum + (multiPeriodData.get(item.account) || 0), 0);

  replaceMergeRange(worksheet, `B${B_SECTION_ROWS.title}:H${B_SECTION_ROWS.title}`);
  worksheet.getCell(`B${B_SECTION_ROWS.title}`).value = 'B. Pendapatan Diterima dimuka';
  worksheet.getCell(`B${B_SECTION_ROWS.title}`).font = titleFont;

  replaceMergeRange(worksheet, `B${B_SECTION_ROWS.subtitle}:H${B_SECTION_ROWS.subtitle}`);
  worksheet.getCell(`B${B_SECTION_ROWS.subtitle}`).value =
    `(customer payment untuk booking sampai ${untilLabel}, jika tidak dipakai, akan hangus)`;
  worksheet.getCell(`B${B_SECTION_ROWS.subtitle}`).font = {
    ...(titleFont || {}),
    bold: false,
    italic: true,
    size: 10,
  };

  writeSectionHeaderRow(worksheet, B_SECTION_ROWS.header, snapshotLabel, null, {
    valueColumn: 'E',
    percentColumn: 'F',
  });
  worksheet.getCell(`F${B_SECTION_ROWS.header}`).value = null;

  for (const item of MULTI_PERIOD_ACCOUNTS) {
    copyRowStyles(worksheet, item.row, item.row, ['B', 'C', 'D', 'E', 'F']);
    worksheet.getCell(`B${item.row}`).value = item.row === B_SECTION_ROWS.detailStart ? 'Uang Muka (UM)' : null;
    worksheet.getCell(`C${item.row}`).value = item.label;
    setAmountCell(worksheet.getCell(`E${item.row}`), multiPeriodData.get(item.account) || 0);
    worksheet.getCell(`F${item.row}`).value = null;
  }

  copyRowStyles(worksheet, B_SECTION_ROWS.total, B_SECTION_ROWS.total, ['B', 'C', 'D', 'E', 'F']);
  worksheet.getCell(`B${B_SECTION_ROWS.total}`).value = 'Total Pendapatan diterima dimuka';
  worksheet.getCell(`C${B_SECTION_ROWS.total}`).value = null;
  setAmountCell(worksheet.getCell(`E${B_SECTION_ROWS.total}`), totalValue, true);
  worksheet.getCell(`F${B_SECTION_ROWS.total}`).value = null;

  copyRowStyles(worksheet, B_SECTION_ROWS.target, B_SECTION_ROWS.target, ['B', 'C', 'D', 'E', 'F']);
  worksheet.getCell(`B${B_SECTION_ROWS.target}`).value = 'Target/bln';
  worksheet.getCell(`C${B_SECTION_ROWS.target}`).value = null;
  worksheet.getCell(`D${B_SECTION_ROWS.target}`).value = null;
  setAmountCell(worksheet.getCell(`E${B_SECTION_ROWS.target}`), monthlyTarget > 0 ? monthlyTarget : null, true);
  worksheet.getCell(`F${B_SECTION_ROWS.target}`).value = null;

  copyRowStyles(worksheet, B_SECTION_ROWS.achievement, B_SECTION_ROWS.achievement, ['B', 'C', 'D', 'E', 'F']);
  worksheet.getCell(`B${B_SECTION_ROWS.achievement}`).value = '%Pencapaian';
  makeCellBold(worksheet.getCell(`B${B_SECTION_ROWS.achievement}`));
  worksheet.getCell(`C${B_SECTION_ROWS.achievement}`).value = null;
  worksheet.getCell(`D${B_SECTION_ROWS.achievement}`).value = null;
  setPercentCell(worksheet.getCell(`E${B_SECTION_ROWS.achievement}`), monthlyTarget > 0 ? totalValue / monthlyTarget : null, true);
  worksheet.getCell(`F${B_SECTION_ROWS.achievement}`).value = null;
}

function writeTotalEstPendapatanSection(worksheet, dailyResult, pendapatanSummary, multiPeriodData, monthlyTarget) {
  const snapshotDate = parseSummaryDate(dailyResult.job.endDate);
  const monthLabel = getMonthShortName(snapshotDate);
  const untilLabel = buildUntilMonthEndLabelFromDate(snapshotDate);
  const totalPendapatanDiterima = MULTI_PERIOD_ACCOUNTS.reduce((sum, item) => sum + (multiPeriodData.get(item.account) || 0), 0);
  const totalPendapatan = pendapatanSummary.totalPendapatanMtd || 0;
  const totalEstPendapatan = totalPendapatan + totalPendapatanDiterima;
  const remainingTarget = monthlyTarget > 0 ? monthlyTarget - totalEstPendapatan : null;
  const titleFont = cloneStyle(worksheet.getCell(`B${C_SECTION_ROWS.title}`).font);

  replaceMergeRange(worksheet, `B${C_SECTION_ROWS.title}:H${C_SECTION_ROWS.title}`);
  worksheet.getCell(`B${C_SECTION_ROWS.title}`).value =
    `C. Total Est Pendapatan ${monthLabel} ${snapshotDate.getFullYear()}`;
  worksheet.getCell(`B${C_SECTION_ROWS.title}`).font = titleFont;

  writeSectionHeaderRow(worksheet, C_SECTION_ROWS.header, monthLabel, '%', {
    valueColumn: 'E',
    percentColumn: 'F',
  });

  copyRowStyles(worksheet, C_SECTION_ROWS.target, C_SECTION_ROWS.target, ['B', 'C', 'D', 'E', 'F']);
  writeTargetRow(worksheet, C_SECTION_ROWS.target, 'Target/bln', monthlyTarget, monthlyTarget > 0 ? 1 : null, {
    valueColumn: 'E',
    percentColumn: 'F',
  });

  copyRowStyles(worksheet, C_SECTION_ROWS.totalPendapatan, C_SECTION_ROWS.totalPendapatan, ['B', 'C', 'D', 'E', 'F']);
  writeAmountPercentRow(
    worksheet,
    C_SECTION_ROWS.totalPendapatan,
    null,
    'Total Pendapatan',
    totalPendapatan,
    monthlyTarget > 0 ? totalPendapatan / monthlyTarget : null,
    {
      valueColumn: 'E',
      percentColumn: 'F',
      mergeDescription: true,
      boldValues: true,
    }
  );

  copyRowStyles(
    worksheet,
    C_SECTION_ROWS.totalPendapatanDiterima,
    C_SECTION_ROWS.totalPendapatanDiterima,
    ['B', 'C', 'D', 'E', 'F']
  );
  writeAmountPercentRow(
    worksheet,
    C_SECTION_ROWS.totalPendapatanDiterima,
    null,
    'Total Pendapatan diterima',
    totalPendapatanDiterima,
    monthlyTarget > 0 ? totalPendapatanDiterima / monthlyTarget : null,
    {
      valueColumn: 'E',
      percentColumn: 'F',
      mergeDescription: true,
      boldValues: true,
    }
  );

  copyRowStyles(
    worksheet,
    C_SECTION_ROWS.totalEstPendapatan,
    C_SECTION_ROWS.totalEstPendapatan,
    ['B', 'C', 'D', 'E', 'F']
  );
  writeAmountPercentRow(
    worksheet,
    C_SECTION_ROWS.totalEstPendapatan,
    `Total Est Pendapatan ${monthLabel} ${snapshotDate.getFullYear()}`,
    null,
    totalEstPendapatan,
    monthlyTarget > 0 ? totalEstPendapatan / monthlyTarget : null,
    {
      valueColumn: 'E',
      percentColumn: 'F',
      mergeSection: true,
      boldValues: true,
    }
  );

  copyRowStyles(
    worksheet,
    C_SECTION_ROWS.remainingTarget,
    C_SECTION_ROWS.remainingTarget,
    ['B', 'C', 'D', 'E', 'F']
  );
  writeAmountPercentRow(
    worksheet,
    C_SECTION_ROWS.remainingTarget,
    `Sisa Target yg harus dicapai sampai ${untilLabel}`,
    null,
    remainingTarget,
    monthlyTarget > 0 && remainingTarget != null ? remainingTarget / monthlyTarget : null,
    {
      valueColumn: 'E',
      percentColumn: 'F',
      mergeSection: true,
      boldValues: true,
    }
  );

  mergeCellsSafe(worksheet, `B${C_SECTION_ROWS.note}:H${C_SECTION_ROWS.note}`);
  worksheet.getCell(`B${C_SECTION_ROWS.note}`).value =
    'note: table C digunakan untuk mengetahui sisa pendapatan yang harus dicapai sampai akhir bulan';
  worksheet.getCell(`B${C_SECTION_ROWS.note}`).font = {
    ...(worksheet.getCell(`B${C_SECTION_ROWS.note}`).font || {}),
    italic: true,
  };
}

module.exports = {
  writePendapatanSection,
  writePendapatanDiterimaDimukaSection,
  writeTotalEstPendapatanSection,
};
