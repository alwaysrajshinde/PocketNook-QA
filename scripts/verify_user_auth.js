const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3001');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const signinTab = page.locator('button:has-text("Sign In")').first();
  await signinTab.click();
  await page.locator('input[type="email"]').first().fill('rajmailtemp@gmail.com');
  await page.locator('input[type="password"]').first().fill('Test@123');
  await page.locator('button[type="submit"]:has-text("Sign In")').first().click();

  try {
    await page.waitForSelector('text=Monthly Budget', { timeout: 8000 });
    console.log('SUCCESS: Logged in directly via Sign In as rajmailtemp@gmail.com');
  } catch (err) {
    console.log('Direct sign in did not find user, trying registration...');
    await page.reload();
    const signupTab = page.locator('button:has-text("Create Account")').first();
    await signupTab.click();
    await page.locator('input[name="name"]').first().fill('Raj Temp');
    await page.locator('input[type="email"]').first().fill('rajmailtemp@gmail.com');
    await page.locator('input[name="password"]').first().fill('Test@123');
    await page.locator('input[name="confirmPassword"]').first().fill('Test@123');
    await page.locator('button[type="submit"]:has-text("Create Account")').first().click();
    await page.waitForSelector('text=Monthly Budget', { timeout: 15000 });
    console.log('SUCCESS: Registered and logged in as rajmailtemp@gmail.com');
  }

  await browser.close();
})().catch(console.error);
