const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();
  await page.goto('http://localhost:3001');

  // Sign in as Raj
  const signinTab = page.locator('button:has-text("Sign In")').first();
  if (await signinTab.isVisible({ timeout: 5000 })) {
    await signinTab.click();
    await page.locator('input[type="email"]').first().fill('raaajshinde@gmail.com');
    await page.locator('input[type="password"]').first().fill('Password123!');
    await page.locator('button[type="submit"]:has-text("Sign In")').first().click();
    await page.waitForSelector('text=Monthly Budget', { timeout: 15000 });
  }

  // Dismiss greeting overlay if any
  try {
    const btn = page.locator('button:has-text("Let\'s Dive In"), button:has-text("Got It"), text=TAP ANYWHERE TO CONTINUE').first();
    if (await btn.isVisible({ timeout: 2000 })) {
      await btn.click();
      await page.waitForTimeout(500);
    }
  } catch (e) {}

  // Open Copilot
  const fab = page.locator('[data-testid="floating-whatsapp-btn"], [data-testid="android-open-whatsapp-btn"]').first();
  await fab.click();
  await page.waitForTimeout(600);

  // Send 50/30/20 Rule query
  const chatInput = page.locator('[data-testid="whatsapp-chat-input"]');
  await chatInput.fill('Explain 50/30/20 rule for my budget');
  await page.locator('[data-testid="whatsapp-chat-send-btn"]').click();

  // Wait for framework response
  await page.waitForSelector('text=The 50/30/20 Financial Framework', { timeout: 10000 });
  await page.waitForTimeout(1000);

  const outPath = path.resolve('C:/Users/hi/.gemini/antigravity/brain/6e272aed-82fa-4053-96f8-0b6b7bbfe2c7/smart_financial_copilot_intelligence.png');
  await page.screenshot({ path: outPath });
  console.log('Saved screenshot to:', outPath);

  await browser.close();
})();
