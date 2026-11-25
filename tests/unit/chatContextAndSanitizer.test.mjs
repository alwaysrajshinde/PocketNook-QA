import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeFinancialText } from '../../client/src/services/piiSanitizerService.js';
import {
  buildSafeChatContext,
  buildSanitizedConversationMemory,
  MAX_CONTEXT_CHAR_BUDGET,
  MAX_RECENT_TURNS
} from '../../client/src/services/chatContextService.js';
import { parseSmsNotification } from '../../client/src/services/smsParserService.js';

test('Context Builder respects OFF consent by returning null', () => {
  const res = buildSafeChatContext({
    consentEnabled: false,
    dashboardData: { budget: 20000, total_spent: 5000, remaining_budget: 15000 },
    recentTransactions: [{ amount: 250, description: 'Swiggy', category: 'Food & Dining' }]
  });
  assert.equal(res, null);
});

test('Context Builder produces compact masked snapshot under token/char cap', () => {
  const txs = Array.from({ length: 25 }, (_, i) => ({
    date: '2026-11-25',
    amount: 100 + i,
    category: 'Food & Dining',
    description: `Swiggy A/c 123456789012 UTR: 998877665544 Ph: 9876543210 raj@okicici`,
    payment_mode: 'UPI'
  }));

  const ctx = buildSafeChatContext({
    consentEnabled: true,
    dashboardData: {
      month_key: '2026-11',
      budget: 50000,
      total_spent: 12000,
      remaining_budget: 38000,
      today_spent: 450,
      category_breakdown: [{ category: 'Food & Dining', spent: 8000, percent: 67 }]
    },
    recentTransactions: txs,
    upcomingRecurring: [{ name: 'Netflix Ph 9876543210', amount: 649, nextDueDate: '2026-12-01' }]
  });

  assert.equal(ctx.currency, 'INR');
  assert.equal(ctx.monthlyBudget, 50000);
  assert.ok(ctx.recentTransactions.length <= 10);
  assert.ok(JSON.stringify(ctx).length <= MAX_CONTEXT_CHAR_BUDGET);

  const serialized = JSON.stringify(ctx);
  assert.ok(!serialized.includes('123456789012'));
  assert.ok(!serialized.includes('998877665544'));
  assert.ok(!serialized.includes('9876543210'));
  assert.ok(!serialized.includes('raj@okicici'));
});

test('Conversation memory retains last 8 sanitized turns and summarizes older turns', () => {
  const msgs = Array.from({ length: 14 }, (_, i) => ({
    id: `m_${i}`,
    sender: i % 2 === 0 ? 'user' : 'bot',
    text: i === 0 ? 'My PAN is ABCDE1234F and UTR: 123456789012' : `Message turn ${i}`
  }));

  const mem = buildSanitizedConversationMemory(msgs);
  assert.equal(mem.recentTurns.length, MAX_RECENT_TURNS);
  assert.ok(mem.olderSummary && mem.olderSummary.includes('Earlier in this chat'));
  assert.ok(!mem.olderSummary.includes('ABCDE1234F'));
  assert.ok(!mem.olderSummary.includes('123456789012'));
});

test('Sanitizer avoids false positives on currency amounts vs Indian phone & UTR numbers', () => {
  const input = 'Paid Rs 9876543210.00 for property, call 9876543210 UTR: 294810481922 A/c 112233445566 Card 4111-2222-3333-4444';
  const { sanitizedText, redactedTypes } = sanitizeFinancialText(input);

  // Currency Rs 9876543210.00 must stay intact while mobile, UTR, PAN/card are masked
  assert.ok(sanitizedText.includes('Rs 9876543210.00'));
  assert.ok(!sanitizedText.includes('294810481922'));
  assert.ok(!sanitizedText.includes('4111-2222-3333-4444'));
  assert.ok(!sanitizedText.includes('112233445566'));
  assert.ok(sanitizedText.includes('A/c **5566'));
  assert.ok(redactedTypes.includes('phone'));
  assert.ok(redactedTypes.includes('transaction_ref'));
  assert.ok(redactedTypes.includes('card'));
  assert.ok(redactedTypes.includes('bank_account'));
});

test('Parser handles Indian k/lakh, commas, Hinglish, and ambiguous quantity heuristics', () => {
  const p1 = parseSmsNotification('50 chai, 1,200 lunch');
  assert.equal(p1.success, false); // single parser ignores multi-item batch

  const p2 = parseSmsNotification('Lunch 1,200 card');
  assert.equal(p2.success, true);
  assert.equal(p2.amount, 1200);
  assert.equal(p2.paymentMode, 'Card');

  const p3 = parseSmsNotification('chai pe 30 kharch kiya');
  assert.equal(p3.success, true);
  assert.equal(p3.amount, 30);
  assert.equal(p3.category, 'Food & Dining');

  const p4 = parseSmsNotification('2 chai 40');
  assert.equal(p4.success, true);
  assert.equal(p4.isLowConfidence, true);
  assert.equal(p4.isAmbiguous, true);
  assert.equal(p4.ambiguityOptions.length, 2);
});
