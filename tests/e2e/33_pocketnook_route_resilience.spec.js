// @ts-check
const { test, expect } = require('../fixtures/auth.fixture');
const { cleanTestUsers } = require('../helpers/dbHelper');

test.describe('Area 33: PocketNook Routing & GitHub Pages Path Resilience', () => {
  test.afterAll(() => {
    cleanTestUsers();
  });

  test('33.1: Visiting #/PocketNook/ route resolves to Overview without 404', async ({ page, authHelpers }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await authHelpers.loginAsRaj();

    // Navigate explicitly to #/PocketNook/
    await page.goto('/#/PocketNook/');
    await page.waitForLoadState('networkidle');

    // Verify 404 container is NOT shown
    await expect(page.locator('[data-testid="not-found-container"]')).not.toBeVisible();
    await expect(page.locator('text=Page Not Found')).not.toBeVisible();

    // Verify Overview dashboard elements are displayed
    await expect(page.locator('text=MONTHLY BUDGET').first()).toBeVisible();
    await expect(page.locator('aside:has-text("PocketNook")').first()).toBeVisible();
  });

  test('33.2: Visiting #/PocketNook/transactions resolves directly to Transactions', async ({ page, authHelpers }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await authHelpers.loginAsRaj();

    await page.goto('/#/PocketNook/transactions');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="not-found-container"]')).not.toBeVisible();
    await expect(page.locator('aside:has-text("PocketNook")').first()).toBeVisible();
  });

  test('33.3: Visiting #/PocketNook-QA/ resolves to Overview without 404', async ({ page, authHelpers }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await authHelpers.loginAsRaj();

    // QA repo subpath simulation
    await page.goto('/#/PocketNook-QA/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="not-found-container"]')).not.toBeVisible();
    await expect(page.locator('text=Page Not Found')).not.toBeVisible();
    await expect(page.locator('text=MONTHLY BUDGET').first()).toBeVisible();
  });

  test('33.4: Visiting #/PocketNook-QA/transactions resolves directly to Transactions', async ({ page, authHelpers }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await authHelpers.loginAsRaj();

    await page.goto('/#/PocketNook-QA/transactions');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="not-found-container"]')).not.toBeVisible();
    await expect(page.locator('aside:has-text("PocketNook")').first()).toBeVisible();
  });

  test('33.5: Visiting residual #/-QA/ resolves cleanly to Overview without 404', async ({ page, authHelpers }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await authHelpers.loginAsRaj();

    await page.goto('/#/-QA/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="not-found-container"]')).not.toBeVisible();
    await expect(page.locator('text=Page Not Found')).not.toBeVisible();
    await expect(page.locator('text=MONTHLY BUDGET').first()).toBeVisible();
  });

  test('33.6: Genuinely invalid route still displays NotFoundRoute', async ({ page, authHelpers }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await authHelpers.loginAsRaj();

    await page.goto('/#/some-non-existent-broken-page');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="not-found-container"]')).toBeVisible();
    await expect(page.locator('h1:has-text("Page Not Found")')).toBeVisible();

    // Clicking Go to Overview recovers back to Overview
    await page.locator('[data-testid="not-found-home-btn"]').click();
    await expect(page.locator('[data-testid="not-found-container"]')).not.toBeVisible();
    await expect(page.locator('text=MONTHLY BUDGET').first()).toBeVisible();
  });
});
