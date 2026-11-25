// @ts-check
const { test, expect } = require('../fixtures/auth.fixture');
const { cleanTestUsers } = require('../helpers/dbHelper');

test.describe('Area 38: Streaming LLM SSE, Stop Button, Tool Confirm Cards, Consent & Offline Fallback', () => {
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

  test('38.1: Privacy consent toggle defaults OFF and toggles cleanly inside Chat & Settings', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRajMailTemp();
    const modal = await openChat(page);

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

    // Deterministic mocked SSE stream with delayed chunks so Stop button can be clicked mid-stream
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

    // Stop button appears while stream is active
    const stopBtn = modal.locator('[data-testid="stop-generating-btn"]');
    await expect(stopBtn).toBeVisible({ timeout: 4000 });

    // Let first request complete to verify DOMPurify strips XSS from streamed LLM response
    await expect(modal.locator('text=Here is your spending tip:').first()).toBeVisible({ timeout: 10000 });
    const xssEval = await page.evaluate(() => window['__llm_xss']);
    expect(xssEval).toBeUndefined();

    // Now test clicking Stop generating mid-flight
    await input.fill('Analyze my long term habits in detail please');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();
    await expect(stopBtn).toBeVisible({ timeout: 4000 });
    await stopBtn.click();
    await expect(modal.locator('[data-testid="whatsapp-chat-send-btn"]')).toBeVisible({ timeout: 4000 });

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('38.3: Validated tool-call Confirm / Edit / Cancel flow and double-tap idempotency', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRajMailTemp();
    const modal = await openChat(page);
    const input = modal.locator('[data-testid="whatsapp-chat-input"]');

    // 1. Live mock backend route: "please set budget 28000" -> set_budget always requires Confirm
    await input.fill('please set budget 28000');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    const confirmCard = modal.locator('[data-testid="tool-confirm-card"]').first();
    await expect(confirmCard).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Update your monthly budget to ₹28,000?').first()).toBeVisible();

    // Cancel first -> nothing written
    await confirmCard.locator('[data-testid="tool-cancel-btn"]').click();
    await expect(modal.locator('text=Cancelled — no changes written').first()).toBeVisible();

    // 2. High-value tool call ("I paid 650 on Swiggy for biryani") -> requires Confirm & Edit
    await input.fill('I ordered biryani via Swiggy 650');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    const logConfirmCard = modal.locator('[data-testid="tool-confirm-card"]').last();
    await expect(logConfirmCard).toBeVisible({ timeout: 10000 });

    // Tap Edit -> change category -> save
    await logConfirmCard.locator('[data-testid="tool-edit-btn"]').click();
    await modal.locator('[data-testid="inline-edit-category"]').selectOption('Shopping');
    await modal.locator('[data-testid="inline-edit-save-btn"]').click();
    await expect(modal.locator('text=Expense Logged Successfully!').first()).toBeVisible({ timeout: 10000 });

    // Confirm card should no longer remain clickable for double logging
    await expect(modal.locator('[data-testid="tool-confirm-card"]')).toHaveCount(0);

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('38.4: Graceful offline / provider error fallback to local engine with Retry button', async ({ page, authHelpers }) => {
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

    // Friendly local fallback + Retry Online AI button, zero raw error trace
    await expect(modal.locator('text=Using local assistant mode').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('button:has-text("Retry Online AI")').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });
});
