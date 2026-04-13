const path = require('path');

function normalizePhone(rawValue) {
  return String(rawValue || '').replace(/\D+/g, '');
}

function formatUserLabel(user) {
  const firstName = String(user?.first_name || '').trim();
  const lastName = String(user?.last_name || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName || String(user?.username || '').trim() || `user:${user?.id || 'unknown'}`;
}

function buildRequestId(userId) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const suffix = String(userId || 'anon').replace(/\D+/g, '') || 'anon';
  return `telegram-${stamp}-${suffix}`;
}

function buildRunOutputDir(baseDir, requestId) {
  return path.join(baseDir, requestId);
}

module.exports = {
  buildRequestId,
  buildRunOutputDir,
  formatUserLabel,
  normalizePhone,
};
