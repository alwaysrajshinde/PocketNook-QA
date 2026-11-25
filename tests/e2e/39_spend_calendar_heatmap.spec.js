// @ts-check
const { test, expect } = require('../fixtures/auth.fixture');
const { cleanTestUsers } = require('../helpers/dbHelper');

test.describe('Area 39: Live Money Aura & Daily Rhythm Story', () => {
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

  test('39.1: Money Aura Story renders with zero numbers and navigates Aura, Rhythm, and Badges slides smoothly', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRaj();
    await ensureCleanHome(page);

    const card = page.locator('[data-testid="money-aura-card"]').first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card.locator('[data-testid="aura-slide-aura"]')).toBeVisible();

    // Slide 1 strictly zero digits & zero currency symbol
    const slide1Text = await card.innerText();
    expect(/\d/.test(slide1Text)).toBe(false);
    expect(slide1Text.includes('₹')).toBe(false);

    // Slide 2: Rhythm wave
    await card.locator('[data-testid="aura-progress-rhythm"]').click();
    await expect(card.locator('[data-testid="aura-slide-rhythm"]')).toBeVisible();
    const slide2Text = await card.innerText();
    expect(/\d/.test(slide2Text)).toBe(false);

    // Slide 3: Badges
    await card.locator('[data-testid="aura-progress-badges"]').click();
    await expect(card.locator('[data-testid="aura-slide-badges"]')).toBeVisible();
    const slide3Text = await card.innerText();
    expect(/\d/.test(slide3Text)).toBe(false);
  });
});
