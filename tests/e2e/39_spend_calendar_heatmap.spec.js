// @ts-check
const { test, expect } = require('../fixtures/auth.fixture');
const { cleanTestUsers } = require('../helpers/dbHelper');

test.describe('Area 39: Five Practical Home Workflows Showcase', () => {
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

  test('39.1: All 5 meaningful workflows render, switch cleanly, and parse multi-expense Quick-Drop', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRaj();
    await ensureCleanHome(page);

    const showcase = page.locator('[data-testid="five-options-showcase"]').first();
    await expect(showcase).toBeVisible({ timeout: 10000 });

    // Option 1: Month-End Runway & Fixed Split
    await expect(page.locator('[data-testid="option-runway-card"]').first()).toBeVisible();

    // Option 2: Did-I-Log-It Today + Auto-Learned Usuals
    await page.locator('[data-testid="preview-option-tab-2"]').first().click();
    await expect(page.locator('[data-testid="option-usuals-card"]').first()).toBeVisible();

    // Option 3: Multi-Expense & SMS Quick-Drop Bar
    await page.locator('[data-testid="preview-option-tab-3"]').first().click();
    const fastDrop = page.locator('[data-testid="option-fast-drop-card"]').first();
    await expect(fastDrop).toBeVisible();
    await page.locator('[data-testid="fast-drop-sample-btn"]').first().click();
    await expect(page.locator('[data-testid="fast-drop-save-all-btn"]').first()).toContainText('Save All (3 entries)');

    // Option 4: UPI / Credit Card / Cash Watcher
    await page.locator('[data-testid="preview-option-tab-4"]').first().click();
    await expect(page.locator('[data-testid="option-wallets-card"]').first()).toBeVisible();

    // Option 5: Leak, Spike & Duplicate Audit
    await page.locator('[data-testid="preview-option-tab-5"]').first().click();
    await expect(page.locator('[data-testid="option-inspector-card"]').first()).toBeVisible();
  });
});
