/**
 * Local Dev & Playwright CI Express Adapter for /api/chat.
 * Test auth bypass (TEST_UID:) lives strictly here (never in worker/src/) and
 * is enabled ONLY when NODE_ENV=test AND ALLOW_TEST_AUTH=true.
 */

const { DatabaseSync } = require('node:sqlite');

let workerModulesPromise = null;
function loadWorkerModules() {
  if (!workerModulesPromise) {
    workerModulesPromise = Promise.all([
      import('../worker/src/auth.js'),
      import('../worker/src/toolSchemas.js'),
      import('../worker/src/sanitizer.js'),
      import('../worker/src/systemPrompt.js'),
      import('../worker/src/llmAdapter.js'),
      import('../worker/src/rateLimiterDO.js')
    ]).then(([auth, toolSchemas, sanitizer, systemPrompt, llmAdapter, rateLimiterDO]) => ({
      auth,
      toolSchemas,
      sanitizer,
      systemPrompt,
      llmAdapter,
      rateLimiterDO
    }));
  }
  return workerModulesPromise;
}

const BASE_ALLOWED_ORIGINS = [
  'https://alwaysrajshinde.github.io',
  'http://localhost:5173'
];

function getAllowedOrigins() {
  const extra = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV !== 'production') {
    extra.push('http://localhost:3001');
  }

  return Array.from(new Set([...BASE_ALLOWED_ORIGINS, ...extra])).filter((o) => o !== '*');
}

function isOriginAllowed(origin, allowed = getAllowedOrigins()) {
  if (!origin) return true;
  return allowed.includes(origin);
}

function createNodeSqliteShim(db) {
  return {
    exec(sqlText, ...params) {
      if (params.length === 0 && sqlText.includes(';')) {
        db.exec(sqlText);
        return { toArray: () => [] };
      }
      const trimmed = sqlText.trim().toUpperCase();
      const stmt = db.prepare(sqlText);
      if (trimmed.startsWith('SELECT')) {
        const rows = stmt.all(...params);
        return { toArray: () => rows };
      }
      stmt.run(...params);
      return { toArray: () => [] };
    }
  };
}

let sharedTestDoHandler = null;
async function getLocalRateLimiterDoBinding() {
  const { rateLimiterDO } = await loadWorkerModules();
  if (!sharedTestDoHandler) {
    const memDb = new DatabaseSync(':memory:');
    sharedTestDoHandler = rateLimiterDO.createRateLimiterDoHandler(createNodeSqliteShim(memDb));
  }
  return {
    idFromName() {
      return 'local-test-do';
    },
    get() {
      return {
        fetch(url, init) {
          return sharedTestDoHandler(new Request(url, init));
        }
      };
    }
  };
}

async function handleDevChatPost(req, res) {
  const allowTestAuth = process.env.NODE_ENV === 'test' && process.env.ALLOW_TEST_AUTH === 'true';
  const projectId = process.env.FIREBASE_PROJECT_ID || 'expense-tracker-d98cd';

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, code: 'AUTH_MISSING_TOKEN', error: 'Authentication required' });
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    return res.status(401).json({ success: false, code: 'AUTH_EMPTY_TOKEN', error: 'Authentication required' });
  }

  const mods = await loadWorkerModules();
  let uid = null;

  if (allowTestAuth) {
    if (idToken === 'EXPIRED_TEST_TOKEN') {
      return res.status(401).json({ success: false, code: 'AUTH_TOKEN_EXPIRED', error: 'Session expired. Please sign in again.' });
    }
    if (idToken.startsWith('TEST_UID:')) {
      const candidate = idToken.slice(9).trim();
      if (!candidate) {
        return res.status(401).json({ success: false, code: 'AUTH_INVALID_TOKEN', error: 'Invalid token' });
      }
      uid = candidate;
    }
  }

  if (!uid) {
    try {
      const verified = await mods.auth.verifyFirebaseIdToken(idToken, { projectId });
      uid = verified.uid;
    } catch (err) {
      const isExpired = err?.code === 'ERR_JWT_EXPIRED' || /expired/i.test(err?.message || '');
      return res.status(401).json({
        success: false,
        code: isExpired ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_INVALID_TOKEN',
        error: isExpired ? 'Session expired. Please sign in again.' : 'Unauthorized request'
      });
    }
  }

  const aiEnabled = String(process.env.AI_ENABLED ?? 'true').toLowerCase() === 'true';
  if (!aiEnabled) {
    return res.status(503).json({
      success: false,
      code: 'AI_DISABLED',
      error: 'Online AI is temporarily paused. Using local assistant mode.'
    });
  }

  const parsed = mods.toolSchemas.ChatRequestSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_CHAT_REQUEST',
      error: parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')
    });
  }

  const sanitized = mods.sanitizer.sanitizeChatPayload(parsed.data);
  if (!sanitized.message) {
    return res.status(400).json({ success: false, code: 'EMPTY_MESSAGE', error: 'Message cannot be empty' });
  }

  const envObj = {
    ENVIRONMENT: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    LOG_HMAC_SECRET: process.env.LOG_HMAC_SECRET || 'local-dev-hmac-secret-key'
  };
  const uidHash = await mods.auth.hmacHashUid(uid, envObj);

  const rlBinding = await getLocalRateLimiterDoBinding();
  const rlStub = rlBinding.get(rlBinding.idFromName('global-rate-limiter-v1'));
  const rlRes = await rlStub.fetch('https://rate-limiter/consume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uidHash,
      userPerMinLimit: Number(process.env.USER_PER_MIN_LIMIT || 5),
      userDailyLimit: Number(process.env.USER_DAILY_LIMIT || 10),
      globalDailyCap: Number(process.env.GLOBAL_DAILY_CAP || 150)
    })
  });
  const rlData = await rlRes.json();
  if (!rlData.allowed) {
    return res.status(429).json({
      success: false,
      code: rlData.code || 'RATE_LIMIT_EXCEEDED',
      reason: rlData.reason,
      error: 'Quota limit reached. Using local assistant mode.'
    });
  }

  let adapter;
  try {
    const provider = process.env.LLM_PROVIDER || (process.env.NODE_ENV !== 'production' ? 'mock' : '');
    const model = process.env.LLM_MODEL || (provider === 'mock' ? 'mock-fixture-v1' : '');
    adapter = mods.llmAdapter.createLLMAdapter({
      provider,
      model,
      apiKey: process.env.LLM_API_KEY || '',
      maxOutputTokens: process.env.LLM_MAX_OUTPUT_TOKENS
    });
  } catch {
    return res.status(503).json({ success: false, code: 'LLM_NOT_CONFIGURED', error: 'Assistant temporarily unavailable' });
  }

  const envelope = mods.systemPrompt.buildPromptEnvelope(sanitized);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 22_000);
  req.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  let tokenCount = 0;
  let errorCode = null;
  const startMs = Date.now();
  try {
    const result = await adapter.streamChat({
      envelope,
      signal: controller.signal,
      onToken: (textChunk) => {
        if (!res.writableEnded) {
          res.write(`event: token\ndata: ${JSON.stringify({ text: textChunk })}\n\n`);
        }
      },
      onToolCall: (validatedTool) => {
        if (!validatedTool.valid || res.writableEnded) return;
        const rechecked = mods.toolSchemas.validateToolCall(validatedTool.name, validatedTool.args);
        if (rechecked.valid) {
          res.write(
            `event: tool_call\ndata: ${JSON.stringify({
              name: rechecked.name,
              args: rechecked.args,
              requiresConfirm: rechecked.requiresConfirm,
              requestId: parsed.data.requestId || `req_${Date.now()}`
            })}\n\n`
          );
        }
      }
    });
    tokenCount = Number(result?.totalTokens || 0);
    if (!res.writableEnded) {
      res.write(`event: done\ndata: ${JSON.stringify({ usage: { totalTokens: tokenCount } })}\n\n`);
    }
  } catch (err) {
    errorCode = err?.code || 'PROVIDER_ERROR';
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ code: errorCode, message: 'Using local assistant mode.' })}\n\n`);
    }
  } finally {
    clearTimeout(timeoutId);
    console.info(
      JSON.stringify({
        event: 'chat_request',
        uidHash,
        provider: adapter.provider,
        model: adapter.model,
        latencyMs: Date.now() - startMs,
        tokenCount,
        errorCode
      })
    );
    if (!res.writableEnded) res.end();
  }
}

async function handleDevChatDeleteSession(req, res) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, code: 'AUTH_MISSING_TOKEN', error: 'Authentication required' });
  }
  return res.status(200).json({
    success: true,
    storage: 'client_indexeddb_only',
    deletedPaths: [],
    retainedForRateLimiting: ['durable_object:RATE_LIMITER']
  });
}

module.exports = {
  isOriginAllowed,
  getAllowedOrigins,
  handleDevChatPost,
  handleDevChatDeleteSession,
  createNodeSqliteShim
};
