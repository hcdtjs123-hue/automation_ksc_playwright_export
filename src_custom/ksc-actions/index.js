const { getUsablePage, safeWait, waitOverlayGone } = require('../playwright-helpers');
const { clickExportThenExcel } = require('./export');
const { fillLogin, openCompany } = require('./login');
const {
  clickSidebar,
  clickTile,
  closeCurrentReportTab,
  openProfitLossMultiPeriodReport,
  openProfitLossReport,
} = require('./navigation');
const { clickModifyInput, clickShow, fillDate, fillMultiPeriod, waitReportReady } = require('./report');

module.exports = {
  clickExportThenExcel,
  closeCurrentReportTab,
  clickModifyInput,
  clickShow,
  clickSidebar,
  clickTile,
  fillDate,
  fillMultiPeriod,
  fillLogin,
  getUsablePage,
  openProfitLossMultiPeriodReport,
  openProfitLossReport,
  openCompany,
  safeWait,
  waitOverlayGone,
  waitReportReady,
};
