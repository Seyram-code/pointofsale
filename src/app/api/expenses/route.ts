import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ApiError, created, handleApiError, ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { recordAudit, requestContext } from "@/lib/services/audit.service";
import { createExpenseSchema, expenseQuerySchema, EXPENSE_CATEGORY_LABELS } from "@/lib/validations/expense.schema";
import { addDays, endOfDay, startOfDay } from "@/lib/utils/date";

function dateValue(value: string | undefined, fallback: Date) {
  return value ? new Date(`${value}T00:00:00.000Z`) : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.EXPENSES_VIEW);
    const storeId = session.user.storeId;
    if (!storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const query = expenseQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const today = new Date();
    const from = startOfDay(dateValue(query.from, addDays(today, -29)));
    const to = endOfDay(dateValue(query.to, today));
    if (from > to) throw ApiError.badRequest("The start date must be on or before the end date");

    const expenses = await prisma.expense.findMany({
      where: {
        storeId,
        deletedAt: null,
        expenseDate: { gte: from, lte: to },
        ...(query.category ? { category: query.category } : {}),
        ...(query.search ? {
          OR: [
            { description: { contains: query.search } },
            { supplierName: { contains: query.search } },
            { receiptReference: { contains: query.search } },
          ],
        } : {}),
      },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      take: 500,
      include: { createdBy: { select: { fullName: true } } },
    });

    const totalsByCategory = new Map<string, number>();
    let total = 0;
    for (const expense of expenses) {
      const amount = Number(expense.amount);
      total += amount;
      totalsByCategory.set(expense.category, (totalsByCategory.get(expense.category) ?? 0) + amount);
    }

    return ok({
      range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      total,
      count: expenses.length,
      truncated: expenses.length === 500,
      categories: Array.from(totalsByCategory, ([category, amount]) => ({
        category,
        label: EXPENSE_CATEGORY_LABELS[category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? category,
        amount,
      })).sort((a, b) => b.amount - a.amount),
      expenses: expenses.map((expense) => ({ ...expense, amount: Number(expense.amount) })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.EXPENSES_MANAGE);
    const storeId = session.user.storeId;
    if (!storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const input = createExpenseSchema.parse(await request.json());
    const expense = await prisma.expense.create({
      data: { ...input, expenseDate: new Date(`${input.expenseDate}T00:00:00.000Z`), storeId, createdById: session.user.id },
      include: { createdBy: { select: { fullName: true } } },
    });
    await recordAudit({
      action: "CREATE",
      entity: "Expense",
      entityId: expense.id,
      storeId,
      userId: session.user.id,
      summary: `Recorded ${input.category.toLowerCase()} expense of GHS ${input.amount.toFixed(2)}`,
      changes: { amount: input.amount, category: input.category, paymentMethod: input.paymentMethod },
      ...requestContext(request),
    });
    return created({ ...expense, amount: Number(expense.amount) });
  } catch (error) {
    return handleApiError(error);
  }
}
