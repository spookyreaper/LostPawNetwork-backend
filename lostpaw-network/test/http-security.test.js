const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { http } = require('../config/http');

async function withServer({ production = false, trustProxy = false } = {}, run) {
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = production ? 'production' : 'test';
  const app = express();
  app.set('trust proxy', trustProxy);
  app.use(http.middleware.securityHeaders, http.middleware.requireHttps, http.middleware.requireAuthJson, http.middleware.bodyParser);
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.post('/user/login', (req, res) => res.json({ received: Boolean(req.body) }));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
}

test('production rejects cleartext credentials and ignores spoofed HTTPS headers from untrusted peers', async () => {
  await withServer({ production: true }, async (base) => {
    for (const headers of [{}, { 'X-Forwarded-Proto': 'https', 'X-Forwarded-For': '198.51.100.10' }]) {
      const response = await fetch(`${base}/user/login`, { method: 'POST', headers });
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { message: 'HTTPS is required.' });
      assert.equal(response.headers.get('strict-transport-security'), null);
    }
    assert.equal((await fetch(`${base}/health`)).status, 200);
  });
});

test('explicit trusted TLS proxy permits auth and receives hardened response headers', async () => {
  await withServer({ production: true, trustProxy: ['127.0.0.1', '::1'] }, async (base) => {
    const response = await fetch(`${base}/user/login`, {
      method: 'POST', headers: { 'X-Forwarded-Proto': 'https', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.test', password: 'not-a-real-account' }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  });
});

test('body parser rejects oversized or malformed JSON without echoing credentials or stack traces', async () => {
  await withServer({}, async (base) => {
    const oversized = await fetch(`${base}/user/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'private-value'.repeat(4000) }),
    });
    assert.equal(oversized.status, 413);
    assert.deepEqual(await oversized.json(), { message: 'Request body is too large.' });
    const malformed = await fetch(`${base}/user/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"password":"private-value", broken}',
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { message: 'Invalid request body.' });
    const valid = await fetch(`${base}/user/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email":"owner@example.test"}',
    });
    assert.equal(valid.status, 200);
  });
});

test('authentication endpoints reject non-JSON bodies before attempting to parse them', async () => {
  await withServer({}, async (base) => {
    for (const contentType of ['application/x-www-form-urlencoded', 'multipart/form-data; boundary=unused', 'text/plain']) {
      const response = await fetch(`${base}/user/login`, {
        method: 'POST', headers: { 'Content-Type': contentType }, body: 'private-password',
      });
      assert.equal(response.status, 415);
      assert.deepEqual(await response.json(), { message: 'Send authentication requests as application/json.' });
    }
    const update = await fetch(`${base}/user/password`, {
      method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: 'private-password',
    });
    assert.equal(update.status, 415);
    const remove = await fetch(`${base}/user/owner-id`, {
      method: 'DELETE', headers: { 'Content-Type': 'text/plain' }, body: 'private-password',
    });
    assert.equal(remove.status, 415);
  });
});

test('Sails production environment requires TLS even if selected without NODE_ENV', () => {
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    const req = { secure: false, path: '/user/login', _sails: { config: { environment: 'production' } } };
    const res = {
      status(code) { this.code = code; return this; },
      json(body) { this.body = body; return this; },
    };
    let allowed = false;
    http.middleware.requireHttps(req, res, () => { allowed = true; });
    assert.equal(allowed, false);
    assert.equal(res.code, 403);
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});
