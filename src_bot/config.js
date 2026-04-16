const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_ENV_PATH = path.join(PROJECT_ROOT, '.env');
const CUSTOM_ENV_PATH = path.join(PROJECT_ROOT, '.env.custom');

loadEnvFiles();

function loadEnvFiles() {
  require('dotenv').config({ path: DEFAULT_ENV_PATH });

  if (fs.existsSync(CUSTOM_ENV_PATH)) {
    require('dotenv').config({ path: CUSTOM_ENV_PATH, override: true });
  }
}

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePort(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseTimeout(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function normalizeResultMode(rawValue) {
  const normalized = String(rawValue || '').trim().toLowerCase();
  if (!normalized) return 'zip';
  if (normalized === 'zip' || normalized === 'files') return normalized;
  throw new Error(`Unsupported TELEGRAM_RESULT_MODE: ${rawValue}. Use zip or files.`);
}

function buildWebhookUrl() {
  const configured = String(process.env.TELEGRAM_WEBHOOK_URL || '').trim();
  if (configured) {
    return configured;
  }

  const publicDomain = String(process.env.RAILWAY_PUBLIC_DOMAIN || '').trim();
  if (!publicDomain) {
    return '';
  }

  return `https://${publicDomain}/telegram/webhook`;
}

function parseAllowedPhones(rawValue) {
  const { normalizePhone } = require('./utils');

  return new Set(
    String(rawValue || '')
      .split(',')
      .map((item) => normalizePhone(item))
      .filter(Boolean)
  );
}

const outputRoot = process.env.ACCURATE_OUTPUT_DIR
  ? path.resolve(PROJECT_ROOT, process.env.ACCURATE_OUTPUT_DIR)
  : path.join(PROJECT_ROOT, 'output', 'playwright', 'telegram', 'runs');
const authStorePath = process.env.TELEGRAM_AUTH_STORE_PATH
  ? path.resolve(PROJECT_ROOT, process.env.TELEGRAM_AUTH_STORE_PATH)
  : path.join(path.dirname(outputRoot), 'auth-users.json');

const CONFIG = {
  authStorePath,
  host: process.env.HOST || '0.0.0.0',
  outputRoot,
  port: parsePort(process.env.PORT, 3000),
  projectRoot: PROJECT_ROOT,
  resultMode: normalizeResultMode(process.env.TELEGRAM_RESULT_MODE),
  telegramApiTimeoutMs: parseTimeout(process.env.TELEGRAM_API_TIMEOUT_MS, 30000),
  telegramAllowedPhones: parseAllowedPhones(process.env.TELEGRAM_ALLOWED_PHONES),
  telegramBotToken: requireEnv('TELEGRAM_BOT_TOKEN'),
  telegramWebhookSecret: requireEnv('TELEGRAM_WEBHOOK_SECRET'),
  telegramWebhookUrl: buildWebhookUrl(),
};

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureBotRuntimeDirectories() {
  ensureDir(CONFIG.outputRoot);
  ensureDir(path.dirname(CONFIG.authStorePath));
}

function logBotStartupConfig() {
  console.log('Bot runtime config:', {
    authStorePath: CONFIG.authStorePath,
    host: CONFIG.host,
    outputRoot: CONFIG.outputRoot,
    port: CONFIG.port,
    resultMode: CONFIG.resultMode,
    telegramApiTimeoutMs: CONFIG.telegramApiTimeoutMs,
    telegramAllowedPhonesCount: CONFIG.telegramAllowedPhones.size,
    telegramWebhookUrl: CONFIG.telegramWebhookUrl,
  });
}

module.exports = {
  CONFIG,
  PROJECT_ROOT,
  ensureBotRuntimeDirectories,
  ensureDir,
  logBotStartupConfig,
};
