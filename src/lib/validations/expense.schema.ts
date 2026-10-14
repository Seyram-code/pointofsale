import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "RENT",
  "UTILITIES",
  "TRANSPORT",
  "SALARIES",
  "SUPPLIES",
  "MAINTENANCE",
  "MARKETING",
  "OTHER",
] as const;

export const EXPENSE_CATEGORY_LABELS: Record<(typeof EXPENSE_CATEGORIES)[number], string> = {
  RENT: "Rent",
  UTILITIES: "Utilities",
  TRANSPORT: "Transport",
  SALARIES: "Salaries",
  SUPPLIES: "Operating supplies",
  MAINTENANCE: "Maintenance",
  MARKETING: "Marketing",
  OTHER: "Other",
};

export const EXPENSE_PAYMENT_METHODS = ["CASH", "MOMO", "CARD", "BANK_TRANSFER", "OTHER"] as const;
export const EXPENSE_PAYMENT_METHOD_LABELS: Record<(typeof EXPENSE_PAYMENT_METHODS)[number], string> = {
  CASH: "Cash",
  MOMO: "Mobile Money",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  OTHER: "Other",
};

const expenseFields = {
  amount: z.coerce.number().finite().positive().max(1_000_000_000),
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().min(2).max(500),
  expenseDate: z.string().date(),
  paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS),
  supplierName: z.string().trim().max(120).optional().nullable().transform((value) => value || null),
  receiptReference: z.string().trim().max(120).optional().nullable().transform((value) => value || null),
};

export const createExpenseSchema = z.object(expenseFields);
export const updateExpenseSchema = z.object(expenseFields).partial().refine((value) => Object.keys(value).length > 0);

export const expenseQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  search: z.string().trim().max(120).optional(),
});

export type ExpenseInput = z.infer<typeof createExpenseSchema>;
