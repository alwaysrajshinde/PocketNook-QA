/**
 * aiAssistantService.js
 * PocketNook Autonomous AI Financial Copilot Engine
 * 
 * 100% Zero-Leakage & Privacy-First:
 * - Operates directly on-device using sanitized financial vectors.
 * - Powered by deterministic NLP, financial pace algorithms, and heuristic reasoning.
 * - Fully bilingual: understands English, Hindi keywords, and natural conversational Hinglish.
 */

import { parseSmsNotification, CATEGORY_KEYWORDS } from './smsParserService';
import { sanitizeFinancialText, prepareSafeFinancialSnapshot } from './piiSanitizerService';

/**
 * Main query dispatcher for the PocketNook Copilot
 * 
 * @param {string} rawInput - The user's input message
 * @param {Object} context - Financial state & helper handlers
 * @returns {Promise<Object>} Formatted response object with reply text, actions, and metadata
 */
export async function processAssistantMessage(rawInput = '', context = {}) {
  const { sanitizedText, wasSanitized, redactedTypes } = sanitizeFinancialText(rawInput.trim());
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

  // 8. SAVINGS TIPS & FINANCIAL COACHING
  if (isSavingAdviceIntent(lower)) {
    return handleSavingAdvice(snapshot, formatCurrency);
  }

  // 9. BUDGET SUMMARY (Overview)
  if (isSummaryIntent(lower)) {
    return handleSummary(snapshot, formatCurrency);
  }

  // 10. MULTI-ITEM BATCH EXPENSE LOGGING (e.g., "50 chai, 120 lunch, 40 auto")
  const multiItems = extractMultiItemExpenses(text);
  if (multiItems.length > 1) {
    return handleMultiItemLogging(multiItems, snapshot, formatCurrency, onSaveExpense);
  }

  // 11. SINGLE EXPENSE / INCOME LOGGING (via SMS parser)
  const parsed = parseSmsNotification(text);
  if (parsed.success && parsed.amount > 0) {
    return handleSingleExpenseLogging(parsed, snapshot, formatCurrency, onSaveExpense);
  }

  // 12. FALLBACK CONVERSATIONAL GUIDANCE
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
  return /\b(?:category|categories|breakdown|where\s*did\s*my\s*money|kahan\s*kharcha|food\s*spend|travel\s*spend|grocery|shopping)\b/i.test(lower) &&
         !/\b(?:chai\s*\d|\d+\s*chai|spent\s*\d)\b/i.test(lower);
}

function isRecentHistoryIntent(lower) {
  return /\b(?:last\s*\d*\s*expenses|recent\s*(?:expenses|transactions|activity)|pichla\s*kharcha|history)\b/i.test(lower);
}

function isSavingAdviceIntent(lower) {
  return /\b(?:how\s*to\s*save|saving\s*tips|advice|paisa\s*kaise\s*bachaye|tips|save\s*money|budget\s*plan)\b/i.test(lower);
}

function isSummaryIntent(lower) {
  return /\b(?:summary|balance|overview|budget|status|kitna\s*(?:paisa|kharcha)?\s*bacha)\b/i.test(lower);
}

/* ========================================================
   CONVERSATIONAL HANDLERS
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
    `• *Safe Daily Pace:* \`What is my safe daily pace?\`\n` +
    `• *Quick Undo:* Send \`Undo\` to remove the last entry.\n\n` +
    `*Financial Status:* You have *${formatCurrency(snapshot.remainingBudget)}* safe pool remaining this month (*${formatCurrency(snapshot.safeDailyPace)}/day*).`;

  return {
    replyText,
    type: 'greeting',
    suggestedChips: ['Summary', 'Daily Pace', 'Food Spend', 'Split Bill'],
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
  // Extract total bill amount (e.g. 2400)
  const numbers = text.match(/\d+(?:[.,]\d+)?/g) || [];
  if (numbers.length < 2) {
    return {
      replyText: `To split a bill, please specify the total amount and number of people.\n\n*Example:* \`Split 2400 between 6 people\``,
      type: 'split_error'
    };
  }

  const nums = numbers.map(n => parseFloat(n.replace(/,/g, '')));
  // Usually the larger number is the bill amount, the smaller is the head count
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

function handleCategoryQuery(lower, snapshot, formatCurrency) {
  const categories = snapshot.categoryBreakdown;

  // Check if user named a specific category (e.g. food, travel, groceries)
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

  // General category breakdown
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
  // Matches comma-separated or "and" separated lists: e.g. "50 chai, 100 lunch, 40 auto"
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
    `*I'm not quite sure how to process:* _"${text}"_\n\n` +
    `*Here are things you can ask me:*\n` +
    `• \`Chai 20\` or \`Lunch 150 upi\` (Record expense)\n` +
    `• \`50 milk, 120 fruits\` (Batch log items)\n` +
    `• \`Can I afford 3500?\` (Affordability diagnosis)\n` +
    `• \`Split 1800 by 4\` (Calculate bill split)\n` +
    `• \`Where is my money going?\` (Category breakdown)\n` +
    `• \`Daily pace\` or \`Summary\` (Budget check)\n` +
    `• \`Undo\` (Delete last recorded expense)`;

  return {
    replyText,
    type: 'help_guidance',
    suggestedChips: ['Summary', 'Daily Pace', 'Categories', 'Tips']
  };
}
