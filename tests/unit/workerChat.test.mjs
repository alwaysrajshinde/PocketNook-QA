import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet } from 'jose';

import { createWorkerHandler } from '../../worker/src/app.js';
import { createRateLimiterDoHandler } from '../../worker/src/rateLimiterDO.js';
import { hmacHashUid } from '../../worker/src/auth.js';

const require = createRequire(import.meta.url);
const { createNodeSqliteShim } = require('../../server/devChatRouter');

function createTestDoNamespace() {
  const memDb = new DatabaseSync(':memory:');
  const doHandler = createRateLimiterDoHandler(createNodeSqliteShim(memDb));
  return {
    idFromName() {
      return 'global-rate-limiter-v1';
    },
    get() {
      return {
        fetch(url, init) {
          return doHandler(new Request(url, init));
        }
      };
    }
  };
}

async function createSignedJwtFixture({
  projectId = 'expense-tracker-d98cd',
  sub = 'firebase_user_1',
  kid = 'test-kid-1',
  issuer,
  audience,
  expiresIn = '10m',
  authTimeOffsetSec = -30
} = {}) {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const pubJwk = await exportJWK(publicKey);
  pubJwk.kid = kid;
  pubJwk.alg = 'RS256';
  pubJwk.use = 'sig';

  const nowSec = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({ auth_time: nowSec + authTimeOffsetSec })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(issuer || `https://securetoken.google.com/${projectId}`)
    .setAudience(audience || projectId)
    .setSubject(sub)
    .setIssuedAt(nowSec)
    .setExpirationTime(expiresIn)
    .sign(privateKey);

  return {
    jwt,
    pubJwk,
    jwksFn: createLocalJWKSet({ keys: [pubJwk] })
  };
}

test('Worker source code contains ZERO TEST_UID bypasses and rejects TEST_UID bearer tokens', async () => {
  const srcDir = path.resolve(process.cwd(), 'worker/src');
  const entries = await fs.readdir(srcDir);
  for (const name of entries) {
    if (!name.endsWith('.js')) continue;
    const text = await fs.readFile(path.join(srcDir, name), 'utf8');
    assert.ok(!text.includes('TEST_UID'), `worker/src/${name} must not contain TEST_UID`);
    assert.ok(!text.includes('EXPIRED_TEST_TOKEN'), `worker/src/${name} must not contain EXPIRED_TEST_TOKEN`);
  }

  const handler = createWorkerHandler();
  const env = {
    ENVIRONMENT: 'production',
    AI_ENABLED: 'true',
    FIREBASE_PROJECT_ID: 'expense-tracker-d98cd',
    LLM_PROVIDER: 'mock',
    LLM_MODEL: 'mock-fixture-v1',
    LOG_HMAC_SECRET: 'worker-secret-test-32-byte-string',
    RATE_LIMITER: createTestDoNamespace()
  };

  const res = await handler(
    new Request('https://worker.example/api/chat', {
      method: 'POST',
      headers: {
        Origin: 'https://alwaysrajshinde.github.io',
        'Content-Type': 'application/json',
        Authorization: 'Bearer TEST_UID:attacker'
      },
      body: JSON.stringify({ message: 'Hello' })
    }),
    env
  );
  assert.equal(res.status, 401);
});

test('Worker jose JWT check validates RS256, iss, aud, sub, and rejects invalid tokens', async () => {
  const { jwt: goodJwt, jwksFn } = await createSignedJwtFixture({ sub: 'uid_good_1' });
  const { jwt: wrongAudJwt, jwksFn: audJwks } = await createSignedJwtFixture({ audience: 'other-project', sub: 'u1' });
  const { jwt: wrongIssJwt, jwksFn: issJwks } = await createSignedJwtFixture({ issuer: 'https://evil.example', sub: 'u1' });
  const { jwt: emptySubJwt, jwksFn: subJwks } = await createSignedJwtFixture({ sub: '   ' });

  const env = {
    ENVIRONMENT: 'production',
    AI_ENABLED: 'true',
    FIREBASE_PROJECT_ID: 'expense-tracker-d98cd',
    LLM_PROVIDER: 'mock',
    LLM_MODEL: 'mock-fixture-v1',
    LOG_HMAC_SECRET: 'worker-secret-test-32-byte-string',
    RATE_LIMITER: createTestDoNamespace()
  };

  // Bad audience
  let handler = createWorkerHandler({ getJwks: () => audJwks });
  let res = await handler(
    new Request('https://worker.example/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${wrongAudJwt}` },
      body: JSON.stringify({ message: 'Hi' })
    }),
    env
  );
  assert.equal(res.status, 401);

  // Bad issuer
  handler = createWorkerHandler({ getJwks: () => issJwks });
  res = await handler(
    new Request('https://worker.example/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${wrongIssJwt}` },
      body: JSON.stringify({ message: 'Hi' })
    }),
    env
  );
  assert.equal(res.status, 401);

  // Empty sub
  handler = createWorkerHandler({ getJwks: () => subJwks });
  res = await handler(
    new Request('https://worker.example/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${emptySubJwt}` },
      body: JSON.stringify({ message: 'Hi' })
    }),
    env
  );
  assert.equal(res.status, 401);

  // Valid JWT + Kill Switch OFF -> 503 AI_DISABLED
  handler = createWorkerHandler({ getJwks: () => jwksFn });
  const pausedRes = await handler(
    new Request('https://worker.example/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${goodJwt}` },
      body: JSON.stringify({ message: 'Hi' })
    }),
    { ...env, AI_ENABLED: 'false' }
  );
  assert.equal(pausedRes.status, 503);
  assert.equal((await pausedRes.json()).code, 'AI_DISABLED');
});

test('Worker DO SQLite enforces 10/day user limit, GLOBAL_DAILY_CAP, salted HMAC UID hashing, zero message logging, and zero retry loops', async () => {
  const { jwt: userA, pubJwk: jwkA } = await createSignedJwtFixture({ sub: 'user_alpha', kid: 'kid-alpha' });
  const { jwt: userB, pubJwk: jwkB } = await createSignedJwtFixture({ sub: 'user_beta', kid: 'kid-beta' });
  const combinedJwks = createLocalJWKSet({ keys: [jwkA, jwkB] });

  let upstreamFetchCalls = 0;
  let capturedGeminiBody = null;
  const mockGemini429OnceFetch = async (_url, init) => {
    upstreamFetchCalls += 1;
    capturedGeminiBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ error: { message: 'Resource exhausted' } }), { status: 429 });
  };

  const env = {
    ENVIRONMENT: 'production',
    AI_ENABLED: 'true',
    FIREBASE_PROJECT_ID: 'expense-tracker-d98cd',
    LLM_PROVIDER: 'gemini',
    LLM_MODEL: 'gemini-2.5-flash-lite',
    LLM_API_KEY: 'dummy-worker-secret',
    LLM_MAX_OUTPUT_TOKENS: '320',
    LOG_HMAC_SECRET: 'salt-secret-value-123456',
    USER_PER_MIN_LIMIT: '50',
    USER_DAILY_LIMIT: '10',
    GLOBAL_DAILY_CAP: '12',
    RATE_LIMITER: createTestDoNamespace()
  };

  // Salted HMAC verification
  const hash1 = await hmacHashUid('user_alpha', env);
  const hash2 = await hmacHashUid('user_alpha', { ...env, LOG_HMAC_SECRET: 'different-salt-value-1234' });
  assert.notEqual(hash1, hash2);

  // Intercept console.info to verify zero message text / amount logging
  const origInfo = console.info;
  const loggedLines = [];
  console.info = (...args) => loggedLines.push(args.join(' '));

  try {
    const geminiHandler = createWorkerHandler({
      getJwks: () => combinedJwks,
      fetchImpl: mockGemini429OnceFetch
    });
    const res429 = await geminiHandler(
      new Request('https://worker.example/api/chat', {
        method: 'POST',
        headers: {
          Origin: 'https://alwaysrajshinde.github.io',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userA}`
        },
        body: JSON.stringify({ message: 'SECRET_USER_TEXT ₹98765 Swiggy dinner' })
      }),
      env
    );
    assert.equal(res429.status, 200);
    const sseText = await res429.text();
    assert.ok(sseText.includes('PROVIDER_RATE_LIMIT'));
    // Strictly 1 fetch attempt (zero retry loops!)
    assert.equal(upstreamFetchCalls, 1);
    assert.equal(capturedGeminiBody.generationConfig.maxOutputTokens, 320);

    // Logs must NOT contain message text, merchant, amount, or raw UID
    assert.ok(loggedLines.length >= 1);
    const allLogs = loggedLines.join('\n');
    assert.ok(!allLogs.includes('SECRET_USER_TEXT'));
    assert.ok(!allLogs.includes('98765'));
    assert.ok(!allLogs.includes('Swiggy'));
    assert.ok(!allLogs.includes('user_alpha'));
    assert.ok(allLogs.includes(hash1));

    // User A already used 1 of 10 today; use 9 more -> 10th total succeeds, 11th hits USER_DAILY_QUOTA_EXHAUSTED
    const mockHandler = createWorkerHandler({ getJwks: () => combinedJwks });
    const mockEnv = { ...env, LLM_PROVIDER: 'mock', LLM_MODEL: 'mock-fixture-v1' };
    for (let i = 0; i < 9; i++) {
      const r = await mockHandler(
        new Request('https://worker.example/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA}` },
          body: JSON.stringify({ message: `msg ${i}` })
        }),
        mockEnv
      );
      assert.equal(r.status, 200);
    }

    const userALimitRes = await mockHandler(
      new Request('https://worker.example/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA}` },
        body: JSON.stringify({ message: '11th msg' })
      }),
      mockEnv
    );
    assert.equal(userALimitRes.status, 429);
    assert.equal((await userALimitRes.json()).code, 'USER_DAILY_QUOTA_EXHAUSTED');

    // User B hits global daily cap (10 already used + 2 by userB = 12, 3rd by userB hits GLOBAL_QUOTA_EXHAUSTED)
    for (let i = 0; i < 2; i++) {
      const rb = await mockHandler(
        new Request('https://worker.example/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB}` },
          body: JSON.stringify({ message: `b ${i}` })
        }),
        mockEnv
      );
      assert.equal(rb.status, 200);
    }
    const globalLimitRes = await mockHandler(
      new Request('https://worker.example/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB}` },
        body: JSON.stringify({ message: 'exceed global' })
      }),
      mockEnv
    );
    assert.equal(globalLimitRes.status, 429);
    assert.equal((await globalLimitRes.json()).code, 'GLOBAL_QUOTA_EXHAUSTED');
  } finally {
    console.info = origInfo;
  }
});
