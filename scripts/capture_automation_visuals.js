const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = path.resolve('C:/Users/hi/.gemini/antigravity/brain/6e272aed-82fa-4053-96f8-0b6b7bbfe2c7');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Login as Raj
  await page.goto('http://localhost:3001');
  await page.waitForTimeout(600);
  
  const signinTab = page.locator('button:has-text("Sign In")').first();
  if (await signinTab.isVisible()) {
    await signinTab.click();
    await page.locator('input[type="email"]').first().fill('raaajshinde@gmail.com');
    await page.locator('input[type="password"]').first().fill('Password123!');
    await page.locator('button[type="submit"]:has-text("Sign In")').first().click();
    await page.waitForTimeout(1000);
  }

  // Dismiss greeting if present
  try {
    const greetingBtn = page.locator('button:has-text("Let\'s Dive In"), button:has-text("Got It")').first();
    if (await greetingBtn.isVisible({ timeout: 1500 })) {
      await greetingBtn.click();
      await page.waitForTimeout(400);
    }
  } catch (e) {}

  // 1. Capture Overview with Speed Chips & Automation Bar
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'speed_chips_overview.png'), fullPage: false });
  console.log('Saved speed_chips_overview.png');

  // 2. Capture WhatsApp Chat Assistant Modal
  const whatsappBtn = page.locator('[data-testid="floating-whatsapp-btn"]');
  await whatsappBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'whatsapp_assistant_chatbox.png') });
  console.log('Saved whatsapp_assistant_chatbox.png');
  await page.locator('[data-testid="whatsapp-chatbox-modal"] button[title="Close"]').click();
  await page.waitForTimeout(400);

  // 3. Capture SMS Parser Modal
  const smsBtn = page.locator('[data-testid="home-open-sms-parser-btn"]').first();
  await smsBtn.click();
  await page.waitForTimeout(400);
  // Click sample HDFC button to show populated data
  const sampleBtn = page.locator('button:has-text("HDFC Zomato ₹450")');
  if (await sampleBtn.isVisible()) {
    await sampleBtn.click();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'sms_parser_modal.png') });
  console.log('Saved sms_parser_modal.png');
  await page.locator('[data-testid="sms-parser-modal"] button[aria-label="Close"]').click();
  await page.waitForTimeout(400);

  // 4. Capture Recurring Subscriptions Modal
  const recurringBtn = page.locator('[data-testid="home-open-recurring-modal-btn"]').first();
  await recurringBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'recurring_subscriptions_modal.png') });
  console.log('Saved recurring_subscriptions_modal.png');
  await page.locator('[data-testid="recurring-subscriptions-modal"] button[aria-label="Close Modal"]').click();
  await page.waitForTimeout(400);

  // 5. Capture Receipt Scanner Modal
  const receiptBtn = page.locator('[data-testid="home-open-receipt-scanner-btn"]').first();
  await receiptBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'receipt_scanner_modal.png') });
  console.log('Saved receipt_scanner_modal.png');
  await page.locator('[data-testid="receipt-scanner-modal"] button[aria-label="Close Modal"]').click();
  await page.waitForTimeout(400);

  await browser.close();
  console.log('All visual captures complete!');
}

main().catch(console.error);
