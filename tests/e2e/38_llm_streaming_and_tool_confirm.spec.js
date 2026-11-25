// @ts-check
const { test, expect } = require('../fixtures/auth.fixture');
const { cleanTestUsers } = require('../helpers/dbHelper');

test.describe('Area 38: Streaming LLM SSE, Stop Button, Tool Confirm Cards, Consent & Quota Fallback', () => {
  test.afterAll(() => {
    cleanTestUsers();
  });

  async function dismissOverlays(page) {
    const greeting = page.locator('[data-testid="welcome-greeting-overlay"], button:has-text("Let\'s Dive In"), button:has-text("Got It")').first();
    if (await greeting.isVisible({ timeout: 1800 }).catch(() => false)) {
      await greeting.click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }
    const tourClose = page.locator('[data-testid="onboarding-tour-close-btn"], button[aria-label="Close Tour"]').first();
    if (await tourClose.isVisible({ timeout: 1800 }).catch(() => false)) {
      await tourClose.click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }

  async function openChat(page) {
    await dismissOverlays(page);
    const fab = page.locator('[data-testid="floating-whatsapp-btn"]').first();
    await expect(fab).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(350);
    await fab.click({ force: true });
    const modal = page.locator('[data-testid="whatsapp-chatbox-modal"]');
    if (!await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dismissOverlays(page);
      await fab.click({ force: true });
    }
    await expect(modal).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(320);
    return modal;
  }

  test('38.1: Privacy consent toggle defaults OFF, shows honest free-tier notice, and toggles cleanly', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRajMailTemp();
    const modal = await openChat(page);

    await expect(modal.locator('text=free-tier AI prompts may be used by Google').first()).toBeVisible();
    const consentPill = modal.locator('[data-testid="chat-ai-consent-pill"]');
    await expect(consentPill).toBeVisible();
    await expect(consentPill).toContainText('Summary Sharing: OFF');

    await consentPill.click();
    await expect(consentPill).toContainText('Summary Sharing: ON');

    await consentPill.click();
    await expect(consentPill).toContainText('Summary Sharing: OFF');

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('38.2: Progressive SSE streaming render, XSS DOMPurify neutralization, and Stop generating button', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRajMailTemp();

    await page.route('**/api/chat', async (route) => {
      const sseBody = [
        'event: token\ndata: {"text":"Here is your spending tip: <img src=x onerror=\\"window.__llm_xss=1\\"> check your "}\n\n',
        'event: token\ndata: {"text":"monthly budget cap safely."}\n\n',
        'event: done\ndata: {"usage":{"totalTokens":25}}\n\n'
      ].join('');

      await new Promise((r) => setTimeout(r, 900));
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
        body: sseBody
      });
    });

    const modal = await openChat(page);
    const input = modal.locator('[data-testid="whatsapp-chat-input"]');
    await input.fill('Give me an analytical reflection on habits');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    const stopBtn = modal.locator('[data-testid="stop-generating-btn"]');
    await expect(stopBtn).toBeVisible({ timeout: 4000 });

    await expect(modal.locator('text=Here is your spending tip:').first()).toBeVisible({ timeout: 10000 });
    const xssEval = await page.evaluate(() => window['__llm_xss']);
    expect(xssEval).toBeUndefined();

    await input.fill('Analyze my long term habits in detail please');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();
    await expect(stopBtn).toBeVisible({ timeout: 4000 });
    await stopBtn.click();
    await expect(modal.locator('[data-testid="whatsapp-chat-send-btn"]')).toBeVisible({ timeout: 4000 });

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('38.3: AI-proposed expenses ALWAYS require Confirm tap (even < ₹500) + Edit/Cancel idempotency', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRajMailTemp();
    const modal = await openChat(page);
    const input = modal.locator('[data-testid="whatsapp-chat-input"]');

    // 1. Live mock backend route: "please set budget 28000" -> set_budget always requires Confirm
    await input.fill('please set budget 28000');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    const confirmCard = modal.locator('[data-testid="tool-confirm-card"]').first();
    await expect(confirmCard).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Update your monthly budget to ₹28,000?').first()).toBeVisible();

    await confirmCard.locator('[data-testid="tool-cancel-btn"]').click();
    await expect(modal.locator('text=Cancelled — no changes written').first()).toBeVisible();

    // 2. Low-value AI-proposed expense (< ₹500, high confidence 0.96) STILL requires explicit Confirm card (no auto-log)
    await input.fill('I ordered coffee on Swiggy 120');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    const lowConfirmCard = modal.locator('[data-testid="tool-confirm-card"]').last();
    await expect(lowConfirmCard).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Expense Logged Successfully!')).toHaveCount(0);

    // Edit & Confirm saves once and removes confirm card
    await lowConfirmCard.locator('[data-testid="tool-edit-btn"]').click();
    await modal.locator('[data-testid="inline-edit-category"]').selectOption('Shopping');
    await modal.locator('[data-testid="inline-edit-save-btn"]').click();
    await expect(modal.locator('text=Expense Logged Successfully!').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('[data-testid="tool-confirm-card"]')).toHaveCount(0);

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('38.4: Graceful provider 500 error fallback to local engine with Retry button', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRajMailTemp();

    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, code: 'PROVIDER_ERROR', error: 'Upstream failure' })
      });
    });

    const modal = await openChat(page);
    await modal.locator('[data-testid="whatsapp-chat-input"]').fill('Tell me why groceries cost more lately');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    await expect(modal.locator('text=Using local assistant mode').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('button:has-text("Retry Online AI")').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('38.5: Quota exhausted (429) falls back to local engine with zero retry loop', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRajMailTemp();

    let callCount = 0;
    await page.route('**/api/chat', async (route) => {
      callCount += 1;
      await route.fulfill({
        status: 429,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          code: 'GLOBAL_QUOTA_EXHAUSTED',
          error: 'Daily free-tier AI capacity reached.'
        })
      });
    });

    const modal = await openChat(page);
    await modal.locator('[data-testid="whatsapp-chat-input"]').fill('How should I trim monthly subscriptions?');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    await expect(modal.locator('text=Daily free-tier AI quota is exhausted for today').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('button:has-text("Retry Online AI")')).toHaveCount(0);
    // Ensure exactly 1 request was made (no retry loop)
    expect(callCount).toBe(1);

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('38.6: Mobile drawer height, no keyboard autofocus on open, and natural conversational chat', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRajMailTemp();
    const modal = await openChat(page);

    // 1. Input must NOT autofocus on modal open (prevents mobile keyboard popping up unexpectedly)
    const isInputFocusedOnOpen = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.getAttribute?.('data-testid') === 'whatsapp-chat-input';
    });
    expect(isInputFocusedOnOpen).toBe(false);

    // 2. Comfortable tall mobile height (>= 88% viewport on mobile widths)
    const vp = page.viewportSize();
    if (vp && vp.width < 640) {
      const cardBox = await modal.locator('> div').first().boundingBox();
      expect(cardBox && cardBox.height).toBeGreaterThanOrEqual(vp.height * 0.88);
    }

    // 3. Normal conversational chat (small talk, health check, static 404 fallback without scary error banner)
    const input = modal.locator('[data-testid="whatsapp-chat-input"]');
    const sendBtn = modal.locator('[data-testid="whatsapp-chat-send-btn"]');

    await input.fill('how are you?');
    await sendBtn.click();
    await expect(modal.locator('text=doing great').first()).toBeVisible({ timeout: 10000 });

    await input.fill('how am i doing?');
    await sendBtn.click();
    await expect(modal.locator('text=Today\'s spend so far:').first()).toBeVisible({ timeout: 10000 });

    await input.fill('thanks');
    await sendBtn.click();
    await expect(modal.locator('text=You\'re welcome!').first()).toBeVisible({ timeout: 10000 });

    await modal.locator('button[aria-label="Back"]').click();
  });
});
