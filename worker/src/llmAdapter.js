import { validateToolCall } from './toolSchemas.js';

export const DEFAULT_MAX_OUTPUT_TOKENS = 450;

export function resolveMaxOutputTokens(envValue) {
  const parsed = Number(envValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_OUTPUT_TOKENS;
  return Math.min(Math.max(Math.floor(parsed), 64), 1024);
}

/**
 * Gemini Adapter (AI Studio free tier or configurable Gemini model).
 * Single-shot SSE streaming: never retries in a loop on 429/5xx.
 */
export class GeminiAdapter {
  constructor({ model, apiKey, maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS, fetchImpl = fetch }) {
    if (!model) throw new Error('LLM_MODEL env variable must be configured for GeminiAdapter');
    if (!apiKey) throw new Error('LLM_API_KEY secret is not configured');
    this.provider = 'gemini';
    this.model = model;
    this.apiKey = apiKey;
    this.maxOutputTokens = resolveMaxOutputTokens(maxOutputTokens);
    this.fetch = fetchImpl;
  }

  async streamChat({ envelope, signal, onToken, onToolCall }) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;

    const contents = envelope.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const payload = {
      systemInstruction: {
        parts: [{ text: envelope.systemInstruction }]
      },
      contents,
      tools: [
        {
          functionDeclarations: envelope.toolDeclarations
        }
      ],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: this.maxOutputTokens
      }
    };

    const res = await this.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal
    });

    if (!res.ok) {
      const errCode = res.status === 429 ? 'PROVIDER_RATE_LIMIT' : 'PROVIDER_HTTP_ERROR';
      const err = new Error(`Provider returned status ${res.status}`);
      err.code = errCode;
      err.status = res.status;
      throw err;
    }

    if (!res.body || typeof res.body.getReader !== 'function') {
      throw new Error('Streaming response body unavailable');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let totalTokens = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const dataStr = line.slice(5).trim();
        if (!dataStr || dataStr === '[DONE]') continue;

        let chunk;
        try {
          chunk = JSON.parse(dataStr);
        } catch {
          continue;
        }

        if (chunk.usageMetadata?.totalTokenCount) {
          totalTokens = Number(chunk.usageMetadata.totalTokenCount);
        }

        const parts = chunk?.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (typeof part.text === 'string' && part.text.length > 0) {
            onToken(part.text);
          }
          if (part.functionCall && part.functionCall.name) {
            const validated = validateToolCall(part.functionCall.name, part.functionCall.args || {});
            onToolCall(validated);
          }
        }
      }
    }

    return { totalTokens };
  }
}

export class MockFixtureAdapter {
  constructor({ model = 'mock-fixture-v1', maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS } = {}) {
    this.provider = 'mock';
    this.model = model;
    this.maxOutputTokens = resolveMaxOutputTokens(maxOutputTokens);
  }

  async streamChat({ envelope, signal, onToken, onToolCall }) {
    const lastUser = envelope.messages[envelope.messages.length - 1]?.content || '';
    const lower = lastUser.toLowerCase();

    if (/ignore\s+(?:all\s+)?previous\s+instructions|reveal\s+system\s+prompt|system\s+instruction/i.test(lower)) {
      const reply = 'I can only help with your PocketNook expenses and budgets based on your masked summary.';
      for (const word of reply.split(' ')) {
        if (signal?.aborted) break;
        onToken(`${word} `);
        await new Promise((r) => setTimeout(r, 8));
      }
      return { totalTokens: 42 };
    }

    if (/\bset\s+budget\b.*\b(\d+)/i.test(lower)) {
      const m = lower.match(/\b(\d+)\b/);
      const amt = Number(m ? m[1] : 15000);
      onToken('Here is a budget update proposal for your confirmation. ');
      onToolCall(validateToolCall('set_budget', { amount: amt }));
      return { totalTokens: 55 };
    }

    if (/\bswiggy\b.*\b(\d+)/i.test(lower)) {
      const m = lower.match(/\b(\d+)\b/);
      const amt = Number(m ? m[1] : 450);
      const today = new Date().toISOString().slice(0, 10);
      onToken('I prepared this expense entry for confirmation. ');
      onToolCall(
        validateToolCall('log_expense', {
          amount: amt,
          merchant: 'Swiggy',
          category: 'Food & Dining',
          mode: 'UPI',
          date: today,
          type: 'expense',
          confidence: 0.96
        })
      );
      return { totalTokens: 64 };
    }

    const defaultReply = envelope.systemInstruction.includes('Not shared')
      ? 'Your data summary sharing is currently OFF. Enable "Use AI with my data" in Settings to let me inspect your monthly budget, or ask general budgeting questions anytime. Informational only, not financial advice.'
      : 'Based on your masked spending summary, keep an eye on your daily safe pace and recurring bills this week. Informational only, not financial advice.';

    for (const chunk of defaultReply.match(/.{1,12}/g) || [defaultReply]) {
      if (signal?.aborted) break;
      onToken(chunk);
      await new Promise((r) => setTimeout(r, 12));
    }
    return { totalTokens: 60 };
  }
}

export class OpenAIAdapter {
  constructor({ model, apiKey, maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS }) {
    if (!model) throw new Error('LLM_MODEL env variable must be configured for OpenAIAdapter');
    if (!apiKey) throw new Error('LLM_API_KEY secret is not configured');
    this.provider = 'openai';
    this.model = model;
    this.apiKey = apiKey;
    this.maxOutputTokens = resolveMaxOutputTokens(maxOutputTokens);
  }

  async streamChat() {
    const err = new Error('OpenAI adapter selected via LLM_PROVIDER=openai; configure endpoint adapter implementation.');
    err.code = 'ADAPTER_NOT_ENABLED';
    throw err;
  }
}

export class AnthropicAdapter {
  constructor({ model, apiKey, maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS }) {
    if (!model) throw new Error('LLM_MODEL env variable must be configured for AnthropicAdapter');
    if (!apiKey) throw new Error('LLM_API_KEY secret is not configured');
    this.provider = 'anthropic';
    this.model = model;
    this.apiKey = apiKey;
    this.maxOutputTokens = resolveMaxOutputTokens(maxOutputTokens);
  }

  async streamChat() {
    const err = new Error('Anthropic adapter selected via LLM_PROVIDER=anthropic; configure endpoint adapter implementation.');
    err.code = 'ADAPTER_NOT_ENABLED';
    throw err;
  }
}

export function createLLMAdapter({
  provider,
  model,
  apiKey,
  maxOutputTokens,
  fetchImpl = fetch
} = {}) {
  const normalizedProvider = String(provider || '').trim().toLowerCase();

  if (normalizedProvider === 'mock') {
    return new MockFixtureAdapter({ model: model || 'mock-fixture-v1', maxOutputTokens });
  }
  if (normalizedProvider === 'gemini') {
    return new GeminiAdapter({ model, apiKey, maxOutputTokens, fetchImpl });
  }
  if (normalizedProvider === 'openai') {
    return new OpenAIAdapter({ model, apiKey, maxOutputTokens });
  }
  if (normalizedProvider === 'anthropic') {
    return new AnthropicAdapter({ model, apiKey, maxOutputTokens });
  }

  throw new Error(`Unsupported or missing LLM_PROVIDER ("${normalizedProvider || 'unset'}")`);
}
