import assert from "node:assert/strict";
import { test } from "node:test";
import { createExpenseSchema, expenseQuerySchema } from "@/lib/validations/expense.schema";

const validExpense = {
  amount: 24.5,
  category: "UTILITIES",
  description: "Water bill",
  expenseDate: "2026-10-14",
  paymentMethod: "MOMO",
};

test("expense input accepts a valid dated operating expense", () => {
  const result = createExpenseSchema.safeParse(validExpense);
  assert.equal(result.success, true);
});

test("expense input rejects invalid amounts, categories, and calendar dates", () => {
  assert.equal(createExpenseSchema.safeParse({ ...validExpense, amount: 0 }).success, false);
  assert.equal(createExpenseSchema.safeParse({ ...validExpense, category: "STOCK" }).success, false);
  assert.equal(createExpenseSchema.safeParse({ ...validExpense, expenseDate: "2026-02-30" }).success, false);
});

test("expense filters reject malformed date values", () => {
  assert.equal(expenseQuerySchema.safeParse({ from: "yesterday" }).success, false);
});
