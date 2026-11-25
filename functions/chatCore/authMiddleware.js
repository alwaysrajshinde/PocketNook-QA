const BASE_ALLOWED_ORIGINS = [
  'https://alwaysrajshinde.github.io',
  'http://localhost:5173'
];

function getAllowedOrigins() {
  const extra = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Include local dev Express port in non-production environments if running unified build
  if (process.env.NODE_ENV !== 'production') {
    extra.push('http://localhost:3001');
  }

  return Array.from(new Set([...BASE_ALLOWED_ORIGINS, ...extra])).filter((o) => o !== '*');
}

function isOriginAllowed(origin, allowed = getAllowedOrigins()) {
  if (!origin) return true; // Same-origin / server-to-server / curl without Origin
  return allowed.includes(origin);
}

/**
 * Mandatory Firebase ID Token authentication + optional Firebase App Check (monitor-only or enforced).
 */
function createAuthMiddleware({ adminAuth = null, adminAppCheck = null, allowTestAuth = false } = {}) {
  return async function authenticateChatRequest(req, res, next) {
    try {
      // Enforce HTTPS in production behind Cloud Functions / reverse proxy
      if (process.env.NODE_ENV === 'production') {
        const proto = req.headers['x-forwarded-proto'] || req.protocol;
        if (proto && String(proto).toLowerCase() !== 'https') {
          return res.status(403).json({ success: false, code: 'HTTPS_REQUIRED', error: 'HTTPS is required' });
        }
      }

      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, code: 'AUTH_MISSING_TOKEN', error: 'Authentication required' });
      }

      const idToken = authHeader.slice(7).trim();
      if (!idToken) {
        return res.status(401).json({ success: false, code: 'AUTH_EMPTY_TOKEN', error: 'Authentication required' });
      }

      // 1. Test-only deterministic auth bypass (strictly disabled unless explicitly enabled for CI/dev test harness)
      if (allowTestAuth && process.env.NODE_ENV !== 'production') {
        if (idToken === 'EXPIRED_TEST_TOKEN') {
          return res.status(401).json({ success: false, code: 'AUTH_TOKEN_EXPIRED', error: 'Session expired. Please sign in again.' });
        }
        if (idToken.startsWith('TEST_UID:')) {
          const uid = idToken.slice(9).trim();
          if (!uid) {
            return res.status(401).json({ success: false, code: 'AUTH_INVALID_TOKEN', error: 'Invalid token' });
          }
          req.authUid = uid;
        }
      }

      // 2. Mandatory Firebase ID token verification when not verified by test harness
      if (!req.authUid) {
        if (!adminAuth || typeof adminAuth.verifyIdToken !== 'function') {
          return res.status(503).json({ success: false, code: 'AUTH_SERVICE_UNAVAILABLE', error: 'Auth verifier unavailable' });
        }
        const decoded = await adminAuth.verifyIdToken(idToken, true);
        if (!decoded || !decoded.uid) {
          return res.status(401).json({ success: false, code: 'AUTH_INVALID_TOKEN', error: 'Invalid authentication token' });
        }
        req.authUid = decoded.uid;
      }

      // 3. Optional Firebase App Check (APP_CHECK_ENABLED=false by default; monitor-only unless APP_CHECK_ENFORCE=true)
      const appCheckEnabled = String(process.env.APP_CHECK_ENABLED || 'false').toLowerCase() === 'true';
      if (appCheckEnabled) {
        const enforce = String(process.env.APP_CHECK_ENFORCE || 'false').toLowerCase() === 'true';
        const appCheckToken = req.headers['x-firebase-appcheck'];

        if (!appCheckToken) {
          console.warn('[APP_CHECK] Missing X-Firebase-AppCheck header (monitor=%s)', !enforce);
          if (enforce) {
            return res.status(401).json({ success: false, code: 'APP_CHECK_REQUIRED', error: 'App verification failed' });
          }
        } else if (adminAppCheck && typeof adminAppCheck.verifyToken === 'function') {
          try {
            await adminAppCheck.verifyToken(String(appCheckToken));
          } catch (acErr) {
            console.warn('[APP_CHECK] Verification failed (monitor=%s): %s', !enforce, acErr.message);
            if (enforce) {
              return res.status(401).json({ success: false, code: 'APP_CHECK_INVALID', error: 'App verification failed' });
            }
          }
        }
      }

      next();
    } catch (err) {
      const isExpired = err?.code === 'auth/id-token-expired' || /expired/i.test(err?.message || '');
      return res.status(401).json({
        success: false,
        code: isExpired ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_INVALID_TOKEN',
        error: isExpired ? 'Session expired. Please sign in again.' : 'Unauthorized request'
      });
    }
  };
}

module.exports = {
  getAllowedOrigins,
  isOriginAllowed,
  createAuthMiddleware
};
