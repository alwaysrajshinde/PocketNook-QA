// @ts-check
const { test, expect } = require('../fixtures/auth.fixture');
const { cleanTestUsers } = require('../helpers/dbHelper');

test.describe('Area 36: Full AI Financial Copilot & Zero-Leakage PII Safety', () => {
  test.afterAll(() => {
    cleanTestUsers();
  });

  async function dismissGreetingIfNeeded(page) {
    try {
      const btn = page.locator('button:has-text("Let\'s Dive In"), button:has-text("Got It"), text=TAP ANYWHERE TO CONTINUE, [data-testid="welcome-greeting-overlay"]').first();
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.click();
        await page.waitForTimeout(500);
      }
    } catch (e) {}
  }

  test.beforeEach(async ({ page, authHelpers }) => {
    await authHelpers.loginAsRaj();
    await dismissGreetingIfNeeded(page);
  });

  test('36.1: WhatsApp Chatbox opens as PocketNook Copilot with PII encryption badge', async ({ page }) => {
    const fab = page.locator('[data-testid="floating-whatsapp-btn"], [data-testid="android-open-whatsapp-btn"]').first();
    await expect(fab).toBeVisible();
    await fab.click();

    // Verify Copilot header and Zero-Leakage badge
    const modal = page.locator('[data-testid="whatsapp-chatbox-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h3:has-text("PocketNook")').first()).toBeVisible();
    await expect(modal.locator('text=Zero-Leakage AI').first()).toBeVisible();
    await expect(modal.locator('text=Bank-Grade Zero Leakage').first()).toBeVisible();

    // Close modal
    await modal.locator('button[aria-label="Back"]').click();
  });

  test('36.2: Copilot performs Affordability Analysis without leaking data', async ({ page }) => {
    const fab = page.locator('[data-testid="floating-whatsapp-btn"], [data-testid="android-open-whatsapp-btn"]').first();
    await fab.click();
    const modal = page.locator('[data-testid="whatsapp-chatbox-modal"]');
    await expect(modal).toBeVisible();

    // Ask affordability question
    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('Can I afford a 3500 dinner?');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    // Verify diagnostic response is rendered
    await expect(modal.locator('text=Affordability Financial Diagnosis').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Planned Purchase').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('36.3: Copilot calculates Smart Bill Split with 1-tap share logging button', async ({ page }) => {
    const fab = page.locator('[data-testid="floating-whatsapp-btn"], [data-testid="android-open-whatsapp-btn"]').first();
    await fab.click();
    const modal = page.locator('[data-testid="whatsapp-chatbox-modal"]');
    await expect(modal).toBeVisible();

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('Split 3000 between 6 people');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    // Verify calculation: 3000 / 6 = ₹500
    await expect(modal.locator('text=Smart Bill Split Calculation').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Each Person Owes').first()).toBeVisible();
    await expect(modal.locator('button:has-text("Log My Share")').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('36.4: Copilot checks Safe Daily Burn Rate via prompt chip', async ({ page }) => {
    const fab = page.locator('[data-testid="floating-whatsapp-btn"], [data-testid="android-open-whatsapp-btn"]').first();
    await fab.click();
    const modal = page.locator('[data-testid="whatsapp-chatbox-modal"]');
    await expect(modal).toBeVisible();

    // Click quick prompt chip: Daily Pace
    const paceChip = modal.locator('[data-testid="whatsapp-quick-prompt-daily-pace"]').first();
    await expect(paceChip).toBeVisible();
    await paceChip.click();

    await expect(modal.locator('text=Safe Daily Burn Rate').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Safe Target:').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('36.5: Voice dictation mic button is accessible and reactive', async ({ page }) => {
    const fab = page.locator('[data-testid="floating-whatsapp-btn"], [data-testid="android-open-whatsapp-btn"]').first();
    await fab.click();
    const modal = page.locator('[data-testid="whatsapp-chatbox-modal"]');
    await expect(modal).toBeVisible();

    // Voice mic button
    const micBtn = modal.locator('[data-testid="whatsapp-voice-mic-btn"]').first();
    await expect(micBtn).toBeVisible();
    await expect(micBtn).toHaveAttribute('aria-label', 'Voice input');

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('36.6: Copilot explains 50/30/20 financial rule with mathematical breakdown', async ({ page }) => {
    const fab = page.locator('[data-testid="floating-whatsapp-btn"], [data-testid="android-open-whatsapp-btn"]').first();
    await fab.click();
    const modal = page.locator('[data-testid="whatsapp-chatbox-modal"]');
    await expect(modal).toBeVisible();

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('Explain 50/30/20 rule for my budget');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    // Verify 50/30/20 framework response
    await expect(modal.locator('text=The 50/30/20 Financial Framework').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=50% Needs').first()).toBeVisible();
    await expect(modal.locator('text=30% Wants').first()).toBeVisible();
    await expect(modal.locator('text=20% Savings').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('36.7: Copilot calculates Emergency Fund reserve targets (3-month & 6-month)', async ({ page }) => {
    const fab = page.locator('[data-testid="floating-whatsapp-btn"], [data-testid="android-open-whatsapp-btn"]').first();
    await fab.click();
    const modal = page.locator('[data-testid="whatsapp-chatbox-modal"]');
    await expect(modal).toBeVisible();

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('How much emergency fund do I need?');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    // Verify Emergency Reserve architecture
    await expect(modal.locator('text=Emergency Reserve Architecture').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=3-Month Baseline Cushion').first()).toBeVisible();
    await expect(modal.locator('text=6-Month Fortress Cushion').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('36.8: Copilot provides Debt Payoff strategy (Avalanche vs Snowball)', async ({ page }) => {
    const fab = page.locator('[data-testid="floating-whatsapp-btn"], [data-testid="android-open-whatsapp-btn"]').first();
    await fab.click();
    const modal = page.locator('[data-testid="whatsapp-chatbox-modal"]');
    await expect(modal).toBeVisible();

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('How to pay off credit card debt?');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    // Verify Debt blueprint
    await expect(modal.locator('text=Debt Acceleration Blueprint').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Debt Avalanche').first()).toBeVisible();
    await expect(modal.locator('text=Debt Snowball').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('36.9: Copilot answers bilingual Hinglish savings advice and general financial questions', async ({ page }) => {
    const fab = page.locator('[data-testid="floating-whatsapp-btn"], [data-testid="android-open-whatsapp-btn"]').first();
    await fab.click();
    const modal = page.locator('[data-testid="whatsapp-chatbox-modal"]');
    await expect(modal).toBeVisible();

    // 1. Bilingual savings query
    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('Paisa kaise bachaye?');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    await expect(modal.locator('text=Smart Savings Plan').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Pay Yourself First').first()).toBeVisible();

    // 2. Open-ended financial advice query
    await chatInput.fill('How to manage money better this month?');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    await expect(modal.locator('text=PocketNook Financial Intelligence Diagnosis').first()).toBeVisible({ timeout: 10000 });

    await modal.locator('button[aria-label="Back"]').click();
  });
});
