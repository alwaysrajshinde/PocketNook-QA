import { createRemoteJWKSet, jwtVerify } from 'jose';

const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const BASE_ALLOWED_ORIGINS = [
  'https://alwaysrajshinde.github.io',
  'http://localhost:5173'
];

// Isolate-level cached JWKS keyset functions keyed by JWKS URL.
const jwksCache = new Map();

export function getCachedFirebaseJwks(jwksUrl = FIREBASE_JWKS_URL) {
  let jwks = jwksCache.get(jwksUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUrl), {
      cacheMaxAge: 6 * 60 * 60 * 1000, // 6h cache
      cooldownDuration: 30 * 1000
    });
    jwksCache.set(jwksUrl, jwks);
  }
  return jwks;
}

export function getAllowedOrigins(env = {}) {
  const extra = String(env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (env.ENVIRONMENT !== 'production') {
    extra.push('http://localhost:3001');
  }

  return Array.from(new Set([...BASE_ALLOWED_ORIGINS, ...extra])).filter((o) => o !== '*');
}

export function isOriginAllowed(origin, env = {}) {
  if (!origin) return true;
  return getAllowedOrigins(env).includes(origin);
}

/**
 * Verifies a Firebase ID Token in Cloudflare Workers using jose + Google public JWKS.
 * Enforces: RS256, iss, aud, exp, non-empty sub, and valid auth_time.
 * Zero test/mock bypass is permitted in Worker production code.
 */
export async function verifyFirebaseIdToken(idToken, { projectId, jwksFn = null } = {}) {
  if (!projectId || typeof projectId !== 'string') {
    const err = new Error('FIREBASE_PROJECT_ID is not configured');
    err.code = 'AUTH_CONFIG_ERROR';
    throw err;
  }

  const keySet = typeof jwksFn === 'function' ? jwksFn : getCachedFirebaseJwks();
  const issuer = `https://securetoken.google.com/${projectId}`;

  const { payload } = await jwtVerify(idToken, keySet, {
    issuer,
    audience: projectId,
    algorithms: ['RS256']
  });

  if (typeof payload?.sub !== 'string' || payload.sub.trim().length === 0 || payload.sub.length > 128) {
    const err = new Error('Firebase token missing valid sub claim');
    err.code = 'AUTH_INVALID_TOKEN';
    throw err;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.auth_time === 'number' && payload.auth_time > nowSec + 60) {
    const err = new Error('Firebase token auth_time is in the future');
    err.code = 'AUTH_INVALID_TOKEN';
    throw err;
  }

  return { uid: payload.sub.trim(), payload };
}

let devFallbackKeyHex = null;

async function getDevFallbackHmacSecret() {
  if (!devFallbackKeyHex) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    devFallbackKeyHex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return devFallbackKeyHex;
}

/**
 * Computes a salted HMAC-SHA256 digest of a user UID for privacy-safe metadata logging.
 */
export async function hmacHashUid(uid, env = {}) {
  const configured = env.LOG_HMAC_SECRET;
  const isProd = env.ENVIRONMENT === 'production';

  if (isProd && (!configured || typeof configured !== 'string' || configured.length < 16)) {
    throw new Error('LOG_HMAC_SECRET secret (>=16 chars) must be configured in production');
  }

  const secretMaterial = configured || (await getDevFallbackHmacSecret());
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretMaterial),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(String(uid || 'anonymous')));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}
