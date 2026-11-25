const crypto = require('crypto');
const { ChatRequestSchema } = require('./toolSchemas');
const { buildPromptEnvelope } = require('./systemPrompt');
const { createLLMAdapter } = require('./llmAdapter');
const { hashUid } = require('./rateLimiter');

const STREAM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 20_000);

function writeSseEvent(res, event, data) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  if (typeof res.flush === 'function') {
    res.flush();
  }
}

/**
 * Shared SSE streaming chat handler for Firebase Cloud Functions v2 and local Express dev server.
 */
function createChatHandler({ rateLimiter, getAdapter = createLLMAdapter, firestoreDb = null } = {}) {
  async function handlePostChat(req, res) {
    const startMs = Date.now();
    const uid = req.authUid;
    const uidHash = hashUid(uid);

    // 1. Validate request payload strictly via Zod
    const parsedBody = ChatRequestSchema.safeParse(req.body || {});
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_INPUT',
        error: parsedBody.error.issues[0]?.message || 'Invalid chat request'
      });
    }

    const { message, history, olderSummary, context, requestId } = parsedBody.data;

    // 2. Enforce per-user rate limit & daily token budget
    if (rateLimiter) {
      try {
        const limitCheck = await rateLimiter.check(uid);
        if (!limitCheck.allowed) {
          res.setHeader('Retry-After', String(limitCheck.retryAfterSec || 60));
          return res.status(429).json({
            success: false,
            code: limitCheck.reason === 'daily_token_budget' ? 'TOKEN_BUDGET_EXCEEDED' : 'RATE_LIMIT_EXCEEDED',
            error: 'You are sending messages too fast. Please wait a moment and try again.'
          });
        }
      } catch (rlErr) {
        console.error(`[CHAT_RATE_LIMIT_ERR] uidHash=${uidHash} code=${rlErr.code || 'ERR'}`);
      }
    }

    // 3. Initialize swappable LLM adapter before opening SSE headers
    let adapter;
    try {
      adapter = getAdapter();
    } catch (cfgErr) {
      console.error(`[CHAT_CONFIG_ERR] uidHash=${uidHash} err=${cfgErr.message}`);
      return res.status(503).json({
        success: false,
        code: 'PROVIDER_NOT_CONFIGURED',
        error: 'Assistant service is temporarily unavailable.'
      });
    }

    // 4. Open SSE stream cleanly
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, STREAM_TIMEOUT_MS);

    req.on('close', () => {
      if (!res.writableEnded) {
        controller.abort();
      }
    });

    const envelope = buildPromptEnvelope({ message, history, olderSummary, context });
    let tokenCount = 0;
    let errorCode = null;

    try {
      const result = await adapter.streamChat({
        envelope,
        signal: controller.signal,
        onToken: (textChunk) => {
          writeSseEvent(res, 'token', { text: textChunk });
        },
        onToolCall: (validatedTool) => {
          if (!validatedTool.valid) {
            errorCode = 'INVALID_TOOL_CALL';
            console.warn(`[CHAT_TOOL_REJECTED] uidHash=${uidHash} err=${validatedTool.error}`);
            return;
          }
          const txReqId = requestId || `req_${crypto.randomUUID()}`;
          writeSseEvent(res, 'tool_call', {
            name: validatedTool.name,
            args: validatedTool.args,
            requiresConfirm: validatedTool.requiresConfirm,
            requestId: `${txReqId}:${validatedTool.name}`
          });
        }
      });

      tokenCount = Number(result?.totalTokens || 0);
      if (rateLimiter && tokenCount > 0) {
        await rateLimiter.recordTokens(uid, tokenCount);
      }

      writeSseEvent(res, 'done', {
        usage: { totalTokens: tokenCount },
        provider: adapter.provider,
        model: adapter.model
      });
    } catch (err) {
      if (timedOut) {
        errorCode = 'STREAM_TIMEOUT';
        writeSseEvent(res, 'error', { code: 'STREAM_TIMEOUT', message: 'Assistant timed out. Please retry.' });
      } else if (controller.signal.aborted) {
        errorCode = 'CLIENT_ABORTED';
      } else if (err?.code === 'PROVIDER_RATE_LIMIT' || err?.status === 429) {
        errorCode = 'PROVIDER_RATE_LIMIT';
        writeSseEvent(res, 'error', { code: 'PROVIDER_RATE_LIMIT', message: 'AI provider is busy. Please try again in a few seconds.' });
      } else {
        errorCode = err?.code || 'PROVIDER_ERROR';
        writeSseEvent(res, 'error', { code: errorCode, message: 'Assistant could not complete your request right now. Please try again.' });
      }
    } finally {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startMs;
      // Metadata-only logging (never log message content, merchant names, or financial data)
      console.info(
        JSON.stringify({
          event: 'chat_request',
          uidHash,
          provider: adapter.provider,
          model: adapter.model,
          latencyMs,
          tokenCount,
          errorCode
        })
      );
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  /**
   * Deletes any server-side chat session/rate metadata copy when user taps "Clear chat"
   */
  async function handleDeleteSession(req, res) {
    const uid = req.authUid;
    try {
      if (firestoreDb) {
        const ref = firestoreDb.doc(`users/${uid}/chat_sessions/active`);
        await ref.delete().catch(() => {});
      }
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Could not clear server session copy' });
    }
  }

  return {
    handlePostChat,
    handleDeleteSession
  };
}

module.exports = {
  createChatHandler,
  STREAM_TIMEOUT_MS
};
