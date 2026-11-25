import { useState, useRef, useCallback } from 'react';
import { auth, isFirebaseConfigured } from '../firebase/config';
import { validateClientToolCall } from '../services/chatToolSchemas';

const DEFAULT_CHAT_ENDPOINT = '/api/chat';
const CLIENT_TIMEOUT_MS = 20_000;

function getChatEndpoint() {
  const envUrl = import.meta.env?.VITE_CHAT_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim();
  }
  return DEFAULT_CHAT_ENDPOINT;
}

async function resolveBearerToken(userId) {
  if (isFirebaseConfigured && auth?.currentUser) {
    return auth.currentUser.getIdToken();
  }
  // In local Express dev or Playwright CI where Firebase SDK is disabled, pass test-harness token
  if (typeof window !== 'undefined' && (window.navigator?.webdriver || window.location.hostname === 'localhost')) {
    return `TEST_UID:${userId || 'dev_user'}`;
  }
  return null;
}

function toFriendlyError(code, status) {
  if (code === 'STREAM_TIMEOUT' || code === 'CLIENT_TIMEOUT') {
    return 'The assistant took too long to respond (20s timeout). Switched to local guidance—tap Retry to try again.';
  }
  if (status === 429 || code === 'RATE_LIMIT_EXCEEDED' || code === 'PROVIDER_RATE_LIMIT') {
    return 'Too many requests right now. Please wait a few seconds before trying again.';
  }
  if (status === 401 || code === 'AUTH_MISSING_TOKEN' || code === 'AUTH_TOKEN_EXPIRED') {
    return 'Your session needs to be refreshed. Please sign in again to use online AI chat.';
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'You appear to be offline. Using local assistant mode.';
  }
  return 'Online AI service is temporarily unavailable. Using local assistant mode.';
}

/**
 * React hook for SSE streaming chat with Stop generating (AbortController), timeouts, and tool call validation.
 */
export function useChatStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef(null);

  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const streamChat = useCallback(async ({
    message,
    isSmsPaste = false,
    history = [],
    olderSummary = null,
    context = null,
    requestId,
    userId,
    onToken,
    onToolCall
  }) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);

    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CLIENT_TIMEOUT_MS);

    try {
      const token = await resolveBearerToken(userId);
      if (!token) {
        return {
          ok: false,
          code: 'AUTH_MISSING_TOKEN',
          friendlyError: toFriendlyError('AUTH_MISSING_TOKEN', 401)
        };
      }

      const endpoint = getChatEndpoint();
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message,
          isSmsPaste,
          history,
          olderSummary,
          context,
          requestId
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        let errJson = {};
        try { errJson = await res.json(); } catch (e) {}
        const code = errJson.code || (res.status === 429 ? 'RATE_LIMIT_EXCEEDED' : 'HTTP_ERROR');
        return {
          ok: false,
          code,
          status: res.status,
          friendlyError: toFriendlyError(code, res.status)
        };
      }

      const contentType = res.headers.get('content-type') || '';
      if (!res.body || !contentType.includes('text/event-stream')) {
        return {
          ok: false,
          code: 'NON_STREAM_RESPONSE',
          friendlyError: toFriendlyError('NON_STREAM_RESPONSE', res.status)
        };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';
      let currentEvent = 'message';
      const receivedTools = [];
      let streamError = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) {
            currentEvent = 'message';
            continue;
          }
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
            continue;
          }
          if (line.startsWith('data:')) {
            const payloadStr = line.slice(5).trim();
            if (!payloadStr) continue;
            let payload;
            try {
              payload = JSON.parse(payloadStr);
            } catch (e) {
              continue;
            }

            if (currentEvent === 'token' && typeof payload.text === 'string') {
              accumulatedText += payload.text;
              if (typeof onToken === 'function') {
                onToken(accumulatedText, payload.text);
              }
            } else if (currentEvent === 'tool_call') {
              const validated = validateClientToolCall(payload.name, payload.args);
              if (validated.valid) {
                const enriched = {
                  ...validated,
                  requiresConfirm: Boolean(payload.requiresConfirm ?? validated.requiresConfirm),
                  requestId: payload.requestId || `${requestId}:${validated.name}`
                };
                receivedTools.push(enriched);
                if (typeof onToolCall === 'function') {
                  onToolCall(enriched);
                }
              }
            } else if (currentEvent === 'error') {
              streamError = {
                code: payload.code || 'PROVIDER_ERROR',
                message: toFriendlyError(payload.code)
              };
            }
          }
        }
      }

      if (streamError && !accumulatedText) {
        return {
          ok: false,
          code: streamError.code,
          friendlyError: streamError.message
        };
      }

      return {
        ok: true,
        text: accumulatedText,
        toolCalls: receivedTools,
        aborted: controller.signal.aborted && !timedOut
      };
    } catch (err) {
      if (timedOut) {
        return { ok: false, code: 'CLIENT_TIMEOUT', friendlyError: toFriendlyError('CLIENT_TIMEOUT') };
      }
      if (err?.name === 'AbortError') {
        return { ok: true, aborted: true, text: '', toolCalls: [] };
      }
      return { ok: false, code: 'NETWORK_ERROR', friendlyError: toFriendlyError('NETWORK_ERROR') };
    } finally {
      clearTimeout(timeoutId);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsStreaming(false);
    }
  }, []);

  const clearServerSession = useCallback(async (userId) => {
    try {
      const token = await resolveBearerToken(userId);
      if (!token) return;
      const endpoint = getChatEndpoint();
      const sessionEndpoint = endpoint.endsWith('/chat')
        ? `${endpoint}/session`
        : `${endpoint.replace(/\/+$/, '')}/session`;
      await fetch(sessionEndpoint, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    } catch (e) {}
  }, []);

  return {
    isStreaming,
    streamChat,
    stopGenerating,
    clearServerSession
  };
}
