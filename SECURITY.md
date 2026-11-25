# PocketNook Chat — Security & Data-Flow Architecture

This document defines what data leaves the user's device, how sensitive information is protected, where state is stored, and how the streaming LLM backend is secured.

---

## 1. Data-Flow Overview

1. **Local Fast Path (`0ms`, Zero Network Calls):**
   - Deterministic inputs such as `chai 20`, `50 chai, 1,200 lunch`, `undo`, `split 2400 between 6`, `daily pace`, and bank SMS shorthand run strictly on-device in [smsParserService.js](file:///d:/Expense%20Tracker/client/src/services/smsParserService.js) and [aiAssistantService.js](file:///d:/Expense%20Tracker/client/src/services/aiAssistantService.js).
2. **Client-Side Masking ([piiSanitizerService.js](file:///d:/Expense%20Tracker/client/src/services/piiSanitizerService.js)):**
   - Before any message is stored in chat history or transmitted to `/api/chat`, `sanitizeFinancialText()` masks UPI/UTR reference numbers, card numbers, phone numbers, email addresses, PAN, and Aadhaar numbers, and masks bank account numbers down to low-risk last 4 digits (`A/c **4912`) only when useful for matching.
3. **Opt-In Financial Context ([chatContextService.js](file:///d:/Expense%20Tracker/client/src/services/chatContextService.js)):**
   - Controlled by **"Use AI with my data"** in Settings and Chat (default **OFF**).
   - **When OFF:** `/api/chat` receives only the masked user message and sanitized recent conversation summary—zero budget numbers, categories, or transaction history leave the device.
   - **When ON:** `/api/chat` receives a compact JSON snapshot capped under `~1,500` tokens (`4,800` chars): current month, currency (`INR`), budget, spent, remaining, days left, safe daily pace, today's spend, aggregated category totals, at most 10 recent transactions with generic scrubbed merchant labels (`merchantGeneric`), and upcoming recurring totals.

---

## 2. What Is NEVER Sent to the LLM

- Raw bank SMS messages, raw user notes, or UPI handles (`user@bank`)
- Full bank account numbers, 16-digit card numbers, CVVs, PINs, or UTR/RRN tracking numbers
- Personal phone numbers, email addresses, PAN, or Aadhaar numbers
- Full historical transaction ledger (only aggregated totals + last 10 scrubbed summaries when consent is ON)
- Firebase ID tokens, API keys, or secrets

---

## 3. Where Data Is Stored

| Data Category | Storage Location | Retention & Access Rules |
|---|---|---|
| **Chat History & Preferences** | Browser **IndexedDB** (`pocketnook_chat_db`) | Stores sanitized text only, partitioned by `userId`, capped at **200 messages**. Legacy `localStorage` chat storage is purged. One-tap **Clear chat** deletes IndexedDB history and calls `DELETE /api/chat/session`. |
| **Transactions & Budgets** | **Firestore** (`users/{uid}/...`) + Offline Queue | Enforced by [firestore.rules](file:///d:/Expense%20Tracker/firestore.rules): only `request.auth.uid == userId` can read/write. LLM tool calls **never** write to the database; only verified client **Confirm** actions write using idempotent `requestId`s. |
| **Rate Limits & Token Counters** | **Firestore** (`chat_ratelimits/{uid}/windows/...`) | Atomic Firestore transactions (`20 req/min`, `300 req/day`, per-user daily token budget). Client reads/writes explicitly denied (`if false`); written strictly by Admin SDK. |
| **LLM API Secrets** | **Google Cloud Secret Manager** | Loaded via `defineSecret('LLM_API_KEY')` in Firebase Cloud Functions v2 ([functions/index.js](file:///d:/Expense%20Tracker/functions/index.js)). Never bundled in `client/` or committed to git. |
| **Server Request Logs** | Cloud Logging (Metadata Only) | Logs SHA-256 `uidHash`, `provider`, `model`, `latencyMs`, `tokenCount`, and `errorCode`. Message contents and rupee amounts are never logged. |

---

## 4. Application & LLM Security Controls

- **Mandatory Auth + Optional App Check:** Every `/api/chat` call requires a valid Firebase ID token (`verifyIdToken(token, true)`). Firebase App Check supports `APP_CHECK_ENABLED` + `APP_CHECK_ENFORCE` for phased monitor-only -> enforced rollout.
- **Prompt Injection Defense:** System instructions live exclusively server-side ([functions/chatCore/systemPrompt.js](file:///d:/Expense%20Tracker/functions/chatCore/systemPrompt.js)). User messages are delimited inside `<user_message>...</user_message>` with nested tag escaping and never placed in the `system` role.
- **Strict Tool-Call Validation:** Every tool call returned by the LLM is validated with **Zod** on both server ([toolSchemas.js](file:///d:/Expense%20Tracker/functions/chatCore/toolSchemas.js)) and client ([chatToolSchemas.js](file:///d:/Expense%20Tracker/client/src/services/chatToolSchemas.js)), enforcing positive bounds (`< 10,000,000`), valid calendar dates, and allowed categories.
- **XSS & Link Stripping:** Streamed assistant text passes through **DOMPurify** with HTML tags and external links stripped before rendering.
- **Transport, Headers & CORS:** Enforces HTTPS in production, `helmet` security headers, `64kb` JSON limit, input length limits (`1,000` chars chat / `2,000` chars SMS paste), and exact CORS origins (`https://alwaysrajshinde.github.io`, `http://localhost:5173`, plus explicit env allowlist; zero wildcards).

---

## 5. Provider Data-Training Policy & Billing Budget Alerts

- **No-Training Configuration:** Production Gemini API usage must run under a **paid Google Cloud Billing / Gemini API project** where Google does not use API prompts or responses to train foundation models. If switching `LLM_PROVIDER` to `openai` or `anthropic`, ensure enterprise/API zero-data-retention / no-training API keys are used.
- **Billing & Spike Alerts:**
  1. Runtime token circuit-breaker (`DAILY_TOKEN_BUDGET_PER_USER` and `GLOBAL_DAILY_TOKEN_ALERT`) logs `[BILLING_SPIKE_ALERT]` at 80% and 100% thresholds and caps per-user usage with HTTP `429`.
  2. Configure a GCP Billing Budget Alert on the Firebase project (`Billing -> Budgets & alerts -> Set monthly threshold e.g. ₹500 / ₹1,000 -> Email/PubSub alerts at 50%, 80%, 100%`).
