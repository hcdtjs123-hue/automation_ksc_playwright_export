const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AuthStore } = require('../src_bot/auth-store');

test('AuthStore authorizes and reloads a verified user', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-auth-store-'));
  const storePath = path.join(tempDir, 'auth-users.json');
  const store = new AuthStore(storePath);

  const record = store.authorizeUser({
    chatId: '12345',
    phone: '628123456789',
    user: {
      first_name: 'Ayu',
      id: 99,
      username: 'ayu',
    },
  });

  assert.equal(record.phone, '628123456789');

  const reloaded = new AuthStore(storePath);
  const authorizedRecord = reloaded.getAuthorizedRecord('99', new Set(['628123456789']));

  assert.equal(authorizedRecord.chatId, '12345');
  assert.equal(authorizedRecord.firstName, 'Ayu');
});

test('AuthStore revokes user automatically when phone is no longer whitelisted', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-auth-store-'));
  const storePath = path.join(tempDir, 'auth-users.json');
  const store = new AuthStore(storePath);

  store.authorizeUser({
    chatId: '555',
    phone: '628999000111',
    user: {
      id: 77,
    },
  });

  const authorizedRecord = store.getAuthorizedRecord('77', new Set(['628111222333']));
  assert.equal(authorizedRecord, null);

  const written = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  assert.equal(written.users['77'], undefined);
});
