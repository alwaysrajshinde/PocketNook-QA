// @ts-check
const { test, expect } = require('../fixtures/auth.fixture');
const { cleanTestUsers } = require('../helpers/dbHelper');

test.describe('Area 35: Automation Suite (SMS/UPI Parser, Speed Chips, Recurring Bills, WhatsApp Chatbox, Receipt OCR)', () => {
  test.afterAll(() => {
    cleanTestUsers();
  });

  async function dismissGreetingIfNeeded(page) {
    try {
      const btn = page.locator('button:has-text("Let\'s Dive In"), button:has-text("Got It"), text=TAP ANYWHERE TO CONTINUE, [data-testid="welcome-greeting-overlay"]').first();
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.click();
        await page.waitForTimeout(500);
      }
    } catch (e) {}
  }

  test('35.1: Backend WhatsApp Webhook & Natural Language Parser API', async ({ request, baseURL }) => {
    const apiContext = request;

    // 1. Meta Webhook Verification challenge
    const getRes = await apiContext.get('http://localhost:3001/api/webhook/whatsapp', {
      params: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'pocketnook_secret_token',
        'hub.challenge': 'test_challenge_12345'
      }
    });
    expect(getRes.status()).toBe(200);
    const getBody = await getRes.text();
    expect(getBody).toBe('test_challenge_12345');

    // 2. Natural shorthand: "Chai 20"
    const postRes1 = await apiContext.post('http://localhost:3001/api/webhook/whatsapp', {
      data: { message: 'Chai 20' }
    });
    expect(postRes1.status()).toBe(200);
    const body1 = await postRes1.json();
    expect(body1.success).toBe(true);
    expect(body1.type).toBe('expense_logged');
    expect(body1.transaction.amount).toBe(20);
    expect(body1.parsed.category).toBe('Food & Dining');
    expect(body1.replyText).toContain('Expense Logged Successfully');

    // 3. Natural shorthand with card: "Lunch 150 card"
    const postRes2 = await apiContext.post('http://localhost:3001/api/webhook/whatsapp', {
      data: { message: 'Lunch 150 card' }
    });
    expect(postRes2.status()).toBe(200);
    const body2 = await postRes2.json();
    expect(body2.success).toBe(true);
    expect(body2.transaction.amount).toBe(150);
    expect(body2.parsed.paymentMode).toBe('Card');

    // 4. Bank SMS debit alert: HDFC Zomato
    const postRes3 = await apiContext.post('http://localhost:3001/api/webhook/whatsapp', {
      data: { message: 'Alert: Rs.450.00 debited from HDFC Bank A/c **1234 on 24-NOV-26 to ZOMATO. Avl bal: Rs.14,250.00.' }
    });
    expect(postRes3.status()).toBe(200);
    const body3 = await postRes3.json();
    expect(body3.success).toBe(true);
    expect(body3.transaction.amount).toBe(450);
    expect(body3.parsed.merchant).toBe('ZOMATO');
    expect(body3.parsed.category).toBe('Food & Dining');

    // 5. Summary command
    const postRes4 = await apiContext.post('http://localhost:3001/api/webhook/whatsapp', {
      data: { message: 'Summary' }
    });
    expect(postRes4.status()).toBe(200);
    const body4 = await postRes4.json();
    expect(body4.success).toBe(true);
    expect(body4.type).toBe('summary');
    expect(body4.replyText).toContain('Monthly Budget Summary');
  });

  test('35.2: Speed Chips 1-Tap Frequent Expense Widget on Overview', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRaj();
    await dismissGreetingIfNeeded(page);

    // Locate Speed Chips strip
    const chipsStrip = page.locator('[data-testid="speed-chips-strip"]');
    await expect(chipsStrip).toBeVisible({ timeout: 10000 });

    // Click "Chai ₹20" chip
    const chaiChip = page.locator('[data-testid="speed-chip-sc_chai"]');
    await expect(chaiChip).toBeVisible();
    await chaiChip.click();

    // Verify toast notification for instant 1-tap log
    const toast = page.locator('text=Logged ☕ Chai');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Open "New Chip" form
    const toggleAddChip = page.locator('[data-testid="toggle-add-speed-chip"]');
    await toggleAddChip.click();

    // Add custom speed chip "Metro" ₹40
    await page.locator('input[placeholder="e.g. Metro"]').fill('Metro');
    await page.locator('input[placeholder="40"]').fill('40');
    await page.locator('[data-testid="save-speed-chip-btn"]').click();

    // Verify custom chip appears and click it
    const metroChip = page.locator('button:has-text("Metro")').first();
    await expect(metroChip).toBeVisible();
    await metroChip.click();
    await expect(page.locator('text=Logged ⚡ Metro')).toBeVisible({ timeout: 5000 });
  });

  test('35.3: WhatsApp Chatbox Assistant In-App Modal (Feature 5)', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRaj();
    await dismissGreetingIfNeeded(page);

    // Click floating WhatsApp button
    const whatsappBtn = page.locator('[data-testid="floating-whatsapp-btn"]');
    await expect(whatsappBtn).toBeVisible({ timeout: 10000 });
    await whatsappBtn.click();

    // Verify WhatsApp modal is open
    const modal = page.locator('[data-testid="whatsapp-chatbox-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=PocketNook Assistant')).toBeVisible();
    await expect(modal.locator('text=online • auto-expense logger')).toBeVisible();

    // Type a natural language expense in chat
    const chatInput = page.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('Coffee 120 upi');
    await page.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    // Verify user bubble appears
    await expect(modal.locator('text=Coffee 120 upi')).toBeVisible();

    // Verify bot response bubble confirms expense
    await expect(modal.locator('text=Expense Logged Successfully')).toBeVisible({ timeout: 6000 });
    await expect(modal.locator('text=₹120')).toBeVisible();

    // Test quick prompt: "📊 Summary"
    const summaryPrompt = page.locator('[data-testid="whatsapp-quick-prompt-summary"]');
    await summaryPrompt.click();
    await expect(modal.locator('text=Monthly Budget Summary')).toBeVisible({ timeout: 6000 });

    // Close modal
    await modal.locator('button[aria-label="Back"], button[title="Close"]').first().click();
    await expect(modal).toHaveCount(0);
  });

  test('35.4: SMS & UPI 1-Tap Smart Parser Modal & AddExpense Inline Parser (Feature 1)', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRaj();
    await dismissGreetingIfNeeded(page);

    // Click "SMS / UPI Parser" button from Smart Automation strip
    const smsParserBtn = page.locator('[data-testid="home-open-sms-parser-btn"], [data-testid="android-open-sms-parser-btn"]').first();
    await expect(smsParserBtn).toBeVisible({ timeout: 10000 });
    await smsParserBtn.click();

    // Verify SMS Parser Modal is open
    const modal = page.locator('[data-testid="sms-parser-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=SMS & UPI 1-Tap Smart Parser')).toBeVisible();

    // Click sample HDFC Zomato notification
    const sampleBtn = modal.locator('button:has-text("HDFC Zomato ₹450")');
    await sampleBtn.click();

    // Verify parsed amount and merchant are populated
    const amtInput = modal.locator('[data-testid="sms-parsed-amount"]');
    await expect(amtInput).toHaveValue('450');
    const merchantInput = modal.locator('[data-testid="sms-parsed-merchant"]');
    await expect(merchantInput).toHaveValue('ZOMATO');

    // Confirm and save expense
    const saveBtn = modal.locator('[data-testid="sms-confirm-save-btn"]');
    await saveBtn.click();
    await expect(modal).toHaveCount(0);

    // Also test inline SMS parser in AddExpenseModal
    const addExpenseBtn = page.locator('button[aria-label="Quick Add Expense"], button:has-text("Add Expense")').first();
    await addExpenseBtn.click();
    await page.waitForTimeout(400);

    const toggleSmsInline = page.locator('[data-testid="toggle-sms-paste"]');
    await expect(toggleSmsInline).toBeVisible();
    await toggleSmsInline.click();

    // Paste natural text "Petrol 250"
    const inlineTextarea = page.locator('[data-testid="sms-modal-inline-textarea"]');
    await inlineTextarea.fill('Petrol 250');
    await page.locator('[data-testid="sms-modal-inline-parse-btn"]').click();

    // Verify inline parsed badge
    await expect(page.locator('[data-testid="sms-parsed-badge"]')).toBeVisible();

    // Close modal
    await page.locator('button[aria-label="Close modal"]').click();
  });

  test('35.5: Recurring Subscriptions Modal & Upcoming Renewal Alerts (Feature 4)', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRaj();
    await dismissGreetingIfNeeded(page);

    // Open Recurring Subscriptions Modal from Smart Automation strip
    const recurringBtn = page.locator('[data-testid="home-open-recurring-modal-btn"], [data-testid="android-open-recurring-modal-btn"]').first();
    await expect(recurringBtn).toBeVisible({ timeout: 10000 });
    await recurringBtn.click();

    // Verify modal content
    const modal = page.locator('[data-testid="recurring-subscriptions-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=Recurring Subscriptions & Bills')).toBeVisible();
    await expect(modal.locator('text=Monthly Burn Rate')).toBeVisible();

    // Close modal
    await modal.locator('button[aria-label="Close Modal"]').click();
    await expect(modal).toHaveCount(0);
  });

  test('35.6: Smart Receipt Scanner & OCR Modal (Feature 7)', async ({ page, authHelpers }) => {
    await authHelpers.loginAsRaj();
    await dismissGreetingIfNeeded(page);

    // Open Receipt Scanner Modal from Smart Automation strip
    const scannerBtn = page.locator('[data-testid="home-open-receipt-scanner-btn"], [data-testid="android-open-receipt-scanner-btn"]').first();
    await expect(scannerBtn).toBeVisible({ timeout: 10000 });
    await scannerBtn.click();

    // Verify modal content
    const modal = page.locator('[data-testid="receipt-scanner-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=Smart Receipt Scanner & OCR')).toBeVisible();
    await expect(modal.locator('[data-testid="receipt-upload-btn"]')).toBeVisible();
    await expect(modal.locator('[data-testid="receipt-camera-btn"]')).toBeVisible();

    // Close modal
    await modal.locator('button[aria-label="Close Modal"]').click();
    await expect(modal).toHaveCount(0);
  });

  test('35.7: Mobile Viewport Validation (< 768px)', async ({ page, authHelpers }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await authHelpers.loginAsRaj();
    await dismissGreetingIfNeeded(page);

    // Verify mobile Speed Chips strip
    const chipsStrip = page.locator('[data-testid="speed-chips-strip"]');
    await expect(chipsStrip).toBeVisible({ timeout: 10000 });

    // Verify mobile WhatsApp quick launcher
    const mobileWhatsapp = page.locator('[data-testid="android-open-whatsapp-btn"]');
    await expect(mobileWhatsapp).toBeVisible();
    await mobileWhatsapp.click();

    // Verify WhatsApp modal appears properly inside mobile viewport
    const modal = page.locator('[data-testid="whatsapp-chatbox-modal"]');
    await expect(modal).toBeVisible();
    await modal.locator('button[aria-label="Back"]').click();
    await expect(modal).toHaveCount(0);
  });
});
