const { MAX_TEMPLATE_COLUMN } = require('./constants');
const { cloneStyle } = require('./utils');

function clearWorksheetValues(worksheet) {
  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    for (let columnNumber = 1; columnNumber <= MAX_TEMPLATE_COLUMN; columnNumber += 1) {
      worksheet.getCell(rowNumber, columnNumber).value = null;
    }
  }
}

function ensureVisibleSummaryColumns(worksheet) {
  worksheet.getColumn(4).hidden = false;
  worksheet.getColumn(5).hidden = false;
  worksheet.getColumn(6).hidden = false;
  worksheet.getColumn(7).hidden = false;
  worksheet.getColumn(8).hidden = false;

  if (!worksheet.getColumn(4).width) worksheet.getColumn(4).width = 12;
  worksheet.getColumn(5).width = 15.38;
  worksheet.getColumn(6).width = 17.88;
  if (!worksheet.getColumn(7).width) worksheet.getColumn(7).width = 15.38;
  if (!worksheet.getColumn(8).width) worksheet.getColumn(8).width = 17.88;
}

function clearRowsFrom(worksheet, startRow) {
  for (let rowNumber = startRow; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    for (let columnNumber = 1; columnNumber <= MAX_TEMPLATE_COLUMN; columnNumber += 1) {
      worksheet.getCell(rowNumber, columnNumber).value = null;
    }
  }
}

function writeSectionHeaderRow(worksheet, rowNumber, valueHeader, percentHeader, options = {}) {
  const valueColumn = options.valueColumn || 'D';
  const percentColumn = options.percentColumn || 'E';
  worksheet.getCell(`B${rowNumber}`).value = 'Section';
  worksheet.getCell(`C${rowNumber}`).value = 'DESCRIPTION';
  worksheet.getCell(`${valueColumn}${rowNumber}`).value = valueHeader;
  worksheet.getCell(`${percentColumn}${rowNumber}`).value = percentHeader;
}

function writeAmountPercentRow(worksheet, rowNumber, sectionLabel, descriptionLabel, amount, percent, options = {}) {
  const valueColumn = options.valueColumn || 'D';
  const percentColumn = options.percentColumn || 'E';
  const boldValues = Boolean(options.boldValues);
  const mergeDescription = Boolean(options.mergeDescription);
  const mergeSection = Boolean(options.mergeSection);

  worksheet.getCell(`B${rowNumber}`).value = sectionLabel || null;
  if (mergeDescription) {
    worksheet.getCell(`C${rowNumber}`).value = descriptionLabel || null;
    mergeCellsSafe(worksheet, `C${rowNumber}:D${rowNumber}`);
  } else if (mergeSection) {
    mergeCellsSafe(worksheet, `B${rowNumber}:D${rowNumber}`);
  } else {
    worksheet.getCell(`C${rowNumber}`).value = descriptionLabel || null;
    worksheet.getCell(`D${rowNumber}`).value = null;
  }
  setAmountCell(worksheet.getCell(`${valueColumn}${rowNumber}`), amount, boldValues);
  setPercentCell(worksheet.getCell(`${percentColumn}${rowNumber}`), percent, boldValues);
}

function writeTargetRow(worksheet, rowNumber, label, amount, percent, options = {}) {
  const valueColumn = options.valueColumn || 'D';
  const percentColumn = options.percentColumn || 'E';

  replaceMergeRange(worksheet, `B${rowNumber}:C${rowNumber}`);
  worksheet.getCell(`B${rowNumber}`).value = label || null;
  worksheet.getCell(`D${rowNumber}`).value = null;
  setAmountCell(worksheet.getCell(`${valueColumn}${rowNumber}`), amount, true);
  setPercentCell(worksheet.getCell(`${percentColumn}${rowNumber}`), percent, true);
}

function mergeCellsSafe(worksheet, range) {
  try {
    worksheet.mergeCells(range);
  } catch {}
}

function replaceMergeRange(worksheet, range) {
  const nextRange = decodeRange(range);

  for (const mergedRange of Object.values(worksheet._merges || {})) {
    const current = mergedRange.model;
    const overlaps =
      current.top <= nextRange.bottom &&
      current.bottom >= nextRange.top &&
      current.left <= nextRange.right &&
      current.right >= nextRange.left;

    if (!overlaps) continue;

    try {
      worksheet.unMergeCells(current.top, current.left, current.bottom, current.right);
    } catch {}
  }

  mergeCellsSafe(worksheet, range);
}

function decodeRange(range) {
  const [startRef, endRef] = String(range).split(':');
  const start = decodeCellRef(startRef);
  const end = decodeCellRef(endRef || startRef);

  return {
    top: Math.min(start.row, end.row),
    left: Math.min(start.col, end.col),
    bottom: Math.max(start.row, end.row),
    right: Math.max(start.col, end.col),
  };
}

function decodeCellRef(ref) {
  const match = String(ref || '').trim().match(/^([A-Z]+)(\d+)$/i);
  if (!match) {
    throw new Error(`Invalid cell reference: ${ref}`);
  }

  const [, letters, rowText] = match;
  let col = 0;
  for (const letter of letters.toUpperCase()) {
    col = col * 26 + (letter.charCodeAt(0) - 64);
  }

  return {
    row: Number(rowText),
    col,
  };
}

function copyRowStyles(worksheet, targetRow, sourceRow, columns) {
  for (const column of columns) {
    worksheet.getCell(`${column}${targetRow}`).style = cloneStyle(worksheet.getCell(`${column}${sourceRow}`).style);
  }
}

function setAmountCell(cell, value, bold = false) {
  cell.numFmt = '#,##0';
  cell.value = value == null ? null : value;
  if (bold) {
    makeCellBold(cell);
  }
}

function setPercentCell(cell, value, bold = false) {
  cell.numFmt = '0.00%';
  cell.value = value == null ? null : value;
  if (bold) {
    makeCellBold(cell);
  }
}

function makeCellBold(cell) {
  cell.font = {
    ...(cell.font || {}),
    bold: true,
  };
}

module.exports = {
  clearWorksheetValues,
  ensureVisibleSummaryColumns,
  clearRowsFrom,
  writeSectionHeaderRow,
  writeAmountPercentRow,
  writeTargetRow,
  mergeCellsSafe,
  replaceMergeRange,
  copyRowStyles,
  setAmountCell,
  setPercentCell,
  makeCellBold,
};
