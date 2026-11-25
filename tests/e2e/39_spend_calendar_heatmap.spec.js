// @ts-check
const { test, expect } = require('../fixtures/auth.fixture');
const { cleanTestUsers } = require('../helpers/dbHelper');

test.describe('Area 39: Zero-Number Smart Action Hub', () => {
  test.afterAll(() => {
    cleanTestUsers();
  });

  async function ensureCleanHome(page) {
    const greeting = page.locator('[data-testid="welcome-greeting-overlay"], button:has-text("Let\'s Dive In"), button:has-text("Got It")').first();
    if (await greeting.isVisible({ timeout: 2500 }).catch(() => false)) {
      await greeting.click({ force: true }).catch(() => {});
    }
    const tourClose = page.locator('[data-testid="onboarding-tour-close-btn"], button[aria-label="Close Tour"]').first();
    if (await tourClose.isVisible({ timeout: 4500 }).catch(() => false)) {
      await tourClose.click({ force: true }).catch(() => {});
      await expect(tourClose).toHaveCount(0, { timeout: 3000 }).catch(() => {});
    }
  }

  test('39.1: Smart Action Hub displays qualitative pace without numeric clutter and saves checklists cleanly', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRaj();
    await ensureCleanHome(page);

    const hub = page.locator('[data-testid="smart-action-hub"]').first();
    await expect(hub).toBeVisible({ timeout: 10000 });
    await expect(hub.locator('[data-testid="pulse-status-badge"]')).toBeVisible();
    await expect(hub.locator('[data-testid="category-color-ribbon"]')).toBeVisible();

    // Ensure the hub stays purely qualitative (zero currency figures)
    const hubText = await hub.innerText();
    expect(hubText.includes('₹')).toBe(false);

    // Add a pending spend reminder note cleanly
    await hub.locator('[data-testid="hub-note-input"]').fill('Pay broadband bill');
    await hub.locator('[data-testid="hub-note-add-btn"]').click();
    await expect(hub).toContainText('Pay broadband bill');

    // Quick tools are visible and interactive
    await expect(hub.locator('[data-testid="hub-action-scan"]')).toBeVisible();
    await expect(hub.locator('[data-testid="hub-action-sms"]')).toBeVisible();
    await expect(hub.locator('[data-testid="hub-action-chat"]')).toBeVisible();
    await expect(hub.locator('[data-testid="hub-action-bills"]')).toBeVisible();
  });
});
