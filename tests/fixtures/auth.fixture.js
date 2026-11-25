// @ts-check
const { test: base, expect } = require('@playwright/test');

/**
 * Custom Playwright Fixture with Universal Consumer Auth Helpers
 */
const test = base.extend({
  authHelpers: async ({ page }, use) => {
    const helpers = {
      // Clear all session & cache storage
      async clearSession() {
        await page.goto('/');
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
        await page.reload();
      },

      // Login as Raj Shinde (existing account with historical data) through standard Sign In flow
      async loginAsRaj() {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        
        // Ensure Sign In tab is active
        const signinTab = page.locator('button:has-text("Sign In")').first();
        await expect(signinTab).toBeVisible({ timeout: 10000 });
        await signinTab.click();

        // Fill standard login credentials
        const emailInput = page.locator('input[type="email"]').first();
        await expect(emailInput).toBeVisible({ timeout: 5000 });
        await emailInput.fill('raaajshinde@gmail.com');

        const passwordInput = page.locator('input[type="password"]').first();
        await expect(passwordInput).toBeVisible({ timeout: 5000 });
        await passwordInput.fill('Password123!');

        // Submit Sign In
        const submitBtn = page.locator('button[type="submit"]:has-text("Sign In")').first();
        await submitBtn.click();

        // Wait for dashboard to load with historical records
        await expect(page.locator('text=Monthly Budget').first()).toBeVisible({ timeout: 15000 });
      },

      // Login as user requested in prompt: rajmailtemp@gmail.com / Test@123
      async loginAsRajMailTemp() {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();

        const signinTab = page.locator('button:has-text("Sign In")').first();
        await expect(signinTab).toBeVisible({ timeout: 10000 });
        await signinTab.click();

        const emailInput = page.locator('input[type="email"]').first();
        await expect(emailInput).toBeVisible({ timeout: 5000 });
        await emailInput.fill('rajmailtemp@gmail.com');

        const passwordInput = page.locator('input[type="password"]').first();
        await expect(passwordInput).toBeVisible({ timeout: 5000 });
        await passwordInput.fill('Test@123');

        const submitBtn = page.locator('button[type="submit"]:has-text("Sign In")').first();
        await submitBtn.click();

        await expect(page.locator('text=Monthly Budget').first()).toBeVisible({ timeout: 15000 });

        await page.evaluate(() => {
          try {
            localStorage.setItem('et_tour_completed_rajmailtemp@gmail.com', 'true');
            localStorage.setItem('et_tour_completed_all', 'true');
            localStorage.setItem('expense_tracker_welcome_shown', 'true');
            localStorage.setItem('has_seen_welcome_greeting', 'true');
          } catch (e) {}
        });
      },

      // Login as new user through standard Create Account registration flow
      async loginAsNewUser(email, name = 'Test User') {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();

        // Switch to Create Account tab (handles Public Landing or direct Auth Card)
        const landingSignupBtn = page.locator('button:has-text("Start Tracking Free")').first();
        if (await landingSignupBtn.isVisible()) {
          await landingSignupBtn.click();
        }
        const signupTab = page.locator('button:has-text("Create Account")').first();
        await expect(signupTab).toBeVisible({ timeout: 10000 });
        await signupTab.click();

        // Fill registration form
        const nameInput = page.locator('input[name="name"], input[placeholder*="Name"]').first();
        if (await nameInput.isVisible()) {
          await nameInput.fill(name);
        }

        const emailInput = page.locator('input[type="email"]').first();
        await expect(emailInput).toBeVisible({ timeout: 5000 });
        await emailInput.fill(email);

        const passwordInputs = page.locator('input[type="password"]');
        await passwordInputs.nth(0).fill('Password123!');
        if (await passwordInputs.count() > 1) {
          await passwordInputs.nth(1).fill('Password123!');
        }

        // Submit Create Account
        const submitBtn = page.locator('button[type="submit"]:has-text("Create Account")').first();
        await submitBtn.click();

        // Wait for fresh dashboard to open (isolated, 0 spent)
        await expect(page.locator('text=Monthly Budget').first()).toBeVisible({ timeout: 15000 });

        // If the Onboarding Tour modal is visible, dismiss it so tests can interact with the dashboard
        const skipTourBtn = page.locator('button:has-text("Skip Tour")').first();
        if (await skipTourBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await skipTourBtn.click();
        }
      },

      // Logout helper
      async logout() {
        const logoutBtn = page.locator('button[title="Log Out"], button:has-text("Log Out")').first();
        if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await logoutBtn.click();
        } else {
          // Open profile card dropdown
          const profileCard = page.locator('[data-testid="sidebar-profile-card"]').first();
          if (await profileCard.isVisible()) {
            await profileCard.click();
            await page.locator('button:has-text("Log Out")').click();
          } else {
            // Fallback clear session
            await page.evaluate(() => localStorage.removeItem('expense_tracker_auth_session'));
            await page.reload();
          }
        }
        await expect(page.locator('button:has-text("Sign In")').first()).toBeVisible({ timeout: 10000 });
      }
    };

    await use(helpers);
  }
});

module.exports = { test, expect };
