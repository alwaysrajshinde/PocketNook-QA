const crypto = require('crypto');

const DEFAULT_REQ_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || 20);
const DEFAULT_REQ_PER_DAY = Number(process.env.RATE_LIMIT_PER_DAY || 300);
const DEFAULT_DAILY_USER_TOKENS = Number(process.env.DAILY_TOKEN_BUDGET_PER_USER || 100_000);
const DEFAULT_GLOBAL_DAILY_TOKENS = Number(process.env.GLOBAL_DAILY_TOKEN_ALERT || 2_000_000);

function hashUid(uid) {
  return crypto.createHash('sha256').update(String(uid || 'anon')).digest('hex').slice(0, 12);
}

/**
 * In-memory atomic store for local dev / automated testing when Firestore Admin is absent
 */
function createMemoryRateStore() {
  const buckets = new Map();
  return {
    async incrementAndCheck({ uid, minKey, dayKey, limits }) {
      const now = Date.now();
      const mKey = `${uid}::min::${minKey}`;
      const dKey = `${uid}::day::${dayKey}`;

      const mRec = buckets.get(mKey) || { count: 0, ts: now };
      const dRec = buckets.get(dKey) || { count: 0, tokens: 0, ts: now };

      if (mRec.count >= limits.reqPerMin) {
        return { allowed: false, reason: 'minute_rate_limit', retryAfterSec: 60 };
      }
      if (dRec.count >= limits.reqPerDay) {
        return { allowed: false, reason: 'daily_rate_limit', retryAfterSec: 3600 };
      }
      if (dRec.tokens >= limits.dailyUserTokens) {
        return { allowed: false, reason: 'daily_token_budget', retryAfterSec: 3600 };
      }

      mRec.count += 1;
      dRec.count += 1;
      buckets.set(mKey, mRec);
      buckets.set(dKey, dRec);
      return { allowed: true, minuteCount: mRec.count, dayCount: dRec.count, dayTokens: dRec.tokens };
    },
    async addTokens({ uid, dayKey, tokensUsed, limits }) {
      const dKey = `${uid}::day::${dayKey}`;
      const gKey = `GLOBAL::day::${dayKey}`;
      const dRec = buckets.get(dKey) || { count: 0, tokens: 0 };
      const gRec = buckets.get(gKey) || { tokens: 0, alerted80: false, alerted100: false };

      dRec.tokens += tokensUsed;
      gRec.tokens += tokensUsed;
      buckets.set(dKey, dRec);
      buckets.set(gKey, gRec);

      checkBillingAlert(gRec, limits.globalDailyTokens);
      return { userDayTokens: dRec.tokens, globalDayTokens: gRec.tokens };
    },
    reset() {
      buckets.clear();
    }
  };
}

function checkBillingAlert(globalRec, threshold) {
  if (!threshold || threshold <= 0) return;
  const pct = (globalRec.tokens / threshold) * 100;
  if (pct >= 100 && !globalRec.alerted100) {
    globalRec.alerted100 = true;
    console.warn(`[BILLING_SPIKE_ALERT] Global daily LLM token usage crossed 100% threshold (${globalRec.tokens}/${threshold})`);
  } else if (pct >= 80 && !globalRec.alerted80) {
    globalRec.alerted80 = true;
    console.warn(`[BILLING_SPIKE_ALERT] Global daily LLM token usage crossed 80% threshold (${globalRec.tokens}/${threshold})`);
  }
}

/**
 * Firestore-backed transactional rate limiter & token budget store (multi-instance safe)
 */
function createFirestoreRateStore(firestoreDb) {
  const { FieldValue } = require('firebase-admin/firestore');

  return {
    async incrementAndCheck({ uid, minKey, dayKey, limits }) {
      const minRef = firestoreDb.doc(`chat_ratelimits/${uid}/windows/min_${minKey}`);
      const dayRef = firestoreDb.doc(`chat_ratelimits/${uid}/windows/day_${dayKey}`);

      return firestoreDb.runTransaction(async (tx) => {
        const [minSnap, daySnap] = await Promise.all([tx.get(minRef), tx.get(dayRef)]);
        const minCount = minSnap.exists ? Number(minSnap.data().count || 0) : 0;
        const dayCount = daySnap.exists ? Number(daySnap.data().count || 0) : 0;
        const dayTokens = daySnap.exists ? Number(daySnap.data().tokens || 0) : 0;

        if (minCount >= limits.reqPerMin) {
          return { allowed: false, reason: 'minute_rate_limit', retryAfterSec: 60 };
        }
        if (dayCount >= limits.reqPerDay) {
          return { allowed: false, reason: 'daily_rate_limit', retryAfterSec: 3600 };
        }
        if (dayTokens >= limits.dailyUserTokens) {
          return { allowed: false, reason: 'daily_token_budget', retryAfterSec: 3600 };
        }

        const ttlMin = new Date(Date.now() + 2 * 60 * 1000);
        const ttlDay = new Date(Date.now() + 36 * 3600 * 1000);

        tx.set(minRef, { count: minCount + 1, expiresAt: ttlMin }, { merge: true });
        tx.set(dayRef, { count: dayCount + 1, tokens: dayTokens, expiresAt: ttlDay }, { merge: true });

        return { allowed: true, minuteCount: minCount + 1, dayCount: dayCount + 1, dayTokens };
      });
    },
    async addTokens({ uid, dayKey, tokensUsed, limits }) {
      const dayRef = firestoreDb.doc(`chat_ratelimits/${uid}/windows/day_${dayKey}`);
      const globalRef = firestoreDb.doc(`chat_billing_metrics/global_${dayKey}`);

      await Promise.all([
        dayRef.set({ tokens: FieldValue.increment(tokensUsed) }, { merge: true }),
        globalRef.set({ tokens: FieldValue.increment(tokensUsed), updatedAt: new Date().toISOString() }, { merge: true })
      ]);

      try {
        const gSnap = await globalRef.get();
        if (gSnap.exists) {
          const gData = gSnap.data();
          if (Number(gData.tokens || 0) >= limits.globalDailyTokens && !gData.alerted100) {
            console.warn(`[BILLING_SPIKE_ALERT] Global daily token spike: ${gData.tokens}/${limits.globalDailyTokens}`);
            await globalRef.set({ alerted100: true }, { merge: true });
          }
        }
      } catch (e) {}

      return { userDayTokens: tokensUsed };
    }
  };
}

function getWindowKeys(now = new Date()) {
  const iso = now.toISOString();
  const minKey = iso.slice(0, 16).replace(/[:T-]/g, ''); // YYYYMMDDHHMM
  const dayKey = iso.slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  return { minKey, dayKey };
}

function createRateLimiter({ store, limits = {} } = {}) {
  const resolvedLimits = {
    reqPerMin: limits.reqPerMin ?? DEFAULT_REQ_PER_MIN,
    reqPerDay: limits.reqPerDay ?? DEFAULT_REQ_PER_DAY,
    dailyUserTokens: limits.dailyUserTokens ?? DEFAULT_DAILY_USER_TOKENS,
    globalDailyTokens: limits.globalDailyTokens ?? DEFAULT_GLOBAL_DAILY_TOKENS
  };
  const activeStore = store || createMemoryRateStore();

  return {
    limits: resolvedLimits,
    store: activeStore,
    async check(uid, now = new Date()) {
      const { minKey, dayKey } = getWindowKeys(now);
      const res = await activeStore.incrementAndCheck({
        uid: String(uid),
        minKey,
        dayKey,
        limits: resolvedLimits
      });
      if (!res.allowed) {
        console.warn(`[RATE_LIMIT] uidHash=${hashUid(uid)} reason=${res.reason}`);
      }
      return res;
    },
    async recordTokens(uid, tokensUsed, now = new Date()) {
      const safeTokens = Math.max(0, Math.round(Number(tokensUsed || 0)));
      if (safeTokens === 0) return null;
      const { dayKey } = getWindowKeys(now);
      return activeStore.addTokens({
        uid: String(uid),
        dayKey,
        tokensUsed: safeTokens,
        limits: resolvedLimits
      });
    }
  };
}

module.exports = {
  createRateLimiter,
  createMemoryRateStore,
  createFirestoreRateStore,
  hashUid
};
