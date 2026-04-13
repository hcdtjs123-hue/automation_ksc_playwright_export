const http = require('http');
const fs = require('fs');
const path = require('path');
const { AuthStore } = require('./auth-store');
const { getExportUsageText, parseExportCommand } = require('./command-parser');
const { CONFIG, ensureBotRuntimeDirectories, logBotStartupConfig } = require('./config');
const { runCustomExport } = require('./export-runner');
const { TelegramApi } = require('./telegram-api');
const { buildRequestId, buildRunOutputDir, formatUserLabel, normalizePhone } = require('./utils');

const authStore = new AuthStore(CONFIG.authStorePath);
const telegram = new TelegramApi(CONFIG.telegramBotToken);
let currentRun = null;

async function bootstrap() {
  ensureBotRuntimeDirectories();
  logBotStartupConfig();

  if (CONFIG.telegramWebhookUrl) {
    await telegram.setWebhook(CONFIG.telegramWebhookUrl, CONFIG.telegramWebhookSecret);
    console.log(`Telegram webhook set to ${CONFIG.telegramWebhookUrl}`);
  } else {
    console.log('TELEGRAM_WEBHOOK_URL and RAILWAY_PUBLIC_DOMAIN are empty. Skipping setWebhook.');
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/healthz') {
        sendJson(res, 200, {
          currentRun,
          ok: true,
          uptimeSec: Math.round(process.uptime()),
        });
        return;
      }

      if (req.method === 'POST' && req.url === '/telegram/webhook') {
        const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
        if (secretHeader !== CONFIG.telegramWebhookSecret) {
          sendJson(res, 401, { ok: false });
          return;
        }

        const body = await readJsonBody(req);
        sendJson(res, 200, { ok: true });
        processUpdate(body).catch((error) => {
          console.error('Webhook update failed:', error);
        });
        return;
      }

      sendJson(res, 404, { ok: false });
    } catch (error) {
      console.error('HTTP handler failed:', error);
      sendJson(res, 500, { ok: false });
    }
  });

  server.listen(CONFIG.port, CONFIG.host, () => {
    console.log(`Telegram bot listening on http://${CONFIG.host}:${CONFIG.port}`);
  });
}

async function processUpdate(update) {
  const message = update?.message;
  if (!message || message.chat?.type !== 'private') {
    return;
  }

  const chatId = String(message.chat.id || '').trim();
  const user = message.from || {};
  const userId = String(user.id || '').trim();
  if (!chatId || !userId) {
    return;
  }

  if (message.contact) {
    await handleContactMessage({ chatId, contact: message.contact, user });
    return;
  }

  const text = String(message.text || '').trim();
  if (!text.startsWith('/')) {
    return;
  }

  const command = text.split(/\s+/, 1)[0].toLowerCase();

  if (isStartCommand(command)) {
    await handleStartCommand({ chatId, user, userId });
    return;
  }

  const authorizedRecord = authStore.getAuthorizedRecord(userId, CONFIG.telegramAllowedPhones);
  if (!authorizedRecord) {
    await telegram.sendContactRequest(
      chatId,
      'Akses bot belum aktif. Tekan tombol "Share contact" lalu kirim nomor Telegram Anda yang sudah masuk whitelist env.'
    );
    return;
  }

  if (isHelpCommand(command)) {
    await telegram.sendMessage(chatId, buildHelpText());
    return;
  }

  if (isWhoAmICommand(command)) {
    await telegram.sendMessage(chatId, buildWhoAmIText({ authorizedRecord, chatId, user }));
    return;
  }

  if (isStatusCommand(command)) {
    await telegram.sendMessage(chatId, buildStatusText());
    return;
  }

  if (isExportCommand(command)) {
    await handleExportCommand({ chatId, text, user });
    return;
  }

  await telegram.sendMessage(chatId, buildHelpText());
}

async function handleStartCommand({ chatId, user, userId }) {
  const authorizedRecord = authStore.getAuthorizedRecord(userId, CONFIG.telegramAllowedPhones);
  if (authorizedRecord) {
    await telegram.sendMessage(chatId, buildWelcomeText(user), {
      reply_markup: {
        remove_keyboard: true,
      },
    });
    return;
  }

  await telegram.sendContactRequest(
    chatId,
    [
      `Halo ${formatUserLabel(user)}.`,
      'Bot ini hanya bisa dipakai oleh nomor HP yang sudah didaftarkan di env.',
      'Silakan tekan tombol "Share contact" untuk verifikasi sekali saja.',
    ].join('\n')
  );
}

async function handleContactMessage({ chatId, contact, user }) {
  if (String(contact.user_id || '') !== String(user.id || '')) {
    await telegram.sendMessage(
      chatId,
      'Kontak yang dikirim harus milik akun Telegram yang sama. Coba kirim ulang lewat tombol "Share contact".'
    );
    return;
  }

  const normalizedPhone = normalizePhone(contact.phone_number);
  if (!normalizedPhone || !CONFIG.telegramAllowedPhones.has(normalizedPhone)) {
    authStore.revokeUser(user.id);
    await telegram.sendMessage(
      chatId,
      'Nomor HP ini belum terdaftar di whitelist env. Minta admin menambahkan nomor Anda terlebih dulu.'
    );
    return;
  }

  authStore.authorizeUser({
    chatId,
    phone: normalizedPhone,
    user,
  });

  await telegram.sendMessage(chatId, buildWelcomeText(user), {
    reply_markup: {
      remove_keyboard: true,
    },
  });
}

async function handleExportCommand({ chatId, text, user }) {
  if (currentRun) {
    await telegram.sendMessage(
      chatId,
      `Masih ada export yang berjalan untuk ${currentRun.userLabel} sejak ${currentRun.startedAt}. Coba lagi setelah selesai.`
    );
    return;
  }

  let parsedCommand;
  try {
    parsedCommand = parseExportCommand(text);
  } catch (error) {
    await telegram.sendMessage(chatId, `${error.message}\n\n${getExportUsageText()}`);
    return;
  }

  const requestId = buildRequestId(user.id);
  const outputDir = buildRunOutputDir(CONFIG.outputRoot, requestId);
  const payload = {
    chatId,
    exportPlan: parsedCommand.exportPlan,
    multiPeriod: parsedCommand.multiPeriod,
    outputDir,
    requestId,
    result: {
      mode: CONFIG.resultMode,
    },
  };

  currentRun = {
    chatId,
    requestId,
    startedAt: new Date().toISOString(),
    userId: String(user.id),
    userLabel: formatUserLabel(user),
  };

  await telegram.sendMessage(
    chatId,
    [
      `Export dimulai untuk ${formatUserLabel(user)}.`,
      `requestId: ${requestId}`,
      `mode: ${CONFIG.resultMode}`,
    ].join('\n')
  );

  try {
    const { runResult } = await runCustomExport({
      payload,
      projectRoot: CONFIG.projectRoot,
    });

    await sendRunArtifacts(chatId, runResult);
    await telegram.sendMessage(chatId, buildRunSuccessText(runResult));
  } catch (error) {
    console.error('Export run failed:', error);
    await telegram.sendMessage(
      chatId,
      [
        'Export gagal dijalankan.',
        sanitizeErrorMessage(error),
        'Silakan cek log Railway untuk detail teknis.',
      ].join('\n')
    );
  } finally {
    currentRun = null;
  }
}

async function sendRunArtifacts(chatId, runResult) {
  const bundlePath = runResult?.bundle?.path;
  if (bundlePath && fs.existsSync(bundlePath)) {
    await telegram.sendDocument(chatId, bundlePath, {
      caption: `Bundle hasil export: ${path.basename(bundlePath)}`,
    });
    return;
  }

  const files = Array.isArray(runResult?.files) ? runResult.files : [];
  let sentCount = 0;

  for (const file of files) {
    if (!file?.path || !fs.existsSync(file.path)) {
      continue;
    }

    await telegram.sendDocument(chatId, file.path, {
      caption: `File ${file.kind || 'export'}: ${file.fileName || path.basename(file.path)}`,
    });
    sentCount += 1;
  }

  if (sentCount === 0) {
    await telegram.sendMessage(chatId, 'Export selesai, tetapi tidak ada file yang ditemukan untuk dikirim.');
  }
}

function buildHelpText() {
  return [
    'Command yang tersedia:',
    '/help',
    '/status',
    '/whoami',
    '/export ...',
    '',
    getExportUsageText(),
  ].join('\n');
}

function buildRunSuccessText(runResult) {
  const files = Array.isArray(runResult?.files) ? runResult.files.length : 0;
  return [
    'Export selesai.',
    `file count: ${files}`,
    `manifest: ${runResult?.manifestPath || '-'}`,
    `bundle: ${runResult?.bundle?.fileName || '-'}`,
  ].join('\n');
}

function buildStatusText() {
  if (!currentRun) {
    return 'Bot siap menerima request. Tidak ada export yang sedang berjalan.';
  }

  return [
    'Ada export yang sedang berjalan.',
    `user: ${currentRun.userLabel}`,
    `requestId: ${currentRun.requestId}`,
    `startedAt: ${currentRun.startedAt}`,
  ].join('\n');
}

function buildWelcomeText(user) {
  return [
    `Halo ${formatUserLabel(user)}. Verifikasi berhasil.`,
    'Anda sekarang bisa memakai bot ini.',
    '',
    buildHelpText(),
  ].join('\n');
}

function buildWhoAmIText({ authorizedRecord, chatId, user }) {
  return [
    `name: ${formatUserLabel(user)}`,
    `telegram_user_id: ${user.id}`,
    `chat_id: ${chatId}`,
    `phone: ${authorizedRecord.phone}`,
    `verified_at: ${authorizedRecord.verifiedAt}`,
  ].join('\n');
}

function isExportCommand(command) {
  return /^\/export(?:@[\w_]+)?$/i.test(command);
}

function isHelpCommand(command) {
  return /^\/help(?:@[\w_]+)?$/i.test(command);
}

function isStartCommand(command) {
  return /^\/start(?:@[\w_]+)?$/i.test(command);
}

function isStatusCommand(command) {
  return /^\/status(?:@[\w_]+)?$/i.test(command);
}

function isWhoAmICommand(command) {
  return /^\/whoami(?:@[\w_]+)?$/i.test(command);
}

function sanitizeErrorMessage(error) {
  const rawMessage = String(error?.message || 'Unknown error');
  return redactSecret(
    redactSecret(
      redactSecret(rawMessage, process.env.ACCURATE_EMAIL, '[redacted-email]'),
      process.env.ACCURATE_PASSWORD,
      '[redacted-password]'
    ),
    process.env.TELEGRAM_BOT_TOKEN,
    '[redacted-bot-token]'
  ).slice(0, 500);
}

function redactSecret(text, secret, label) {
  const normalizedSecret = String(secret || '');
  if (!normalizedSecret) {
    return String(text || '');
  }

  return String(text || '').replaceAll(normalizedSecret, label);
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(`${JSON.stringify(payload)}\n`);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');

    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

bootstrap().catch(async (error) => {
  console.error('Failed to start Telegram bot server:', error);

  if (CONFIG.telegramWebhookUrl) {
    try {
      await telegram.deleteWebhook();
    } catch (deleteError) {
      console.error('Failed to cleanup webhook after bootstrap error:', deleteError);
    }
  }

  process.exit(1);
});
