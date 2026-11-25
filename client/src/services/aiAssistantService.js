/**
 * aiAssistantService.js
 * PocketNook Autonomous AI Financial Copilot Engine
 * 
 * 100% Zero-Leakage & Privacy-First:
 * - Operates directly on-device using sanitized financial vectors.
 * - Powered by deterministic NLP, financial pace algorithms, and heuristic reasoning.
 * - Hybrid Cloud AI Proxy: Seamlessly enhances responses via secure backend LLM proxy when available.
 * - Fully bilingual: understands English, Hindi keywords, and natural conversational Hinglish.
 */

import { parseSmsNotification, CATEGORY_KEYWORDS } from './smsParserService.js';
import { sanitizeFinancialText, prepareSafeFinancialSnapshot } from './piiSanitizerService.js';
import { askCopilotAI } from './api.js';

/**
 * Main query dispatcher for the PocketNook Copilot
 * 
 * @param {string} rawInput - The user's input message
 * @param {Object} context - Financial state & helper handlers
 * @returns {Promise<Object>} Formatted response object with reply text, actions, and metadata
 */
export async function processAssistantMessage(rawInput = '', context = {}) {
  const { sanitizedText } = sanitizeFinancialText(rawInput.trim());
  const text = sanitizedText;
  const lower = text.toLowerCase().trim();

  const {
    dashboardData = {},
    recentTransactions = [],
    formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
    onSaveExpense = null,
    onDeleteExpense = null
  } = context;

  const snapshot = prepareSafeFinancialSnapshot({ dashboardData, recentTransactions });

  // 1. GREETING & COPILOT IDENTITY
  if (isGreetingOrIdentity(lower)) {
    return handleGreetingResponse(snapshot, formatCurrency);
  }

  // 2. UNDO / DELETE LAST EXPENSE
  if (isUndoIntent(lower)) {
    return handleUndoIntent(snapshot, formatCurrency, onDeleteExpense);
  }

  // 3. BILL SPLITTING CALCULATOR
  if (isBillSplitIntent(lower)) {
    return handleBillSplitIntent(text, lower, formatCurrency);
  }

  // 4. AFFORDABILITY ANALYSIS ("Can I afford X?")
  if (isAffordabilityIntent(lower)) {
    return handleAffordabilityIntent(lower, snapshot, formatCurrency);
  }

  // 5. DAILY PACE & BURN RATE QUERY
  if (isPaceOrBurnRateIntent(lower)) {
    return handlePaceIntent(snapshot, formatCurrency);
  }

  // 6. CATEGORY SPENDING BREAKDOWN & INQUIRY
  if (isCategoryBreakdownIntent(lower)) {
    return handleCategoryQuery(lower, snapshot, formatCurrency);
  }

  // 7. RECENT TRANSACTIONS / HISTORY INSPECTION
  if (isRecentHistoryIntent(lower)) {
    return handleRecentHistory(snapshot, formatCurrency);
  }

  // 8. 50/30/20 BUDGET FRAMEWORK
  if (isRule503020Intent(lower)) {
    return handle503020Rule(snapshot, formatCurrency);
  }

  // 9. EMERGENCY FUND CALCULATOR & STRATEGY
  if (isEmergencyFundIntent(lower)) {
    return handleEmergencyFund(snapshot, formatCurrency);
  }

  // 10. DEBT PAYOFF STRATEGY (Avalanche vs. Snowball)
  if (isDebtPayoffIntent(lower)) {
    return handleDebtPayoff(snapshot, formatCurrency);
  }

  // 11. OVER-BUDGET & DEFICIT TRIAGE
  if (isOverbudgetIntent(lower, snapshot)) {
    return handleOverbudgetRecovery(snapshot, formatCurrency);
  }

  // 12. CATEGORY-SPECIFIC REDUCTION PLANS (Dining, Shopping, Utilities)
  if (isCategoryOptimizationIntent(lower)) {
    return handleCategoryOptimization(lower, snapshot, formatCurrency);
  }

  // 13. FUTURE GOAL & PURCHASE PLANNING ("Can I save for X in Y months?")
  if (isGoalPlanningIntent(lower)) {
    return handleGoalPlanning(text, lower, snapshot, formatCurrency);
  }

  // 14. BILINGUAL / HINGLISH SAVINGS & EXPENSE CONTROL
  if (isBilingualSavingsIntent(lower)) {
    return handleBilingualSavingsAdvice(snapshot, formatCurrency);
  }

  // 15. INVESTMENT & WEALTH HYGIENE
  if (isInvestmentOrWealthIntent(lower)) {
    return handleInvestmentAdvice(snapshot, formatCurrency);
  }

  // 16. SAVINGS TIPS & GENERAL FINANCIAL COACHING
  if (isSavingAdviceIntent(lower)) {
    return handleSavingAdvice(snapshot, formatCurrency);
  }

  // 17. BUDGET SUMMARY (Overview)
  if (isSummaryIntent(lower)) {
    return handleSummary(snapshot, formatCurrency);
  }

  // 18. MULTI-ITEM BATCH EXPENSE LOGGING (e.g., "50 chai, 120 lunch, 40 auto")
  const multiItems = extractMultiItemExpenses(text);
  if (multiItems.length > 1) {
    return handleMultiItemLogging(multiItems, snapshot, formatCurrency, onSaveExpense);
  }

  // 19. SINGLE EXPENSE / INCOME LOGGING (via SMS parser)
  const parsed = parseSmsNotification(text);
  if (parsed.success && parsed.amount > 0) {
    return handleSingleExpenseLogging(parsed, snapshot, formatCurrency, onSaveExpense);
  }

  // 20. HYBRID EXTERNAL AI MODEL DISPATCH (Secure, Zero-Leakage Proxy)
  try {
    const aiRes = await Promise.race([
      askCopilotAI(text, snapshot),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 4000))
    ]);

    if (aiRes && aiRes.success && aiRes.replyText) {
      return {
        replyText: aiRes.replyText,
        type: 'ai_copilot_response',
        model: aiRes.model || 'gemini-2.5-flash',
        suggestedChips: ['Summary', 'Daily Pace', '50/30/20 Rule', 'Saving Tips']
      };
    }
  } catch (e) {
    // Graceful offline fallback to on-device financial intelligence brain
  }

  // 21. ON-DEVICE SMART FINANCIAL SYNTHESIZER
  if (isGeneralFinancialQuestion(lower)) {
    return handleSmartFinancialAdvisory(text, snapshot, formatCurrency);
  }

  // 22. POLITE GUIDANCE ROADMAP
  return handleFallbackResponse(text, snapshot, formatCurrency);
}

/* ========================================================
   INTENT CLASSIFIERS
   ======================================================== */

function isGreetingOrIdentity(lower) {
  return /^(?:hi|hello|hey|namaste|hola|good\s*(?:morning|afternoon|evening)|who\s*are\s*you|what\s*can\s*you\s*do|help|bhai)\b/i.test(lower);
}

function isUndoIntent(lower) {
  return /\b(?:undo|delete\s*last|cancel\s*last|remove\s*last|pichla\s*hatao|delete\s*karo)\b/i.test(lower);
}

function isBillSplitIntent(lower) {
  return /\b(?:split|divide|hissa|share|doston\s*me)\b/i.test(lower) && /\d+/.test(lower);
}

function isAffordabilityIntent(lower) {
  return /\b(?:can\s*i\s*afford|should\s*i\s*buy|khareed\s*sakta|le\s*sakta|kya\s*mai|afford\s*kar)\b/i.test(lower) ||
         (/\b(?:afford|budget\s*hai)\b/i.test(lower) && /\d+/.test(lower));
}

function isPaceOrBurnRateIntent(lower) {
  return /\b(?:burn\s*rate|daily\s*pace|daily\s*budget|per\s*day|aaj\s*ka\s*budget|pace|kitna\s*kharch\s*kar\s*sakta)\b/i.test(lower);
}

function isCategoryBreakdownIntent(lower) {
  return /\b(?:category|categories|breakdown|where\s*(?:did|is)\s*(?:all\s*)?my\s*money|where.*money.*going|kahan\s*kharcha|food\s*spend|travel\s*spend|grocery|shopping)\b/i.test(lower) &&
         !/\b(?:chai\s*\d|\d+\s*chai|spent\s*\d)\b/i.test(lower);
}

function isRecentHistoryIntent(lower) {
  return /\b(?:last\s*\d*\s*expenses|recent\s*(?:expenses|transactions|activity)|pichla\s*kharcha|history)\b/i.test(lower);
}

function isRule503020Intent(lower) {
  return /\b(?:50[\s/-]?30[\s/-]?20|fifty\s*thirty\s*twenty|rule\s*of\s*thumb|budget\s*rule|how\s*to\s*allocate|allocation\s*rule)\b/i.test(lower);
}

function isEmergencyFundIntent(lower) {
  return /\b(?:emergency\s*fund|rainy\s*day\s*fund|aapatkaalin|safety\s*cushion|emergency\s*savings|how\s*much\s*emergency)\b/i.test(lower);
}

function isDebtPayoffIntent(lower) {
  return /\b(?:debt|loan|credit\s*card|avalanche|snowball|karz|udhari|pay\s*off|emi|interest\s*rate)\b/i.test(lower);
}

function isOverbudgetIntent(lower, snapshot) {
  return /\b(?:over\s*budget|exceeded|deficit|kharcha\s*zyada|budget\s*khatam|spent\s*too\s*much|overspent)\b/i.test(lower) ||
         (snapshot.remainingBudget < 0 && /\b(?:status|how\s*am\s*i\s*doing|kaisa\s*chal\s*raha)\b/i.test(lower));
}

function isCategoryOptimizationIntent(lower) {
  return /\b(?:cut\s*down|reduce|save\s*on|spend\s*less)\b/i.test(lower) &&
         /\b(?:food|dining|grocery|shopping|clothes|delivery|zomato|swiggy|uber|ola|subscription|bills)\b/i.test(lower);
}

function isGoalPlanningIntent(lower) {
  return /\b(?:save\s*for|plan\s*to\s*buy|saving\s*target|goal|kharidna\s*hai|phone\s*kharidna|laptop\s*kharidna)\b/i.test(lower) && /\d+/.test(lower);
}

function isBilingualSavingsIntent(lower) {
  return /\b(?:paisa\s*kaise\s*bachaye|kharch\s*kaise\s*kam|bachat\s*kaise|paisa\s*bachao|salary\s*kaise\s*manage|paise\s*bachane)\b/i.test(lower);
}

function isInvestmentOrWealthIntent(lower) {
  return /\b(?:invest|investment|stocks|mutual\s*fund|sip|fd|fixed\s*deposit|gold|save\s*vs\s*invest|wealth\s*building)\b/i.test(lower);
}

function isSavingAdviceIntent(lower) {
  return /\b(?:how\s*to\s*save|saving\s*tips|advice|tips|save\s*money|budget\s*plan|spending\s*advice)\b/i.test(lower);
}

function isSummaryIntent(lower) {
  return /\b(?:summary|balance|overview|budget|status|kitna\s*(?:paisa|kharcha)?\s*bacha)\b/i.test(lower);
}

function isGeneralFinancialQuestion(lower) {
  return /\b(?:money|finance|budget|spend|expense|salary|savings|bank|credit|cash|fund|earn|plan|target|cost|pocket|rupee|invest|future)\b/i.test(lower);
}

/* ========================================================
   CONVERSATIONAL & FINANCIAL ENGINE HANDLERS
   ======================================================== */

function handleGreetingResponse(snapshot, formatCurrency) {
  const replyText = 
    `*PocketNook Copilot Active*\n\n` +
    `Your private, on-device financial intelligence engine. Here is what I can do for you:\n\n` +
    `• *Instant Logging:* \`Chai 20\` or \`Lunch 150 card\`\n` +
    `• *Multi-Item Batch:* \`50 chai, 120 lunch, 40 auto\`\n` +
    `• *Affordability Diagnosis:* \`Can I afford a 3500 dinner?\`\n` +
    `• *Smart Bill Split:* \`Split 2400 between 5 people\`\n` +
    `• *Deep Analytics:* \`Where is my money going?\` or \`Food spend\`\n` +
    `• *50/30/20 Plan:* \`Explain 50/30/20 rule for my budget\`\n` +
    `• *Safe Daily Pace:* \`What is my safe daily pace?\`\n` +
    `• *Quick Undo:* Send \`Undo\` to remove the last entry.\n\n` +
    `*Financial Status:* You have *${formatCurrency(snapshot.remainingBudget)}* safe pool remaining this month (*${formatCurrency(snapshot.safeDailyPace)}/day*).`;

  return {
    replyText,
    type: 'greeting',
    suggestedChips: ['Summary', 'Daily Pace', '50/30/20 Rule', 'Emergency Fund'],
    actionButtons: [
      { label: 'Check Budget', query: 'Summary' },
      { label: 'Daily Pace', query: 'Daily Pace' }
    ]
  };
}

function handleUndoIntent(snapshot, formatCurrency, onDeleteExpense) {
  const lastTx = snapshot.safeTransactions[0];
  if (!lastTx) {
    return {
      replyText: `No recent transactions found in this billing cycle to undo.`,
      type: 'undo_failed'
    };
  }

  if (typeof onDeleteExpense === 'function') {
    onDeleteExpense(lastTx.id);
  }

  const replyText =
    `*Transaction Undone & Removed!*\n` +
    `*Removed:* ₹${lastTx.amount} for *${lastTx.merchant}* (${lastTx.category})\n` +
    `*Payment Mode:* ${lastTx.paymentMode}\n\n` +
    `Updated remaining balance is *${formatCurrency(snapshot.remainingBudget + lastTx.amount)}*.`;

  return {
    replyText,
    type: 'undo_success',
    undoneTransaction: lastTx
  };
}

function handleBillSplitIntent(text, lower, formatCurrency) {
  const numbers = text.match(/\d+(?:[.,]\d+)?/g) || [];
  if (numbers.length < 2) {
    return {
      replyText: `To split a bill, please specify the total amount and number of people.\n\n*Example:* \`Split 2400 between 6 people\``,
      type: 'split_error'
    };
  }

  const nums = numbers.map(n => parseFloat(n.replace(/,/g, '')));
  const totalBill = Math.max(...nums);
  const peopleCount = Math.min(...nums);

  if (peopleCount <= 0) {
    return {
      replyText: `The number of people must be at least 1.`,
      type: 'split_error'
    };
  }

  const perPerson = Math.round((totalBill / peopleCount) * 100) / 100;

  const replyText =
    `*Smart Bill Split Calculation*\n` +
    `*Total Bill:* ${formatCurrency(totalBill)}\n` +
    `*Split Between:* ${peopleCount} people\n` +
    `*Each Person Owes:* *${formatCurrency(perPerson)}*\n\n` +
    `Want me to log your share? Reply \`Lunch ${Math.round(perPerson)} upi\` to record it immediately.`;

  return {
    replyText,
    type: 'split_bill',
    data: { totalBill, peopleCount, perPerson },
    suggestedChips: [`Log Share ${Math.round(perPerson)}`, 'Summary'],
    actionButtons: [
      { label: `Log My Share (${formatCurrency(perPerson)})`, query: `Dinner ${Math.round(perPerson)} upi` },
      { label: 'Check Budget', query: 'Summary' }
    ]
  };
}

function handleAffordabilityIntent(lower, snapshot, formatCurrency) {
  const matches = lower.match(/\d+(?:[.,]\d+)?/g) || [];
  if (matches.length === 0) {
    return {
      replyText: `Please specify the amount you want to spend.\n\n*Example:* \`Can I afford a 4500 smartwatch?\``,
      type: 'affordability_error'
    };
  }

  const plannedAmount = parseFloat(matches[0].replace(/,/g, ''));
  const remaining = snapshot.remainingBudget;
  const days = snapshot.daysRemaining;
  const currentPace = snapshot.safeDailyPace;

  const newRemaining = remaining - plannedAmount;
  const newPace = days > 0 ? Math.round(newRemaining / days) : 0;

  let advice = '';

  if (newRemaining < 0) {
    advice = 
      `*Verdict: Budget Risk Detected.*\n` +
      `Spending ${formatCurrency(plannedAmount)} will push you *${formatCurrency(Math.abs(newRemaining))} over budget* with ${days} days remaining in November. ` +
      `Recommendation: Hold off until next month or reallocate from another category.`;
  } else if (newPace < currentPace * 0.45) {
    advice = 
      `*Verdict: Tight Squeeze.*\n` +
      `You can technically afford it, but your safe daily spending will shrink from *${formatCurrency(currentPace)}/day* down to *${formatCurrency(newPace)}/day* for the next ${days} days. ` +
      `Recommendation: Keep dining and discretionary shopping minimal for the rest of the month.`;
  } else {
    advice = 
      `*Verdict: Comfortably Affordable!*\n` +
      `After spending ${formatCurrency(plannedAmount)}, you will still have *${formatCurrency(newRemaining)}* left in your safe pool (*${formatCurrency(newPace)}/day* for ${days} days).`;
  }

  const replyText =
    `*Affordability Financial Diagnosis*\n` +
    `*Planned Purchase:* ${formatCurrency(plannedAmount)}\n` +
    `*Current Remaining:* ${formatCurrency(remaining)} (${days} days left)\n` +
    `*Current Daily Pace:* ${formatCurrency(currentPace)}/day\n` +
    `*Projected Daily Pace:* ${formatCurrency(newPace)}/day\n\n` +
    `${advice}`;

  return {
    replyText,
    type: 'affordability_analysis',
    data: { plannedAmount, remaining, newRemaining, newPace },
    actionButtons: [
      { label: 'Daily Pace', query: 'Daily Pace' },
      { label: 'Summary', query: 'Summary' }
    ]
  };
}

function handlePaceIntent(snapshot, formatCurrency) {
  const { remainingBudget, safeDailyPace, daysRemaining, todaySpent } = snapshot;

  const isTodayPaceHealthy = todaySpent <= safeDailyPace;
  const replyText =
    `*Safe Daily Burn Rate*\n` +
    `*Safe Target:* *${formatCurrency(safeDailyPace)}/day*\n` +
    `*Days Left in Month:* ${daysRemaining} days\n` +
    `*Remaining Pool:* ${formatCurrency(remainingBudget)}\n` +
    `*Spent Today:* ${formatCurrency(todaySpent)}\n\n` +
    (isTodayPaceHealthy
      ? `*Status:* On Track — You are ${formatCurrency(safeDailyPace - todaySpent)} below your safe daily cap today.`
      : `*Status:* High Velocity — You have spent ${formatCurrency(todaySpent - safeDailyPace)} above today's target pace. Consider keeping tomorrow's spend minimal.`);

  return {
    replyText,
    type: 'daily_pace',
    suggestedChips: ['Summary', 'Food Spend', 'Tips'],
    actionButtons: [
      { label: 'Saving Tips', query: 'Saving Tips' },
      { label: 'Summary', query: 'Summary' }
    ]
  };
}

function handle503020Rule(snapshot, formatCurrency) {
  const budget = snapshot.budget || 30000;
  const needs = Math.round(budget * 0.50);
  const wants = Math.round(budget * 0.30);
  const savings = Math.round(budget * 0.20);
  const totalSpent = snapshot.totalSpent;
  const spendLimit = needs + wants;

  const replyText =
    `*The 50/30/20 Financial Framework*\n` +
    `Calibrated to your monthly baseline of *${formatCurrency(budget)}*:\n\n` +
    `• *50% Needs (${formatCurrency(needs)}):* Essential groceries, rent, utilities, medicines, basic transit.\n` +
    `• *30% Wants (${formatCurrency(wants)}):* Dining out, cafes, OTT subscriptions, shopping, hobbies.\n` +
    `• *20% Savings (${formatCurrency(savings)}):* Emergency fund, SIPs, debt acceleration, future goals.\n\n` +
    `*Current Status:* You have spent *${formatCurrency(totalSpent)}* so far this month. ` +
    (totalSpent > spendLimit
      ? `You are past the recommended 80% spending ceiling (${formatCurrency(spendLimit)}). Restrict further spends to essential needs only.`
      : `You are within the ${formatCurrency(spendLimit)} operational limit with *${formatCurrency(spendLimit - totalSpent)}* buffer before tapping savings.`);

  return {
    replyText,
    type: 'budget_framework',
    suggestedChips: ['Summary', 'Daily Pace', 'Emergency Fund', 'Tips']
  };
}

function handleEmergencyFund(snapshot, formatCurrency) {
  const monthlyBurn = snapshot.totalSpent > 0 ? snapshot.totalSpent : Math.round(snapshot.budget * 0.8) || 20000;
  const fund3Month = monthlyBurn * 3;
  const fund6Month = monthlyBurn * 6;

  const replyText =
    `*Emergency Reserve Architecture*\n` +
    `Based on your current spending rate of ~*${formatCurrency(monthlyBurn)}/month*:\n\n` +
    `• *3-Month Baseline Cushion:* *${formatCurrency(fund3Month)}* (Covers sudden medical or job transition)\n` +
    `• *6-Month Fortress Cushion:* *${formatCurrency(fund6Month)}* (Complete multi-month economic resilience)\n\n` +
    `*Strategic Placement:*\n` +
    `1. Keep 1 month in a high-interest liquid savings account with instant UPI access.\n` +
    `2. Keep the remaining 2–5 months in sweep-in FDs or liquid overnight funds with zero exit loads.\n` +
    `3. Never lock emergency cash in volatile equities or locking schemes.`;

  return {
    replyText,
    type: 'emergency_fund',
    suggestedChips: ['50/30/20 Rule', 'Summary', 'Daily Pace']
  };
}

function handleDebtPayoff(snapshot, formatCurrency) {
  const replyText =
    `*Debt Acceleration Blueprint: Avalanche vs Snowball*\n\n` +
    `• *Method 1: Debt Avalanche (Mathematically Optimal)*\n` +
    `Pay minimums on everything, then channel all surplus cash to the debt with the *highest interest rate* (e.g. Credit Cards @ 36–42% APR). Saves the most money in interest charges.\n\n` +
    `• *Method 2: Debt Snowball (Psychological Momentum)*\n` +
    `Pay minimums on everything, then channel surplus cash to the *smallest balance*. Clearing small debts quickly builds motivational momentum.\n\n` +
    `*PocketNook Recommendation:* For revolving credit card debt, *always use Avalanche*. A 40% APR card compound will negate any mutual fund gains. Clear high-interest card dues first!`;

  return {
    replyText,
    type: 'debt_strategy',
    suggestedChips: ['Emergency Fund', '50/30/20 Rule', 'Summary']
  };
}

function handleOverbudgetRecovery(snapshot, formatCurrency) {
  const deficit = Math.abs(snapshot.remainingBudget);
  const days = snapshot.daysRemaining;
  const topCat = snapshot.topCategory?.category || 'discretionary spends';

  const replyText =
    `*Over-Budget Recovery & Triage Plan*\n` +
    (snapshot.remainingBudget < 0
      ? `Your spending has exceeded the monthly budget by *${formatCurrency(deficit)}* with ${days} days remaining.\n\n`
      : `Your spending velocity is high with only *${formatCurrency(snapshot.remainingBudget)}* left for ${days} days.\n\n`) +
    `*Immediate 3-Step Turnaround:*\n` +
    `1. *Freeze Non-Essential Outflows:* Zero dining out, cafes, or shopping for the next 7 days.\n` +
    `2. *Tackle Top Category:* Your biggest outflow is *${topCat}*. Cap all secondary purchases here immediately.\n` +
    `3. *Zero-Spend Days:* Target 3 zero-expense weekdays to halt the burn rate and stabilize your cash position.`;

  return {
    replyText,
    type: 'deficit_recovery',
    suggestedChips: ['Daily Pace', 'Category Spend', 'Tips']
  };
}

function handleCategoryOptimization(lower, snapshot, formatCurrency) {
  let title = 'Spending Reduction Blueprint';
  let tips = '';

  if (lower.includes('food') || lower.includes('dining') || lower.includes('zomato') || lower.includes('swiggy')) {
    title = 'Food & Dining Optimization Plan';
    tips = 
      `• *Cap Food Delivery to 1x/Week:* Delivery fees, packaging, and platform markups add 35-50% to meal costs.\n` +
      `• *Meal Prep Staples:* Batch cooking lunch on Sundays cuts weekday office dining expenses by up to 60%.\n` +
      `• *The ₹30 Chai/Snack Audit:* Multiple daily micro-spends average ~₹1,800/month. Keep a dedicated weekly cash envelope for snacks.`;
  } else if (lower.includes('shopping') || lower.includes('clothes')) {
    title = 'Shopping & Discretionary Control';
    tips = 
      `• *The 48-Hour Cooling Rule:* For any non-essential purchase > ₹1,000, wait 48 hours before checking out. 70% of impulse desires fade.\n` +
      `• *Cost-Per-Use Formula:* Divide item price by projected uses. If you won't use it 30+ times, rent or skip it.\n` +
      `• *Unsubscribe from Sale Push Alerts:* Delete shopping app notification permissions to remove artificial urgency.`;
  } else {
    title = 'Recurring Bills & Subscriptions Audit';
    tips = 
      `• *Ghost Subscription Purge:* Review streaming, gym, and app renewals. Cancel anything unused in the last 30 days.\n` +
      `• *Switch to Annual Plans:* For services you use daily (broadband, cloud), annual billing yields 15-25% instant savings.\n` +
      `• *Family Sharing Plans:* Pool music and OTT subscriptions with family or roommates to split costs.`;
  }

  const replyText =
    `*${title}*\n\n` +
    `${tips}\n\n` +
    `*Current Daily Safe Pace:* ${formatCurrency(snapshot.safeDailyPace)}/day. Trimming these leaks will immediately boost your end-of-month savings pool!`;

  return {
    replyText,
    type: 'category_optimization',
    suggestedChips: ['Daily Pace', 'Summary', '50/30/20 Rule']
  };
}

function handleGoalPlanning(text, lower, snapshot, formatCurrency) {
  const numbers = text.match(/\d+(?:[.,]\d+)?/g) || [];
  const targetAmount = numbers.length > 0 ? parseFloat(numbers[0].replace(/,/g, '')) : 25000;
  const months = numbers.length > 1 ? Math.min(24, Math.max(1, parseInt(numbers[1], 10))) : 6;
  const monthlyNeeded = Math.round(targetAmount / months);

  const replyText =
    `*Goal Feasibility & Savings Roadmap*\n` +
    `*Target Goal:* ${formatCurrency(targetAmount)}\n` +
    `*Target Timeline:* ${months} months\n` +
    `*Required Monthly Savings:* *${formatCurrency(monthlyNeeded)}/month*\n\n` +
    `*Feasibility Assessment:*\n` +
    `Your current monthly safe remaining pool is *${formatCurrency(snapshot.remainingBudget)}*. ` +
    (snapshot.remainingBudget >= monthlyNeeded
      ? `This goal is *achievable*! Saving ${formatCurrency(monthlyNeeded)} leaves you with a comfortable buffer each month.`
      : `This will require tighter discipline. Consider extending your timeline to ${Math.ceil(targetAmount / (Math.max(snapshot.remainingBudget, 1000)))} months or cutting discretionary channels.`);

  return {
    replyText,
    type: 'goal_planning',
    suggestedChips: ['Summary', 'Daily Pace', 'Tips']
  };
}

function handleBilingualSavingsAdvice(snapshot, formatCurrency) {
  const topCat = snapshot.topCategory?.category || 'food aur shopping';
  const pace = snapshot.safeDailyPace;

  const replyText =
    `*Smart Savings Plan (पैसे बचाने का आसान तरीका)*\n\n` +
    `1. *Safe Daily Spending Target:* Aapka daily kharch target *${formatCurrency(pace)}/day* hai. Iske andar rehne par mahine ke ant me paisa bachega.\n` +
    `2. *Pay Yourself First:* Salary aate hi sabse pehle 20% savings alag account ya SIP me transfer karein, baki 80% se kharcha chalayein.\n` +
    `3. *Top Category Check:* Aapka sabse bada kharcha *${topCat}* me ho raha hai. Isme 15% ki katauti se aaram se mahine ke ₹1,500–₹3,000 bach sakte hain.\n` +
    `4. *24 Ghante Ka Niyam:* Kisi bhi ₹1,000+ ki cheez ko khareedne se pehle 24 ghante intezaar karein; impulse shopping ruk jayegi.`;

  return {
    replyText,
    type: 'bilingual_advice',
    suggestedChips: ['Summary', 'Daily Pace', '50/30/20 Rule']
  };
}

function handleInvestmentAdvice(snapshot, formatCurrency) {
  const replyText =
    `*Core Wealth Building & Investment Principles*\n\n` +
    `1. *First Priority — Emergency Fund:* Have 3–6 months of expenses in a liquid FD or high-yield account before investing in market instruments.\n` +
    `2. *Eliminate High-Interest Debt:* Never invest in equities while carrying 36%+ credit card debt. Pay off cards first.\n` +
    `3. *Low-Cost Index Funds & SIPs:* Invest in broad market index funds (Nifty 50) via monthly disciplined SIPs for a 5+ year horizon.\n` +
    `4. *Never Speculate Essential Capital:* Money you will need within the next 12–24 months belongs in safe, capital-preserving instruments (FD/Arbitrage/Liquid funds).`;

  return {
    replyText,
    type: 'investment_advice',
    suggestedChips: ['Emergency Fund', 'Debt Payoff', 'Summary']
  };
}

function handleSmartFinancialAdvisory(text, snapshot, formatCurrency) {
  const replyText =
    `*PocketNook Financial Intelligence Diagnosis*\n\n` +
    `Regarding your query on *"_` + text.slice(0, 45) + `_"*:\n\n` +
    `• *Budget Health:* You have spent *${formatCurrency(snapshot.totalSpent)}* with *${formatCurrency(snapshot.remainingBudget)}* remaining this cycle.\n` +
    `• *Daily Discipline:* Your safe daily spending pace is *${formatCurrency(snapshot.safeDailyPace)}/day* across the next ${snapshot.daysRemaining} days.\n` +
    `• *Primary Recommendation:* Maintain consistency. Prioritize building a 3-month reserve and keeping daily spends below ${formatCurrency(snapshot.safeDailyPace)}.\n\n` +
    `Ask me about \`50/30/20 rule\`, \`Emergency fund\`, \`Daily pace\`, or \`Split bill\` for deeper analysis!`;

  return {
    replyText,
    type: 'smart_advisory',
    suggestedChips: ['Summary', 'Daily Pace', '50/30/20 Rule', 'Emergency Fund']
  };
}

function handleCategoryQuery(lower, snapshot, formatCurrency) {
  const categories = snapshot.categoryBreakdown;

  for (const catRule of CATEGORY_KEYWORDS) {
    const isCategoryNamed = catRule.keywords.some(k => lower.includes(k)) || lower.includes(catRule.category.toLowerCase());
    if (isCategoryNamed) {
      const match = categories.find(c => c.category.toLowerCase() === catRule.category.toLowerCase());
      const spent = match ? match.spent : 0;
      const pct = match ? match.percent : 0;

      const replyText =
        `*${catRule.category} Spending Analysis*\n` +
        `*Total Spent:* *${formatCurrency(spent)}*\n` +
        `*Share of Budget:* ${pct}% of total spending\n\n` +
        (spent > 0
          ? `This is one of your active spending channels this month.`
          : `Great news! You have spent ₹0 in ${catRule.category} so far this month.`);

      return { replyText, type: 'category_detail' };
    }
  }

  if (categories.length === 0) {
    return {
      replyText: `You haven't recorded any category expenses yet this month. Start by logging something like \`Chai 20\`!`,
      type: 'category_breakdown'
    };
  }

  const topCats = categories.slice(0, 4);
  const chartLines = topCats.map((c, i) => `${i + 1}. *${c.category}:* ${formatCurrency(c.spent)} (${c.percent}%)`).join('\n');

  const replyText =
    `*Top Spending Categories (November)*\n` +
    `${chartLines}\n\n` +
    `*Top Category:* *${snapshot.topCategory?.category || 'General'}* (${snapshot.topCategory?.percent || 0}% of expenses)`;

  return {
    replyText,
    type: 'category_breakdown',
    suggestedChips: ['Daily Pace', 'Tips', 'Summary']
  };
}

function handleRecentHistory(snapshot, formatCurrency) {
  const txs = snapshot.safeTransactions.slice(0, 5);
  if (txs.length === 0) {
    return {
      replyText: `No recent transactions recorded yet this month.`,
      type: 'history'
    };
  }

  const list = txs.map((t, idx) => 
    `${idx + 1}. *${t.merchant}* • ${formatCurrency(t.amount)} (${t.category} • ${t.paymentMode} • ${t.date})`
  ).join('\n');

  const replyText =
    `*Recent Spending History (${txs.length} Transactions)*\n` +
    `${list}\n\n` +
    `Send \`Undo\` to delete the most recent one.`;

  return {
    replyText,
    type: 'recent_history',
    suggestedChips: ['Undo Last', 'Summary', 'Daily Pace']
  };
}

function handleSavingAdvice(snapshot, formatCurrency) {
  const topCat = snapshot.topCategory?.category || 'discretionary';
  const topSpent = snapshot.topCategory?.spent || 0;
  const pace = snapshot.safeDailyPace;

  const replyText =
    `*Personalized Financial Coaching*\n` +
    `1. *Top Optimization Target:* Your highest expense is *${topCat}* (${formatCurrency(topSpent)}). Trimming 15% here saves *${formatCurrency(Math.round(topSpent * 0.15))}*.\n` +
    `2. *The Daily Pace Rule:* Your safe burn rate is *${formatCurrency(pace)}/day*. Setting a micro-goal to spend zero on 2 weekdays adds *${formatCurrency(pace * 2)}* directly to your savings pool.\n` +
    `3. *Micro-Expense Alert:* Multiple ₹20–₹50 spends add up quickly to ~₹1,500/month. Use PocketNook's Speed Chips to stay mindful!`;

  return {
    replyText,
    type: 'saving_advice',
    suggestedChips: ['Summary', 'Daily Pace', 'Categories']
  };
}

function handleSummary(snapshot, formatCurrency) {
  const { totalSpent, budget, remainingBudget, todaySpent, percentSpent } = snapshot;

  const replyText =
    `*Monthly Budget Summary*\n` +
    `*Spent This Month:* ${formatCurrency(totalSpent)} (${percentSpent}%)\n` +
    `*Total Budget:* ${formatCurrency(budget)}\n` +
    `*Remaining Balance:* *${formatCurrency(remainingBudget)}*\n` +
    `*Spent Today:* ${formatCurrency(todaySpent)}\n` +
    `*Safe Daily Pace:* ${formatCurrency(snapshot.safeDailyPace)}/day\n\n` +
    (remainingBudget < 0
      ? `*Notice:* Budget exceeded by ${formatCurrency(Math.abs(remainingBudget))}!`
      : `*Health:* Safe and comfortably within limits.`);

  return {
    replyText,
    type: 'summary',
    suggestedChips: ['Daily Pace', 'Food Spend', 'Split Bill', 'Tips']
  };
}

function extractMultiItemExpenses(text) {
  const parts = text.split(/[,;\n]|\band\b/i).map(p => p.trim()).filter(Boolean);
  const parsedItems = [];

  for (const part of parts) {
    const item = parseSmsNotification(part);
    if (item.success && item.amount > 0) {
      parsedItems.push(item);
    }
  }

  return parsedItems;
}

async function handleMultiItemLogging(items, snapshot, formatCurrency, onSaveExpense) {
  let totalAdded = 0;
  const loggedList = [];

  for (const item of items) {
    if (typeof onSaveExpense === 'function') {
      await onSaveExpense({
        amount: item.amount,
        description: item.merchant,
        category: item.category,
        payment_mode: item.paymentMode,
        date: item.date,
        is_refund: item.type === 'income'
      });
    }
    totalAdded += item.amount;
    loggedList.push(`• *${item.merchant}*: ${formatCurrency(item.amount)} (${item.category})`);
  }

  const newTotal = snapshot.totalSpent + totalAdded;
  const replyText =
    `*Batch Expenses Recorded (${items.length} Items)*\n` +
    `${loggedList.join('\n')}\n\n` +
    `*Total Batch Amount:* ${formatCurrency(totalAdded)}\n` +
    `*Updated Month Spent:* ${formatCurrency(newTotal)}`;

  return {
    replyText,
    type: 'batch_logged',
    totalAdded,
    count: items.length
  };
}

async function handleSingleExpenseLogging(parsed, snapshot, formatCurrency, onSaveExpense) {
  if (typeof onSaveExpense === 'function') {
    await onSaveExpense({
      amount: parsed.amount,
      description: parsed.merchant,
      category: parsed.category,
      payment_mode: parsed.paymentMode,
      date: parsed.date,
      is_refund: parsed.type === 'income'
    });
  }

  const currentTotal = snapshot.totalSpent + (parsed.type === 'income' ? -parsed.amount : parsed.amount);
  const replyText = parsed.type === 'income'
    ? `*Income / Refund Logged!*\n` +
      `*Amount:* +${formatCurrency(parsed.amount)}\n` +
      `*Source:* ${parsed.merchant}\n` +
      `*Mode:* ${parsed.paymentMode}\n` +
      `*Date:* ${parsed.date}\n\n` +
      `Updated Monthly Spent: ${formatCurrency(currentTotal)}`
    : `*Expense Logged Successfully!*\n` +
      `*Amount:* ${formatCurrency(parsed.amount)}\n` +
      `*Category:* ${parsed.category}\n` +
      `*Merchant:* ${parsed.merchant}\n` +
      `*Mode:* ${parsed.paymentMode}\n` +
      `*Date:* ${parsed.date}\n\n` +
      `Updated Monthly Spent: ${formatCurrency(currentTotal)}`;

  return {
    replyText,
    type: 'expense_logged',
    parsed,
    suggestedChips: ['Undo', 'Summary', 'Daily Pace'],
    actionButtons: [
      { label: 'View Balance', query: 'Summary' },
      { label: 'Undo', query: 'Undo' }
    ]
  };
}

function handleFallbackResponse(text, snapshot, formatCurrency) {
  const replyText =
    `*I'm here to help with your finances:*\n\n` +
    `• \`50/30/20 rule\` (Personalized budget allocation)\n` +
    `• \`Emergency fund\` (Reserve calculation & strategy)\n` +
    `• \`How to pay off debt\` (Avalanche vs Snowball)\n` +
    `• \`Can I afford 3500?\` (Affordability diagnosis)\n` +
    `• \`Daily pace\` (Safe daily burn rate target)\n` +
    `• \`Paisa kaise bachaye\` (Hinglish financial habits)\n` +
    `• \`Chai 20\` or \`Lunch 150 upi\` (Record expense)\n` +
    `• \`Split 1800 by 4\` (Calculate bill split)\n\n` +
    `*Current Status:* Safe pool remaining: *${formatCurrency(snapshot.remainingBudget)}* (*${formatCurrency(snapshot.safeDailyPace)}/day*).`;

  return {
    replyText,
    type: 'help_guidance',
    suggestedChips: ['Summary', 'Daily Pace', '50/30/20 Rule', 'Emergency Fund']
  };
}
