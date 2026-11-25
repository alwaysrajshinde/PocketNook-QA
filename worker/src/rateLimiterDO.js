/**
 * SQLite-backed Durable Object rate limiter for Cloudflare Workers Free Plan.
 * Atomically enforces per-minute, per-user daily, and global daily AI call caps.
 */

export function getDayKey(nowMs = Date.now()) {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function getMinuteKey(nowMs = Date.now()) {
  return new Date(nowMs).toISOString().slice(0, 16);
}

export class RateLimiterSqlStore {
  constructor(sql) {
    this.sql = sql;
    this.initialized = false;
  }

  ensureSchema() {
    if (this.initialized) return;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS global_daily (
        day_key TEXT PRIMARY KEY,
        count INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS user_daily (
        day_key TEXT NOT NULL,
        uid_hash TEXT NOT NULL,
        count INTEGER NOT NULL,
        PRIMARY KEY (day_key, uid_hash)
      );
      CREATE TABLE IF NOT EXISTS user_minute (
        min_key TEXT NOT NULL,
        uid_hash TEXT NOT NULL,
        count INTEGER NOT NULL,
        PRIMARY KEY (min_key, uid_hash)
      );
    `);
    this.initialized = true;
  }

  readScalarCount(query, ...params) {
    const cursor = this.sql.exec(query, ...params);
    const rows = typeof cursor?.toArray === 'function' ? cursor.toArray() : Array.from(cursor || []);
    return rows.length > 0 ? Number(rows[0].count || 0) : 0;
  }

  /**
   * Checks global daily, user minute, and user daily limits atomically before incrementing.
   */
  consume({
    uidHash,
    userPerMinLimit = 5,
    userDailyLimit = 10,
    globalDailyCap = 150,
    nowMs = Date.now()
  }) {
    this.ensureSchema();
    const dayKey = getDayKey(nowMs);
    const minKey = getMinuteKey(nowMs);

    // Prune older day/minute buckets so SQLite stays tiny across days
    this.sql.exec('DELETE FROM global_daily WHERE day_key < ?', dayKey);
    this.sql.exec('DELETE FROM user_daily WHERE day_key < ?', dayKey);
    this.sql.exec('DELETE FROM user_minute WHERE min_key < ?', minKey);

    const globalCount = this.readScalarCount('SELECT count FROM global_daily WHERE day_key = ?', dayKey);
    const userDayCount = this.readScalarCount(
      'SELECT count FROM user_daily WHERE day_key = ? AND uid_hash = ?',
      dayKey,
      uidHash
    );
    const userMinCount = this.readScalarCount(
      'SELECT count FROM user_minute WHERE min_key = ? AND uid_hash = ?',
      minKey,
      uidHash
    );

    if (globalCount >= globalDailyCap) {
      return {
        allowed: false,
        code: 'GLOBAL_QUOTA_EXHAUSTED',
        reason: 'global_daily_cap',
        globalCount,
        userDayCount,
        userMinCount
      };
    }

    if (userMinCount >= userPerMinLimit) {
      return {
        allowed: false,
        code: 'RATE_LIMIT_EXCEEDED',
        reason: 'user_per_minute',
        globalCount,
        userDayCount,
        userMinCount
      };
    }

    if (userDayCount >= userDailyLimit) {
      return {
        allowed: false,
        code: 'USER_DAILY_QUOTA_EXHAUSTED',
        reason: 'user_daily_cap',
        globalCount,
        userDayCount,
        userMinCount
      };
    }

    this.sql.exec(
      'INSERT INTO global_daily (day_key, count) VALUES (?, 1) ON CONFLICT(day_key) DO UPDATE SET count = count + 1',
      dayKey
    );
    this.sql.exec(
      'INSERT INTO user_daily (day_key, uid_hash, count) VALUES (?, ?, 1) ON CONFLICT(day_key, uid_hash) DO UPDATE SET count = count + 1',
      dayKey,
      uidHash
    );
    this.sql.exec(
      'INSERT INTO user_minute (min_key, uid_hash, count) VALUES (?, ?, 1) ON CONFLICT(min_key, uid_hash) DO UPDATE SET count = count + 1',
      minKey,
      uidHash
    );

    return {
      allowed: true,
      globalCount: globalCount + 1,
      userDayCount: userDayCount + 1,
      userMinCount: userMinCount + 1
    };
  }
}

export function createRateLimiterDoHandler(sql) {
  const store = new RateLimiterSqlStore(sql);

  return async function handleDoFetch(request) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/consume') {
      const body = await request.json();
      const result = store.consume({
        uidHash: String(body.uidHash || 'anon'),
        userPerMinLimit: Number(body.userPerMinLimit || 5),
        userDailyLimit: Number(body.userDailyLimit || 10),
        globalDailyCap: Number(body.globalDailyCap || 150),
        nowMs: body.nowMs ? Number(body.nowMs) : Date.now()
      });
      return Response.json(result, { status: result.allowed ? 200 : 429 });
    }
    return Response.json({ error: 'Not found' }, { status: 404 });
  };
}
