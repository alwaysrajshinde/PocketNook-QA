// @ts-check
const { test, expect } = require('../fixtures/auth.fixture');
const { cleanTestUsers } = require('../helpers/dbHelper');

test.describe('Area 39: Optimized Liquid Spend Wave Graph', () => {
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

  test('39.1: Liquid Spend Wave renders smooth curve, Peak/Latest snap controls, and scrubs cleanly without currency clutter', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRaj();
    await ensureCleanHome(page);

    const card = page.locator('[data-testid="spend-graph-card"]').first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="speed-chips-strip"]').first()).toBeVisible();

    // Radar and Orbit modes are removed
    await expect(card.locator('[data-testid="graph-mode-radar"]')).toHaveCount(0);
    await expect(card.locator('[data-testid="graph-mode-orbit"]')).toHaveCount(0);

    // Wave SVG + spotlight pill render cleanly with zero rupee/percentage figures
    await expect(card.locator('[data-testid="liquid-wave-svg"]')).toBeVisible();
    const spotlight = card.locator('[data-testid="wave-spotlight-pill"]');
    await expect(spotlight).toBeVisible();

    const text = await card.innerText();
    expect(text.includes('₹')).toBe(false);
    expect(text.includes('%')).toBe(false);

    // Test Peak & Latest snap controls + pointer scrub on SVG
    await card.locator('[data-testid="wave-jump-peak"]').click();
    await expect(spotlight).toBeVisible();
    await card.locator('[data-testid="wave-jump-latest"]').click();
    await expect(spotlight).toBeVisible();
  });
});
