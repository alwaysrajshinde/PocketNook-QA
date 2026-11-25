import { z } from 'zod';

export const ALLOWED_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Subscriptions',
  'Housing & Rent',
  'Other'
];

export const ALLOWED_PAYMENT_MODES = ['UPI', 'Card', 'Cash', 'Net Banking'];

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(dateStr) {
  if (!ISO_DATE_REGEX.test(dateStr)) return false;
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === dateStr;
}

export const LogExpenseSchema = z.object({
  amount: z.number().finite().positive().lt(10_000_000),
  merchant: z.string().trim().min(1).max(80),
  category: z.enum(ALLOWED_CATEGORIES),
  mode: z.enum(ALLOWED_PAYMENT_MODES).default('UPI'),
  date: z.string().refine(isValidCalendarDate, { message: 'Invalid YYYY-MM-DD date' }),
  type: z.enum(['expense', 'income']).default('expense'),
  confidence: z.number().min(0).max(1)
}).strict();

export const LogMultipleExpensesSchema = z.object({
  items: z.array(LogExpenseSchema).min(1).max(10)
}).strict();

export const UndoLastSchema = z.object({
  scope: z.enum(['last_item', 'last_batch']).default('last_item')
}).strict();

export const SplitBillSchema = z.object({
  total: z.number().finite().positive().lt(10_000_000),
  people: z.number().int().min(2).max(100),
  includeSelf: z.boolean().default(true)
}).strict();

export const GetCategoryBreakdownSchema = z.object({
  category: z.string().trim().max(40).optional(),
  period: z.enum(['this_month', 'today', 'this_week']).default('this_month')
}).strict();

export const SetBudgetSchema = z.object({
  amount: z.number().finite().positive().lt(100_000_000)
}).strict();

export const TOOL_SCHEMAS = {
  log_expense: LogExpenseSchema,
  log_multiple_expenses: LogMultipleExpensesSchema,
  undo_last: UndoLastSchema,
  split_bill: SplitBillSchema,
  get_category_breakdown: GetCategoryBreakdownSchema,
  set_budget: SetBudgetSchema
};

export const SnapshotCategorySchema = z.object({
  category: z.string().max(40),
  amount: z.number().finite().nonnegative(),
  pctOfSpend: z.number().finite().min(0).max(100)
}).strict();

export const SnapshotTxSchema = z.object({
  date: z.string().max(12),
  amount: z.number().finite().nonnegative(),
  category: z.string().max(40),
  merchantGeneric: z.string().max(60),
  mode: z.string().max(24)
}).strict();

export const SnapshotFixedSchema = z.object({
  name: z.string().max(60),
  amount: z.number().finite().nonnegative(),
  dueDate: z.string().max(12)
}).strict();

export const SafeContextSchema = z.object({
  month: z.string().max(10),
  currency: z.string().max(8).default('INR'),
  monthlyBudget: z.number().finite().nonnegative(),
  spentThisMonth: z.number().finite().nonnegative(),
  remaining: z.number().finite(),
  daysLeft: z.number().int().min(1).max(31),
  safeDailyPace: z.number().finite().nonnegative(),
  todaySpent: z.number().finite().nonnegative(),
  categoryTotals: z.array(SnapshotCategorySchema).max(12).default([]),
  recentTransactions: z.array(SnapshotTxSchema).max(10).default([]),
  upcomingFixed: z.array(SnapshotFixedSchema).max(6).optional()
}).strict();

export const ChatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(1000)
}).strict();

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  isSmsPaste: z.boolean().optional().default(false),
  history: z.array(ChatTurnSchema).max(8).optional().default([]),
  olderSummary: z.string().max(300).nullable().optional(),
  context: SafeContextSchema.nullable().optional(),
  requestId: z.string().max(80).optional()
}).strict().superRefine((val, ctx) => {
  const maxLen = val.isSmsPaste ? 2000 : 1000;
  if (val.message.length > maxLen) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['message'],
      message: `Message exceeds ${maxLen} character limit`
    });
  }
});

/**
 * Validates an LLM tool call against strict Zod schemas.
 * Every ledger mutation (including single expense logs regardless of amount/confidence)
 * unconditionally requires explicit user confirmation.
 */
export function validateToolCall(name, rawArgs) {
  const schema = TOOL_SCHEMAS[name];
  if (!schema) {
    return { valid: false, error: `Unsupported tool: ${String(name)}` };
  }

  const parsed = schema.safeParse(rawArgs);
  if (!parsed.success) {
    return {
      valid: false,
      error: parsed.error.issues.map((i) => `${i.path.join('.') || 'arg'}: ${i.message}`).join('; ')
    };
  }

  const args = parsed.data;
  const isReadOnlyOrCalc = name === 'get_category_breakdown' || name === 'split_bill';
  const requiresConfirm = !isReadOnlyOrCalc;

  return {
    valid: true,
    name,
    args,
    requiresConfirm
  };
}
