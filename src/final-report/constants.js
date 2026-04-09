const path = require('path');
const { PROJECT_ROOT } = require('../config');

const TEMPLATE_PATH = path.join(PROJECT_ROOT, 'contoh', '20260312 - KSC - AYO v3.xlsx');
const MAX_TEMPLATE_COLUMN = 40;

const B_SECTION_ROWS = {
  title: 23,
  subtitle: 24,
  header: 26,
  detailStart: 27,
  total: 30,
  target: 31,
  achievement: 32,
};

const C_SECTION_ROWS = {
  title: 35,
  header: 36,
  target: 37,
  totalPendapatan: 38,
  totalPendapatanDiterima: 39,
  totalEstPendapatan: 40,
  remainingTarget: 41,
  note: 42,
};

const MULTI_PERIOD_ACCOUNTS = [
  { row: 27, label: 'UM - Membership Renang', account: 'Pendapatan - Membership Renang' },
  { row: 28, label: 'UM - Membership Gym Class', account: 'Pendapatan - Membership Gym Class' },
  { row: 29, label: 'UM - Membership Gym Class & Renang', account: 'Pendapatan - Membership Gym Class & Renang' },
];

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

module.exports = {
  TEMPLATE_PATH,
  MAX_TEMPLATE_COLUMN,
  B_SECTION_ROWS,
  C_SECTION_ROWS,
  MULTI_PERIOD_ACCOUNTS,
  PENDAPATAN_ROWS,
};
