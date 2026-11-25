// @ts-check
const { test, expect } = require('../fixtures/auth.fixture');
const { cleanTestUsers } = require('../helpers/dbHelper');

test.describe('Area 37: Exhaustive Chatbox Matrix (Positive, Negative, Edge & Security) for rajmailtemp@gmail.com', () => {
  test.afterAll(() => {
    cleanTestUsers();
  });

  async function dismissOverlaysIfNeeded(page) {
    try {
      // 1. Dismiss welcome greeting overlay if present
      const greeting = page.locator('[data-testid="welcome-greeting-overlay"], button:has-text("Let\'s Dive In"), button:has-text("Got It"), text=TAP ANYWHERE TO CONTINUE').first();
      if (await greeting.isVisible({ timeout: 2000 }).catch(() => false)) {
        await greeting.click({ force: true }).catch(() => { });
        await page.waitForTimeout(300);
      }

      // 2. Dismiss onboarding tour modal if open
      const tourCloseBtn = page.locator('[data-testid="onboarding-tour-close-btn"], button[aria-label="Close Tour"]').first();
      if (await tourCloseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tourCloseBtn.click({ force: true }).catch(() => { });
        await page.waitForTimeout(300);
      }
    } catch (e) { }
  }

  async function openChatbox(page) {
    await dismissOverlaysIfNeeded(page);
    const fab = page.locator('[data-testid="floating-whatsapp-btn"], [data-testid="android-open-whatsapp-btn"]').first();
    await expect(fab).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);
    await fab.click({ force: true });
    const modal = page.locator('[data-testid="whatsapp-chatbox-modal"]');
    if (!await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fab.click({ force: true });
    }
    await expect(modal).toBeVisible({ timeout: 10000 });
    return modal;
  }

  test.beforeEach(async ({ page, authHelpers }) => {
    await authHelpers.loginAsRajMailTemp();
    await dismissOverlaysIfNeeded(page);
  });

  /* ========================================================
     MODULE 1: POSITIVE CORE SCENARIOS
     ======================================================== */

  test('37.1 [Positive]: Single expense shorthand logging with payment modes', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    const sendBtn = modal.locator('[data-testid="whatsapp-chat-send-btn"]');

    // 1. Shorthand default mode: "Chai 20"
    await chatInput.fill('Chai 20');
    await sendBtn.click();
    await expect(modal.locator('text=Expense Logged Successfully!').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Food & Dining').first()).toBeVisible();

    // 2. Shorthand with explicit payment mode: "Lunch 150 card"
    await chatInput.fill('Lunch 150 card');
    await sendBtn.click();
    await expect(modal.locator('text=Expense Logged Successfully!').nth(1)).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Card').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.2 [Positive]: Multi-item batch expense logging', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('50 chai, 120 lunch, 40 auto');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    // Verify batch logging confirmation
    await expect(modal.locator('text=Batch Expenses Recorded (3 Items)').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Total Batch Amount:').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.3 [Positive]: Income / Refund logging', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('Refund 650 Amazon');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    // Verify refund confirmation
    await expect(modal.locator('text=Income / Refund Logged!').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=+₹650').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.4 [Positive]: Affordability analysis diagnosis', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('Can I afford a 3500 dinner?');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    await expect(modal.locator('text=Affordability Financial Diagnosis').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Planned Purchase').first()).toBeVisible();
    await expect(modal.locator('text=Projected Daily Pace').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.5 [Positive]: Smart bill split calculation & 1-tap share logging', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('Split 1800 between 4 people');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    // 1800 / 4 = ₹450
    await expect(modal.locator('text=Smart Bill Split Calculation').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Each Person Owes').first()).toBeVisible();

    // Verify 1-tap share logging button
    const shareBtn = modal.locator('button:has-text("Log My Share")').first();
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();

    // Should immediately log ₹450
    await expect(modal.locator('text=Expense Logged Successfully!').first()).toBeVisible({ timeout: 10000 });

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.6 [Positive]: Safe daily pace check via chip and text', async ({ page }) => {
    const modal = await openChatbox(page);

    // Quick prompt chip
    const paceChip = modal.locator('[data-testid="whatsapp-quick-prompt-daily-pace"]').first();
    await paceChip.click();

    await expect(modal.locator('text=Safe Daily Burn Rate').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Safe Target:').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.7 [Positive]: Spending breakdown and category analysis', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');

    // 1. General Breakdown
    await chatInput.fill('Where is my money going?');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();
    await expect(modal.locator('text=Top Spending Categories').or(modal.locator('text=haven\'t recorded any category expenses')).first()).toBeVisible({ timeout: 10000 });

    // 2. Specific Food & Dining Analysis
    await chatInput.fill('Food spend');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();
    await expect(modal.locator('text=Food & Dining Spending Analysis').first()).toBeVisible({ timeout: 10000 });

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.8 [Positive]: Recent transactions inspection & Undo execution', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');

    // Add an expense to undo
    await chatInput.fill('Coffee 120');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();
    await expect(modal.locator('text=Expense Logged Successfully!').first()).toBeVisible({ timeout: 10000 });

    // Inspect history
    await chatInput.fill('Recent expenses');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();
    await expect(modal.locator('text=Recent Spending History').first()).toBeVisible({ timeout: 10000 });

    // Execute Undo
    await chatInput.fill('Undo');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();
    await expect(modal.locator('text=Transaction Undone & Removed!').first()).toBeVisible({ timeout: 10000 });

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.9 [Positive]: 50/30/20 Rule framework reasoning', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('Explain 50/30/20 rule for my budget');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    await expect(modal.locator('text=The 50/30/20 Financial Framework').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=50% Needs').first()).toBeVisible();
    await expect(modal.locator('text=30% Wants').first()).toBeVisible();
    await expect(modal.locator('text=20% Savings').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.10 [Positive]: Emergency reserve fund architecture', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('How much emergency fund do I need?');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    await expect(modal.locator('text=Emergency Reserve Architecture').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=3-Month Baseline Cushion').first()).toBeVisible();
    await expect(modal.locator('text=6-Month Fortress Cushion').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.11 [Positive]: Debt payoff acceleration blueprint (Avalanche vs Snowball)', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('How to pay off credit card debt?');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    await expect(modal.locator('text=Debt Acceleration Blueprint').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Debt Avalanche').first()).toBeVisible();
    await expect(modal.locator('text=Debt Snowball').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.12 [Positive]: Bilingual Hinglish savings guidance', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('Paisa kaise bachaye?');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    await expect(modal.locator('text=Smart Savings Plan (पैसे बचाने का आसान तरीका)').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Pay Yourself First').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.13 [Positive]: Category spending reduction optimization', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('How to cut down food spending?');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    await expect(modal.locator('text=Food & Dining Optimization Plan').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Cap Food Delivery to 1x/Week').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.14 [Positive]: Future goal planning and purchase feasibility', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('Save for 30000 laptop in 5 months');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    await expect(modal.locator('text=Goal Feasibility & Savings Roadmap').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Required Monthly Savings:').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.15 [Positive]: Open-ended smart financial diagnosis', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('Tips to manage monthly salary better');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    await expect(modal.locator('text=Personalized Financial Coaching').or(modal.locator('text=PocketNook Financial Intelligence Diagnosis')).first()).toBeVisible({ timeout: 10000 });

    await modal.locator('button[aria-label="Back"]').click();
  });

  /* ========================================================
     MODULE 2: NEGATIVE SCENARIOS
     ======================================================== */

  test('37.16 [Negative]: Whitespace-only message submission', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    const sendBtn = modal.locator('[data-testid="whatsapp-chat-send-btn"]');

    // Fill only whitespace
    await chatInput.fill('    ');

    // Verify send button is disabled when empty or whitespace
    expect(await sendBtn.isDisabled()).toBe(true);

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.17 [Negative]: Invalid or zero headcount in bill split', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('Split 1500 between 0 people');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    // Verify graceful error response
    await expect(modal.locator('text=The number of people must be at least 1.').first()).toBeVisible({ timeout: 10000 });

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.18 [Negative]: Incomplete prompts without amounts', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');

    // 1. Affordability without amount
    await chatInput.fill('Can I afford?');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();
    await expect(modal.locator('text=Please specify the amount you want to spend.').first()).toBeVisible({ timeout: 10000 });

    // 2. Bill split without amount
    await chatInput.fill('Split the bill');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();
    await expect(modal.locator('text=To split a bill, please specify').or(modal.locator('text=Calculate bill split')).first()).toBeVisible({ timeout: 10000 });

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.19 [Negative]: Non-financial gibberish input handled gracefully', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('zxkjhfdskjfh843759!@#');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    // Verify polite helpful guidance instead of crash or error
    await expect(modal.locator('text=I couldn\'t recognize an expense or command in that message').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=50/30/20 rule').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  /* ========================================================
     MODULE 3: EDGE & SECURITY SCENARIOS
     ======================================================== */

  test('37.20 [Security & PII]: Bank SMS alert masks card/UTR/phone on-device while preserving safe A/c last-4', async ({ page }) => {
    const modal = await openChatbox(page);

    // Verify honest privacy notice badge
    await expect(modal.locator('text=Sensitive numbers are masked before processing').first()).toBeVisible();

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    const sensitiveSms = 'Alert: Rs.850.00 debited from HDFC Bank A/c **4912 on 25-NOV-26 to SWIGGY. Card ending 4412. UTR: 2948104819. Avl bal: Rs.14,250.00. Help: 9876543210.';
    await chatInput.fill(sensitiveSms);
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    // Verify expense logged safely
    await expect(modal.locator('text=Expense Logged Successfully!').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=SWIGGY').first()).toBeVisible();

    // Verify sensitive tokens are masked in stored user bubble too (not cosmetic)
    const userText = await modal.locator('[data-testid="whatsapp-bubble-user"]').last().innerText();
    expect(userText).not.toContain('4412');
    expect(userText).not.toContain('2948104819');
    expect(userText).not.toContain('9876543210');
    expect(userText).toContain('**4912');

    // Verify sensitive card, UTR, and phone are NOT reflected in bot text
    const botText = await modal.locator('[data-testid="whatsapp-bubble-bot"]').last().innerText();
    expect(botText).not.toContain('4412');
    expect(botText).not.toContain('2948104819');
    expect(botText).not.toContain('9876543210');

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.21 [Security & Edge]: HTML / Script injection (XSS resistance)', async ({ page }) => {
    const modal = await openChatbox(page);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    // Payload with HTML tags
    await chatInput.fill('<script>window.__xss_flag = true;</script> Chai <b>45</b>');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    await expect(modal.locator('text=PocketNook Financial Intelligence Diagnosis').or(modal.locator('text=I\'m here to help with your finances:')).or(modal.locator('text=Expense Logged Successfully!')).first()).toBeVisible({ timeout: 10000 });

    // Verify no script executed
    const xssFlag = await page.evaluate(() => window['__xss_flag']);
    expect(xssFlag).toBeUndefined();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.22 [Edge]: Long string payload boundary resilience (> 500 characters)', async ({ page }) => {
    const modal = await openChatbox(page);

    const longText = 'Spending advice for '.repeat(35) + 'my future planning?';
    expect(longText.length).toBeGreaterThan(600);

    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill(longText);
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    // Verify handled smoothly without crash
    await expect(modal.locator('text=PocketNook Financial Intelligence Diagnosis').or(modal.locator('text=Personalized Financial Coaching')).first()).toBeVisible({ timeout: 10000 });

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.23 [UI/UX & Lifecycle]: Chat history persistence, clear history, and backdrop animation', async ({ page }) => {
    const modal = await openChatbox(page);

    // 1. Send unique message
    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    await chatInput.fill('Session persistence check 999');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();
    await expect(modal.locator('text=Session persistence check 999').first()).toBeVisible({ timeout: 10000 });

    // 2. Dismiss modal via top backdrop click
    await modal.click({ position: { x: 20, y: 20 } });
    await expect(modal).not.toBeVisible({ timeout: 3000 });

    // 3. Re-open modal via FAB and verify message persisted
    const fab = page.locator('[data-testid="floating-whatsapp-btn"], [data-testid="android-open-whatsapp-btn"]').first();
    await fab.click({ force: true });
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=Session persistence check 999').first()).toBeVisible();

    // 4. Clear chat history via trash button
    const clearBtn = modal.locator('[data-testid="copilot-clear-chat-btn"], button[title*="Clear"]').first();
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Verify messages reset to cleared notice
    await expect(modal.locator('text=Session persistence check 999')).not.toBeVisible();
    await expect(modal.locator('text=Chat history cleared!').or(modal.locator('text=PocketNook Chat Active')).first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  /* ========================================================
     MODULE 4: P0 & P1 REVIEW FIX VERIFICATION MATRIX
     ======================================================== */

  test('37.24 [P0 Parser]: Indian comma amounts, k/lakh, relative dates, and Hinglish expenses', async ({ page }) => {
    const modal = await openChatbox(page);
    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    const sendBtn = modal.locator('[data-testid="whatsapp-chat-send-btn"]');

    // 1. Multi-item with Indian comma amount ("1,XXX lunch" must NOT split at the comma; unique amounts prevent duplicate-guard skip across runs)
    const tick = Math.floor(Date.now() / 1000);
    const chaiAmt = 51 + (tick % 17);
    const lunchAmt = 1201 + (tick % 697);
    const autoAmt = 41 + ((tick >> 2) % 17);
    const hinglishAmt = 31 + ((tick >> 3) % 17);
    const lunchFormatted = lunchAmt.toLocaleString('en-IN');
    const batchTotalFormatted = (chaiAmt + lunchAmt + autoAmt).toLocaleString('en-IN');
    await chatInput.fill(`${chaiAmt} poha, ${lunchFormatted} thali, ${autoAmt} rickshaw`);
    await sendBtn.click();
    await expect(modal.locator('text=Batch Expenses Recorded (3 Items)').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator(`text=₹${batchTotalFormatted}`).first()).toBeVisible();

    // 2. Hinglish expense shorthand ("chai pe XX kharch kiya")
    await chatInput.fill(`chai pe ${hinglishAmt} kharch kiya`);
    await sendBtn.click();
    await expect(modal.locator('text=Expense Logged Successfully!').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator(`text=₹${hinglishAmt}`).first()).toBeVisible();

    // 3. Relative date + suffix currency + k notation ("Uber 1.5k yesterday")
    await chatInput.fill('Uber 1.5k yesterday');
    await sendBtn.click();
    await expect(modal.locator('text=₹1,500').first()).toBeVisible({ timeout: 10000 });

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.25 [P0 Split & Idempotency]: Remainder rounding, friends phrasing, and double-tap protection', async ({ page }) => {
    const modal = await openChatbox(page);
    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    const sendBtn = modal.locator('[data-testid="whatsapp-chat-send-btn"]');

    // 1. Remainder-preserving split: Divide 2500 by 3 -> 1 x ₹834 + 2 x ₹833
    await chatInput.fill('Divide 2500 by 3');
    await sendBtn.click();
    await expect(modal.locator('text=Smart Bill Split Calculation').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=₹834').first()).toBeVisible();
    await expect(modal.locator('text=₹833').first()).toBeVisible();

    // 2. Friends phrasing note & idempotent 1-tap share button
    await chatInput.fill('Split 1,800 with 4 friends');
    await sendBtn.click();
    await expect(modal.locator('button:has-text("Split 5 Ways (Incl. You)")').first()).toBeVisible({ timeout: 10000 });

    const shareBtn = modal.locator('[data-testid="log-my-share-btn"]').last();
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();

    // Button transitions to idempotent "Logged ✓ · Undo"
    await expect(modal.locator('[data-testid="logged-undo-btn"]').first()).toBeVisible({ timeout: 10000 });

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.26 [P0 Affordability]: Continuous 75%-100% Tight Squeeze bracket coverage', async ({ page }) => {
    const modal = await openChatbox(page);
    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');

    // Query Summary inside chat to read exact live Remaining Balance before 75%-100% check
    await chatInput.fill('Summary');
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();
    await expect(modal.locator('text=Monthly Budget Summary').first()).toBeVisible({ timeout: 10000 });
    const summaryText = await modal.locator('[data-testid="whatsapp-bubble-bot"]').last().innerText();
    const remMatch = summaryText.match(/Remaining Balance:\s*₹([0-9,]+)/i);
    const numericRem = remMatch ? Number(remMatch[1].replace(/,/g, '')) : 12000;
    const target85 = Math.max(100, Math.round(numericRem * 0.85));

    await chatInput.fill(`Can I afford ${target85}?`);
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();

    await expect(modal.locator('text=Affordability Financial Diagnosis').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('text=Tight Squeeze (75%–100% of Free Pool)').first()).toBeVisible();

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.27 [P0 Confidence & Duplicate]: Quantity ambiguity confirmation & duplicate SMS guard', async ({ page }) => {
    const modal = await openChatbox(page);
    const chatInput = modal.locator('[data-testid="whatsapp-chat-input"]');
    const sendBtn = modal.locator('[data-testid="whatsapp-chat-send-btn"]');

    // 1. Ambiguous quantity + price: "2 chai 40" -> must NOT silently log; shows Confirm card
    await chatInput.fill('2 chai 40');
    await sendBtn.click();
    await expect(modal.locator('text=Confirm Quick Expense').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('button:has-text("Total ₹40")').first()).toBeVisible();

    // 2. Duplicate detection: Log "Snacks 75", then send "Snacks 75" again
    await chatInput.fill('Snacks 75');
    await sendBtn.click();
    await expect(modal.locator('text=Expense Logged Successfully!').first()).toBeVisible({ timeout: 10000 });

    await chatInput.fill('Snacks 75');
    await sendBtn.click();
    await expect(modal.locator('text=Possible Duplicate Detected').first()).toBeVisible({ timeout: 10000 });

    await modal.locator('button[aria-label="Back"]').click();
  });

  test('37.28 [P1 UX & Storage]: Onboarding pills, inline edit + category learning, IndexedDB & 50k cap', async ({ page }) => {
    const modal = await openChatbox(page);

    // 1. Onboarding tappable example pill on initial welcome card
    const exampleBtn = modal.locator('[data-testid="onboarding-example-ex_chai"]').first();
    await expect(exampleBtn).toBeVisible();
    await exampleBtn.click();
    await expect(modal.locator('text=Expense Logged Successfully!').first()).toBeVisible({ timeout: 10000 });

    // 2. Inline Edit + Merchant Category Learning
    const editBtn = modal.locator('button:has-text("Edit Details")').first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();
    await modal.locator('[data-testid="inline-edit-category"]').selectOption('Entertainment');
    await modal.locator('[data-testid="inline-edit-save-btn"]').click();
    await expect(modal.locator('text=Learned:').first()).toBeVisible({ timeout: 10000 });

    // 3. Verify plaintext legacy localStorage chat key is NOT used
    const legacyRaw = await page.evaluate(() => localStorage.getItem('expense_tracker_whatsapp_chat'));
    expect(legacyRaw).toBeNull();

    // 4. 50,000-char large paste boundary resilience (no UI freeze)
    const hugePaste = 'Spending advice budget '.repeat(2200);
    expect(hugePaste.length).toBeGreaterThan(45000);
    await modal.locator('[data-testid="whatsapp-chat-input"]').fill(hugePaste);
    await modal.locator('[data-testid="whatsapp-chat-send-btn"]').click();
    await expect(modal.locator('text=Input was capped at').first()).toBeVisible({ timeout: 10000 });

    await modal.locator('button[aria-label="Back"]').click();
  });
});
