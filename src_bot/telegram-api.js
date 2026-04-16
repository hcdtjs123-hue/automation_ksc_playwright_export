const fs = require('fs/promises');
const path = require('path');

class TelegramApi {
  constructor(botToken, options = {}) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
    this.timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 30000;
  }

  async deleteWebhook() {
    return this.callJson('deleteWebhook', { drop_pending_updates: false });
  }

  async sendContactRequest(chatId, text) {
    return this.sendMessage(chatId, text, {
      reply_markup: {
        keyboard: [[{ request_contact: true, text: 'Share contact' }]],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    });
  }

  async sendDocument(chatId, filePath, options = {}) {
    const fileName = path.basename(filePath);
    const form = new FormData();
    form.set('chat_id', String(chatId));
    form.set('document', await createFilePart(filePath), fileName);

    if (options.caption) {
      form.set('caption', String(options.caption));
    }

    return this.callForm('sendDocument', form);
  }

  async sendMessage(chatId, text, options = {}) {
    return this.callJson('sendMessage', {
      chat_id: String(chatId),
      text: String(text || ''),
      ...options,
    });
  }

  async setWebhook(url, secretToken) {
    return this.callJson('setWebhook', {
      allowed_updates: ['message'],
      drop_pending_updates: false,
      secret_token: secretToken,
      url,
    });
  }

  async callForm(method, form) {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
      body: form,
      method: 'POST',
    });

    return parseTelegramResponse(response, method);
  }

  async callJson(method, payload) {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify(payload),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    return parseTelegramResponse(response, method);
  }
}

async function createFilePart(filePath) {
  if (typeof fs.openAsBlob === 'function') {
    return fs.openAsBlob(filePath);
  }

  const buffer = await fs.readFile(filePath);
  return new Blob([buffer]);
}

async function parseTelegramResponse(response, method) {
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    const description = payload?.description || `${response.status} ${response.statusText}`;
    throw new Error(`Telegram API ${method} failed: ${description}`);
  }

  return payload.result;
}

module.exports = {
  TelegramApi,
};
