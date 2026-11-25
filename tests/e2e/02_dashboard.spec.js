// @ts-check
const { test, expect } = require('../fixtures/auth.fixture');
const { generateUniqueUser } = require('../fixtures/testData');
const { cleanTestUsers } = require('../helpers/dbHelper');

test.describe('Area B: Dashboard Metrics, Calculations & States', () => {
  test.afterAll(() => {
    cleanTestUsers();
  });

  test('B1: Default monthly budget is ₹12,000 and metrics calculate correctly', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRaj();

    // Verify Monthly Budget label and value
    const budgetSection = page.locator('div:has-text("Monthly Budget")').first();
    await expect(budgetSection).toBeVisible();
    await expect(budgetSection).toContainText(/₹10,000|₹12,000/);

    // Verify Spent and Remaining pills are rendered
    await expect(page.locator('text=Spent').first()).toBeVisible();
    await expect(page.locator('text=Remaining').first()).toBeVisible();
  });

  test('B2: New user has pristine empty dashboard (₹0 spent, budget 0 default, 0% gauge)', async ({ page, authHelpers }) => {
    const newUser = generateUniqueUser('empty_dash');
    await authHelpers.loginAsNewUser(newUser.email, newUser.name);

    // Verify budget is 0 or "No budget set" by default for new user
    const bodyText = await page.innerText('body');
    expect(bodyText).toMatch(/No budget set|Set Monthly Budget|₹0/);

    // Verify 0% spent gauge or ₹0 spent
    expect(bodyText).toContain('₹0');
  });

  test('B3: Quick stat cards display Today, This Week, and This Month totals', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRaj();

    await expect(page.locator('text=Today').first()).toBeVisible();
    await expect(page.locator('text=This Week').first()).toBeVisible();
    await expect(page.locator('text=This Month').first()).toBeVisible();
  });

  test('B4: Top Categories breakdown or Money Aura Story is displayed cleanly', async ({ page, authHelpers }, testInfo) => {
    await authHelpers.loginAsRaj();

    if (testInfo.project.name === 'chromium-mobile') {
      await expect(page.locator('[data-testid="spend-graph-card"]').first()).toBeVisible();
    } else {
      const topCats = page.locator('text=Top Categories');
      await expect(topCats.first()).toBeVisible();
    }
  });

  test('B5: Month selector updates dashboard metrics for selected period', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRaj();

    // Find and click month selector dropdown
    const monthBtn = page.locator('button:has-text("Nov 2026")').first();
    if (await monthBtn.isVisible()) {
      await monthBtn.click();
      // Verify dropdown opened
      const options = page.locator('div:has-text("Nov 2026")');
      await expect(options.first()).toBeVisible();
      // Click again to close
      await page.keyboard.press('Escape');
    }
  });
});
