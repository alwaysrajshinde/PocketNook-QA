import { ChatRequestSchema, validateToolCall } from './toolSchemas.js';
import { sanitizeChatPayload } from './sanitizer.js';
import { buildPromptEnvelope } from './systemPrompt.js';
import { createLLMAdapter } from './llmAdapter.js';
import { isOriginAllowed, verifyFirebaseIdToken, hmacHashUid } from './auth.js';

const REQUEST_TIMEOUT_MS = 22_000;

function corsHeadersFor(origin, env) {
  const headers = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Firebase-AppCheck'
  };
  if (origin && isOriginAllowed(origin, env)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function jsonResponse(payload, status, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders
    }
  });
}

function encodeSseEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Pure Web-standard Cloudflare Worker request handler for /api/chat and /api/chat/session.
 * Separates HTTP logic from cloudflare:workers bindings so Node unit tests exercise exact runtime behavior.
 */
export function createWorkerHandler({ getJwks = null, fetchImpl = fetch } = {}) {
  return async function handleRequest(request, env = {}, ctx = null) {
    const origin = request.headers.get('origin') || '';
    if (!isOriginAllowed(origin, env)) {
      return jsonResponse({ success: false, code: 'CORS_FORBIDDEN', error: 'Origin not allowed' }, 403);
    }

    const corsHeaders = corsHeadersFor(origin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (env.ENVIRONMENT === 'production') {
      const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
      if (String(proto).toLowerCase() !== 'https') {
        return jsonResponse({ success: false, code: 'HTTPS_REQUIRED', error: 'HTTPS is required' }, 403, corsHeaders);
      }
    }

    // 1. Mandatory Firebase ID Token verification via jose (no test auth bypass in Worker)
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ success: false, code: 'AUTH_MISSING_TOKEN', error: 'Authentication required' }, 401, corsHeaders);
    }
    const idToken = authHeader.slice(7).trim();
    if (!idToken) {
      return jsonResponse({ success: false, code: 'AUTH_EMPTY_TOKEN', error: 'Authentication required' }, 401, corsHeaders);
    }

    let authUser;
    try {
      const jwksFn = typeof getJwks === 'function' ? getJwks(env) : null;
      authUser = await verifyFirebaseIdToken(idToken, {
        projectId: env.FIREBASE_PROJECT_ID,
        jwksFn
      });
    } catch (authErr) {
      const isExpired = authErr?.code === 'ERR_JWT_EXPIRED' || /expired/i.test(authErr?.message || '');
      return jsonResponse(
        {
          success: false,
          code: isExpired ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_INVALID_TOKEN',
          error: isExpired ? 'Session expired. Please sign in again.' : 'Unauthorized request'
        },
        401,
        corsHeaders
      );
    }

    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    // 2. Stateless session clear endpoint (transcripts are client-only IndexedDB; rate-limit counters stay intact)
    if (request.method === 'DELETE' && (pathname === '/api/chat/session' || pathname === '/session')) {
      return jsonResponse(
        {
          success: true,
          storage: 'client_indexeddb_only',
          deletedPaths: [],
          retainedForRateLimiting: ['durable_object:RATE_LIMITER']
        },
        200,
        corsHeaders
      );
    }

    if (request.method !== 'POST' || (pathname !== '/api/chat' && pathname !== '/')) {
      return jsonResponse({ success: false, code: 'NOT_FOUND', error: 'Endpoint not found' }, 404, corsHeaders);
    }

    // 3. Global AI Kill Switch (env.AI_ENABLED)
    if (String(env.AI_ENABLED || 'false').toLowerCase() !== 'true') {
      return jsonResponse(
        {
          success: false,
          code: 'AI_DISABLED',
          error: 'Online AI is temporarily paused. Using local assistant mode.'
        },
        503,
        corsHeaders
      );
    }

    // 4. Parse and strict-validate payload before rate-limiting or calling LLM
    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      return jsonResponse({ success: false, code: 'INVALID_JSON', error: 'Invalid JSON request body' }, 400, corsHeaders);
    }

    const parsed = ChatRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonResponse(
        {
          success: false,
          code: 'INVALID_CHAT_REQUEST',
          error: parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')
        },
        400,
        corsHeaders
      );
    }

    // Re-sanitize all text & context fields server-side
    const sanitized = sanitizeChatPayload(parsed.data);
    if (!sanitized.message) {
      return jsonResponse({ success: false, code: 'EMPTY_MESSAGE', error: 'Message cannot be empty' }, 400, corsHeaders);
    }

    // 5. Hash UID with LOG_HMAC_SECRET and consume Durable Object rate-limit slot
    let uidHash;
    try {
      uidHash = await hmacHashUid(authUser.uid, env);
    } catch (secErr) {
      console.error(JSON.stringify({ event: 'chat_config_error', code: 'LOG_HMAC_MISCONFIGURED' }));
      return jsonResponse({ success: false, code: 'SERVER_MISCONFIGURED', error: 'Chat service unavailable' }, 503, corsHeaders);
    }

    if (!env.RATE_LIMITER) {
      return jsonResponse({ success: false, code: 'RATE_LIMITER_UNAVAILABLE', error: 'Rate limiter unavailable' }, 503, corsHeaders);
    }

    try {
      const doId = env.RATE_LIMITER.idFromName('global-rate-limiter-v1');
      const stub = env.RATE_LIMITER.get(doId);
      const rlRes = await stub.fetch('https://rate-limiter/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uidHash,
          userPerMinLimit: Number(env.USER_PER_MIN_LIMIT || 5),
          userDailyLimit: Number(env.USER_DAILY_LIMIT || 10),
          globalDailyCap: Number(env.GLOBAL_DAILY_CAP || 150)
        })
      });
      const rlData = await rlRes.json();
      if (!rlData.allowed) {
        console.warn(
          JSON.stringify({
            event: 'chat_rate_limited',
            uidHash,
            code: rlData.code,
            reason: rlData.reason
          })
        );
        return jsonResponse(
          {
            success: false,
            code: rlData.code || 'RATE_LIMIT_EXCEEDED',
            reason: rlData.reason,
            error:
              rlData.code === 'GLOBAL_QUOTA_EXHAUSTED'
                ? 'Daily free-tier AI capacity reached. Switched to local assistant mode.'
                : rlData.code === 'USER_DAILY_QUOTA_EXHAUSTED'
                ? 'You have reached today’s 10-message AI limit. Switched to local assistant mode.'
                : 'Too many messages per minute. Using local assistant mode.'
          },
          429,
          corsHeaders
        );
      }
    } catch {
      console.error(JSON.stringify({ event: 'chat_rate_limit_error', uidHash }));
      return jsonResponse({ success: false, code: 'RATE_LIMIT_ERROR', error: 'Could not verify quota right now.' }, 503, corsHeaders);
    }

    // 6. Initialize LLM adapter from env (zero hardcoded model names)
    let adapter;
    try {
      adapter = createLLMAdapter({
        provider: env.LLM_PROVIDER,
        model: env.LLM_MODEL,
        apiKey: env.LLM_API_KEY,
        maxOutputTokens: env.LLM_MAX_OUTPUT_TOKENS,
        fetchImpl
      });
    } catch {
      console.error(JSON.stringify({ event: 'chat_adapter_config_error', uidHash }));
      return jsonResponse({ success: false, code: 'LLM_NOT_CONFIGURED', error: 'Assistant temporarily unavailable' }, 503, corsHeaders);
    }

    const envelope = buildPromptEnvelope(sanitized);
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const writeEvent = async (eventName, data) => {
      await writer.write(encoder.encode(encodeSseEvent(eventName, data)));
    };

    const startMs = Date.now();
    const streamTask = (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let tokenCount = 0;
      let errorCode = null;
      let pendingWrite = Promise.resolve();

      const enqueueWrite = (eventName, data) => {
        pendingWrite = pendingWrite.then(() => writeEvent(eventName, data)).catch(() => {});
      };

      try {
        const result = await adapter.streamChat({
          envelope,
          signal: controller.signal,
          onToken: (textChunk) => {
            enqueueWrite('token', { text: textChunk });
          },
          onToolCall: (validatedTool) => {
            if (!validatedTool.valid) {
              console.warn(JSON.stringify({ event: 'chat_tool_rejected', uidHash }));
              return;
            }
            const rechecked = validateToolCall(validatedTool.name, validatedTool.args);
            if (rechecked.valid) {
              enqueueWrite('tool_call', {
                name: rechecked.name,
                args: rechecked.args,
                requiresConfirm: rechecked.requiresConfirm,
                requestId: parsed.data.requestId || `req_${Date.now()}`
              });
            }
          }
        });

        tokenCount = Number(result?.totalTokens || 0);
        await pendingWrite;
        await writeEvent('done', { usage: { totalTokens: tokenCount } });
      } catch (err) {
        if (controller.signal.aborted) {
          errorCode = 'STREAM_TIMEOUT';
          await pendingWrite;
          await writeEvent('error', { code: 'STREAM_TIMEOUT', message: 'Assistant response timed out. Switched to local mode.' });
        } else if (err?.code === 'PROVIDER_RATE_LIMIT' || err?.status === 429) {
          errorCode = 'PROVIDER_RATE_LIMIT';
          await pendingWrite;
          await writeEvent('error', { code: 'PROVIDER_RATE_LIMIT', message: 'Free-tier AI quota busy. Using local assistant mode.' });
        } else {
          errorCode = err?.code || 'PROVIDER_ERROR';
          await pendingWrite;
          await writeEvent('error', { code: errorCode, message: 'Online AI unavailable right now. Using local assistant mode.' });
        }
      } finally {
        clearTimeout(timeoutId);
        // Metadata-only audit log: NEVER logs message text, history, merchants, or amounts.
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
        await writer.close().catch(() => {});
      }
    })();

    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(streamTask);
    }

    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        ...corsHeaders
      }
    });
  };
}
