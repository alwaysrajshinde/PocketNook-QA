// @ts-check
const { test, expect } = require('../fixtures/auth.fixture');
const { cleanTestUsers } = require('../helpers/dbHelper');

test.describe('Area 39: Visual Spend Pulse Graph (Wave, Radar & Orbit)', () => {
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

  test('39.1: SpeedChips stays intact and Visual Spend Pulse switches Wave, Radar, and Orbit graphs without currency clutter', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRaj();
    await ensureCleanHome(page);

    const card = page.locator('[data-testid="spend-graph-card"]').first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="speed-chips-strip"]').first()).toBeVisible();

    // Wave View
    await expect(card.locator('[data-testid="graph-view-wave"]')).toBeVisible();
    const waveText = await card.innerText();
    expect(waveText.includes('₹')).toBe(false);
    expect(waveText.includes('%')).toBe(false);

    // Switch to Radar View
    await card.locator('[data-testid="graph-mode-radar"]').click();
    await expect(card.locator('[data-testid="graph-view-radar"]')).toBeVisible();
    const radarText = await card.innerText();
    expect(radarText.includes('₹')).toBe(false);

    // Switch to Orbit View
    await card.locator('[data-testid="graph-mode-orbit"]').click();
    await expect(card.locator('[data-testid="graph-view-orbit"]')).toBeVisible();
    const orbitText = await card.innerText();
    expect(orbitText.includes('₹')).toBe(false);
  });
});
