const fs = require('fs');
const path = require('path');

class AuthStore {
  constructor(storePath) {
    this.storePath = storePath;
  }

  getAuthorizedRecord(userId, allowedPhones) {
    const store = this.readStore();
    const record = store.users[String(userId)] || null;
    if (!record) {
      return null;
    }

    if (!allowedPhones.has(record.phone)) {
      delete store.users[String(userId)];
      this.writeStore(store);
      return null;
    }

    return record;
  }

  authorizeUser({ chatId, phone, user }) {
    const userId = String(user?.id || '').trim();
    if (!userId) {
      throw new Error('Cannot authorize user without Telegram user id.');
    }

    const now = new Date().toISOString();
    const store = this.readStore();
    const current = store.users[userId] || {};

    store.users[userId] = {
      chatId: String(chatId || current.chatId || '').trim(),
      firstName: String(user?.first_name || current.firstName || '').trim(),
      lastName: String(user?.last_name || current.lastName || '').trim(),
      phone: String(phone || current.phone || '').trim(),
      updatedAt: now,
      username: String(user?.username || current.username || '').trim(),
      verifiedAt: current.verifiedAt || now,
    };

    this.writeStore(store);
    return store.users[userId];
  }

  revokeUser(userId) {
    const store = this.readStore();
    if (!store.users[String(userId)]) {
      return false;
    }

    delete store.users[String(userId)];
    this.writeStore(store);
    return true;
  }

  readStore() {
    if (!fs.existsSync(this.storePath)) {
      return this.buildEmptyStore();
    }

    try {
      const raw = fs.readFileSync(this.storePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || typeof parsed.users !== 'object') {
        return this.buildEmptyStore();
      }

      return {
        users: parsed.users || {},
        version: 1,
      };
    } catch (error) {
      console.warn(`Failed to read auth store at ${this.storePath}: ${error.message}`);
      return this.buildEmptyStore();
    }
  }

  writeStore(store) {
    const payload = {
      updatedAt: new Date().toISOString(),
      users: store.users || {},
      version: 1,
    };

    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  buildEmptyStore() {
    return {
      users: {},
      version: 1,
    };
  }
}

module.exports = {
  AuthStore,
};
