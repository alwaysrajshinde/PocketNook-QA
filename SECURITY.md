# PocketNook Chat — Security & ₹0 Data-Flow Architecture

This document defines what data leaves the user's device, how sensitive tokens are masked on client and server, where data is stored on the free-tier stack, and how `/api/chat` is secured.

---

## 1. ₹0 Infrastructure & Data-Flow Overview

- **Zero-Billing Stack:** Firebase Auth & Cloud Firestore run on the **Spark (Free)** plan. There are **no** Firebase Cloud Functions (no Blaze plan required). The `/api/chat` proxy runs on a **Cloudflare Worker (Free Tier)** backed by a **SQLite Durable Object** and **Google AI Studio Free Tier** (no billing attached).
- **Kill Switch (`AI_ENABLED`):** Setting `AI_ENABLED=false` in [worker/wrangler.toml](file:///d:/Expense%20Tracker/worker/wrangler.toml) immediately disables upstream LLM calls (`503 AI_DISABLED`) and routes clients smoothly to the on-device local assistant.

1. **Local Fast Path (`0ms`, Zero Network & Zero Quota):**
   - Deterministic inputs such as `chai 20`, `50 chai, 1,200 lunch`, `undo`, `split 2400 between 6`, `daily pace`, Hinglish expenses, and bank SMS shorthand execute locally in [smsParserService.js](file:///d:/Expense%20Tracker/client/src/services/smsParserService.js) and [aiAssistantService.js](file:///d:/Expense%20Tracker/client/src/services/aiAssistantService.js) without calling `/api/chat`.
2. **Client-Side Masking ([piiSanitizerService.js](file:///d:/Expense%20Tracker/client/src/services/piiSanitizerService.js)) & Worker Re-Sanitization ([worker/src/sanitizer.js](file:///d:/Expense%20Tracker/worker/src/sanitizer.js)):**
   - Before text is persisted or sent, client masking replaces UPI/UTR reference numbers, card numbers, phone numbers, emails, PAN, and Aadhaar numbers, preserving bank account last-4 digits (`A/c **4912`) only where helpful.
   - As defense-in-depth against direct or tampered API calls, the Worker re-sanitizes `message`, `history`, `olderSummary`, `context.recentTransactions[*].merchantGeneric`, and `context.upcomingFixed[*].name` before constructing the LLM prompt.
3. **Opt-In Financial Context ([chatContextService.js](file:///d:/Expense%20Tracker/client/src/services/chatContextService.js)):**
   - Controlled by **"Use AI with my data"** in Settings and Chat (default **OFF**).
   - **When OFF:** `/api/chat` receives only the masked message and sanitized recent conversation turns—no budgets, totals, categories, or transactions leave the device.
   - **When ON:** `/api/chat` receives a `.strict()`-validated compact JSON snapshot (`<= 4,800` chars): month, currency (`INR`), budget, spent, remaining, days left, safe daily pace, today's spend, aggregated category totals, up to 10 recent transactions with generic scrubbed merchant labels (`merchantGeneric`), and upcoming fixed bills.

---

## 2. What Is NEVER Sent to the LLM

- Raw bank SMS alerts, raw merchant notes, or UPI handles (`user@bank`)
- Full bank account numbers, 16-digit card numbers, CVVs, PINs, or UTR/RRN tracking numbers
- Personal phone numbers, email addresses, PAN, or Aadhaar numbers
- Full historical transaction ledger (only aggregated totals + last 10 scrubbed entries when consent is ON)
- Firebase ID tokens, API keys, or secrets

---

## 3. Where Data Is Stored & What `Clear chat` Deletes

| Data Category | Storage Location | Retention & Deletion |
|---|---|---|
| **Chat History & Preferences** | Browser **IndexedDB** (`pocketnook_chat_db`) | Stores sanitized text only, partitioned by `userId`, capped at **200 messages**. **Clear chat** wipes IndexedDB messages immediately. |
| **Worker Chat State** | **Stateless** (`DELETE /api/chat/session`) | The Worker does not persist conversation transcripts or user chat history (`deletedPaths: []`). Calling `DELETE /api/chat/session` confirms no transcript data is held server-side while leaving rate-limit counters intact. |
| **Transactions & Budgets** | **Firestore Spark** (`users/{uid}/...`) + Offline Queue | Protected by [firestore.rules](file:///d:/Expense%20Tracker/firestore.rules): only `request.auth.uid == userId` can read/write. LLM tool proposals **never** auto-log expenses or auto-edit budgets; every AI-suggested ledger mutation requires an explicit user **Confirm** tap. |
| **Rate Limits & Global Cap** | **Cloudflare Durable Object (SQLite)** (`ChatRateLimiterDO`) | Atomic SQLite counters enforcing `5 req/min`, `10 AI msgs/day` per user, and `GLOBAL_DAILY_CAP` (configured below Gemini free-tier RPD). Retained across `Clear chat` so quotas cannot be bypassed. |
| **Secrets** | **Cloudflare Worker Secrets** | `LLM_API_KEY` and `LOG_HMAC_SECRET` uploaded via `wrangler secret put`. Never committed to git or bundled in `client/`. |
| **Worker Logs** | Cloudflare Worker Logs (Metadata Only) | Logs salted Web Crypto HMAC-SHA256 `uidHash` (`LOG_HMAC_SECRET`), `provider`, `model`, `latencyMs`, `tokenCount`, and `errorCode`. Message content, merchant names, and rupee amounts are never logged. |

---

## 4. Application & LLM Security Controls

- **Mandatory Firebase ID Token Verification (`jose` + Cached Google JWKS):** [worker/src/auth.js](file:///d:/Expense%20Tracker/worker/src/auth.js) verifies `RS256` signature, `iss = https://securetoken.google.com/<PROJECT_ID>`, `aud = <PROJECT_ID>`, non-empty `sub`, valid `exp`, and `auth_time`. **Zero test/mock auth bypass exists in `worker/`.** Test bypass (`TEST_UID:`) lives exclusively in the local Playwright test adapter ([server/devChatRouter.js](file:///d:/Expense%20Tracker/server/devChatRouter.js)) gated by `NODE_ENV=test && ALLOW_TEST_AUTH=true`.
- **Prompt Injection Defense & Capped Output:** System instructions live server-side ([worker/src/systemPrompt.js](file:///d:/Expense%20Tracker/worker/src/systemPrompt.js)). User inputs are wrapped in `<user_message>...</user_message>` with nested tag escaping. Model output is bounded via `LLM_MAX_OUTPUT_TOKENS` (`450` default).
- **Mandatory User Confirmation for AI Mutations:** [toolSchemas.js](file:///d:/Expense%20Tracker/worker/src/toolSchemas.js) and [chatToolSchemas.js](file:///d:/Expense%20Tracker/client/src/services/chatToolSchemas.js) enforce `requiresConfirm: true` on all mutating tools (`log_expense`, `log_multiple_expenses`, `undo_last`, `set_budget`), regardless of amount or model confidence score.
- **No Retry Loops on Quota Exhaustion:** Single-shot upstream fetch; `429` (`GLOBAL_QUOTA_EXHAUSTED`, `USER_DAILY_QUOTA_EXHAUSTED`, `PROVIDER_RATE_LIMIT`) and `5xx` immediately fall back to the local deterministic assistant with no retry loops.
- **Strict Zod + XSS Neutralization + CORS:** `.strict()` schemas on requests/snapshots/tools, DOMPurify HTML/link stripping on streamed text, HTTPS enforcement in production, and strict CORS allowlist (`https://alwaysrajshinde.github.io`, `http://localhost:5173`, zero wildcards).

---

## 5. Google Gemini AI Studio Free-Tier Privacy Notice

- PocketNook runs on the **Google AI Studio Gemini API Free Tier** (no billing account linked) so operating cost stays ₹0.
- Under Google's Gemini API Additional Terms for the **free tier**, submitted prompts and responses **may be reviewed and used by Google to improve its products**.
- **For this reason:**
  1. **"Use AI with my data"** summary sharing defaults to **OFF**.
  2. All bank account numbers, cards, UTRs, phone numbers, emails, PAN, and Aadhaar numbers are masked before leaving your device and re-sanitized on the Worker.
  3. Avoid typing unnecessary personal details into AI chat prompts.
