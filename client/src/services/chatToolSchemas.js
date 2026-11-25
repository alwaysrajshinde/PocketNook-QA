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

function isValidCalendarDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
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

const TOOL_SCHEMAS = {
  log_expense: LogExpenseSchema,
  log_multiple_expenses: LogMultipleExpensesSchema,
  undo_last: UndoLastSchema,
  split_bill: SplitBillSchema,
  get_category_breakdown: GetCategoryBreakdownSchema,
  set_budget: SetBudgetSchema
};

/**
 * Validates a tool call on the client before rendering Confirm cards or modifying the ledger.
 */
export function validateClientToolCall(name, rawArgs) {
  const schema = TOOL_SCHEMAS[name];
  if (!schema) {
    return { valid: false, error: `Unsupported tool "${String(name)}"` };
  }
  const parsed = schema.safeParse(rawArgs);
  if (!parsed.success) {
    return {
      valid: false,
      error: parsed.error.issues.map((i) => `${i.path.join('.') || 'arg'}: ${i.message}`).join('; ')
    };
  }
  const args = parsed.data;
  let requiresConfirm = true;
  if (name === 'get_category_breakdown' || name === 'split_bill') {
    requiresConfirm = false;
  } else if (name === 'log_expense') {
    requiresConfirm = !(args.amount < 500 && args.confidence > 0.9);
  } else if (name === 'set_budget') {
    requiresConfirm = true;
  }

  return { valid: true, name, args, requiresConfirm };
}
