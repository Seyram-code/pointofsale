import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { diffChanges, recordAudit, requestContext } from "@/lib/services/audit.service";
import { updateExpenseSchema } from "@/lib/validations/expense.schema";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.EXPENSES_MANAGE);
    const storeId = session.user.storeId;
    if (!storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const { id } = await params;
    const input = updateExpenseSchema.parse(await request.json());
    const existing = await prisma.expense.findFirst({ where: { id, storeId, deletedAt: null } });
    if (!existing) throw ApiError.notFound("Expense");
    const updated = await prisma.expense.update({
      where: { id },
      data: { ...input, ...(input.expenseDate ? { expenseDate: new Date(`${input.expenseDate}T00:00:00.000Z`) } : {}) },
      include: { createdBy: { select: { fullName: true } } },
    });
    await recordAudit({
      action: "UPDATE",
      entity: "Expense",
      entityId: id,
      storeId,
      userId: session.user.id,
      summary: `Updated expense ${id}`,
      changes: diffChanges({
        amount: Number(existing.amount),
        category: existing.category,
        description: existing.description,
        expenseDate: existing.expenseDate.toISOString().slice(0, 10),
        paymentMethod: existing.paymentMethod,
        supplierName: existing.supplierName,
        receiptReference: existing.receiptReference,
      }, input),
      ...requestContext(request),
    });
    return ok({ ...updated, amount: Number(updated.amount) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(PERMISSIONS.EXPENSES_MANAGE);
    const storeId = session.user.storeId;
    if (!storeId) throw ApiError.badRequest("Your account is not linked to a store");
    const { id } = await params;
    const existing = await prisma.expense.findFirst({ where: { id, storeId, deletedAt: null } });
    if (!existing) throw ApiError.notFound("Expense");
    await prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    await recordAudit({
      action: "DELETE",
      entity: "Expense",
      entityId: id,
      storeId,
      userId: session.user.id,
      summary: `Removed expense ${id} from active records`,
      changes: { amount: Number(existing.amount), category: existing.category },
      ...requestContext(request),
    });
    return ok({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
