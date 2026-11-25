import { DurableObject } from 'cloudflare:workers';
import { createRateLimiterDoHandler } from './rateLimiterDO.js';
import { createWorkerHandler } from './app.js';

export class ChatRateLimiterDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.doHandler = createRateLimiterDoHandler(this.ctx.storage.sql);
  }

  async fetch(request) {
    return this.doHandler(request);
  }
}

const workerFetch = createWorkerHandler();

export default {
  async fetch(request, env, ctx) {
    return workerFetch(request, env, ctx);
  }
};
