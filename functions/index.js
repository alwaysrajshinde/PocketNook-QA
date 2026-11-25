const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

const { isOriginAllowed, createAuthMiddleware } = require('./chatCore/authMiddleware');
const { createRateLimiter, createFirestoreRateStore } = require('./chatCore/rateLimiter');
const { createLLMAdapter } = require('./chatCore/llmAdapter');
const { createChatHandler } = require('./chatCore/chatHandler');

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestoreDb = admin.firestore();
const adminAuth = admin.auth();
let adminAppCheck = null;
try {
  const { getAppCheck } = require('firebase-admin/app-check');
  adminAppCheck = getAppCheck();
} catch (e) {}

// Secret stored strictly in Google Cloud Secret Manager
const LLM_API_KEY = defineSecret('LLM_API_KEY');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '64kb' }));

// Strict CORS — only https://alwaysrajshinde.github.io, http://localhost:5173, and explicit env allowlist
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Firebase-AppCheck']
}));

// Mandatory Firebase ID token check + optional App Check (disabled/monitor-only until configured)
const authenticate = createAuthMiddleware({
  adminAuth,
  adminAppCheck,
  allowTestAuth: false // Strictly disabled in Firebase Functions production
});

// Multi-instance atomic Firestore rate limiter & daily token budget
const rateLimiter = createRateLimiter({
  store: createFirestoreRateStore(firestoreDb)
});

const { handlePostChat, handleDeleteSession } = createChatHandler({
  rateLimiter,
  firestoreDb,
  getAdapter: () => createLLMAdapter({
    provider: process.env.LLM_PROVIDER,
    model: process.env.LLM_MODEL,
    apiKey: LLM_API_KEY.value()
  })
});

app.post(['/', '/api/chat'], authenticate, handlePostChat);
app.delete(['/session', '/api/chat/session'], authenticate, handleDeleteSession);

// Reject CORS errors cleanly without leaking stack traces
app.use((err, _req, res, _next) => {
  if (err && /CORS/i.test(err.message || '')) {
    return res.status(403).json({ success: false, code: 'CORS_FORBIDDEN', error: 'Origin not allowed' });
  }
  return res.status(500).json({ success: false, code: 'INTERNAL_ERROR', error: 'Internal server error' });
});

exports.chat = onRequest({
  secrets: [LLM_API_KEY],
  memory: '256MiB',
  timeoutSeconds: 60,
  maxInstances: 20,
  cors: false
}, app);
