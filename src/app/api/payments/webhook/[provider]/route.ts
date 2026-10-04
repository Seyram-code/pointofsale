import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { fail, handleApiError, ok } from "@/lib/api/response";
import { getPaymentProvider } from "@/lib/payments/registry";
import { finalizeSale, releaseSaleStock } from "@/lib/services/checkout.service";
import { recordAudit } from "@/lib/services/audit.service";
import type { PaymentMethod } from "@/lib/payments/types";

const PROVIDER_METHODS: Record<string, PaymentMethod> = {
  momo: "MOMO",
  card: "CARD",
};

/**
 * Inbound provider callback. Unauthenticated by design — trust comes from the
 * signature check inside `parseWebhook`, never from the session.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider: providerKey } = await params;
    const method = PROVIDER_METHODS[providerKey];
    if (!method) return fail("NOT_FOUND", "Unknown payment provider", 404);

    const provider = getPaymentProvider(method);
    if (!provider.parseWebhook) return fail("BAD_REQUEST", "Provider does not send webhooks", 400);

    const rawBody = await request.text();
    const headers = Object.fromEntries(
      Array.from(request.headers.entries()).map(([key, value]) => [key.toLowerCase(), value]),
    );

    const event = await provider.parseWebhook(rawBody, headers);
    if (!event) return fail("UNAUTHORIZED", "Invalid webhook signature", 401);

    if (event.method && event.method !== method) return fail("BAD_REQUEST", "Payment method does not match provider route", 400);

    const payment = await prisma.payment.findFirst({
      where: { externalRef: event.externalRef },
      select: { id: true, saleId: true, status: true, amount: true, sale: { select: { storeId: true, cashierId: true, status: true } } },
    });

    // Always 200 for unknown references so the provider stops retrying.
    if (!payment) return ok({ received: true, matched: false });

    if (
      event.state === "SUCCESSFUL" &&
      ((method === "CARD" || providerKey === "momo" && event.currency !== undefined) && event.currency !== "GHS" ||
        event.amount === undefined || Math.abs(event.amount - Number(payment.amount)) >= 0.01)
    ) {
      return ok({ received: true, matched: true, verified: false });
    }

    if (payment.status !== "SUCCESSFUL") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: event.state, paidAt: event.state === "SUCCESSFUL" ? new Date() : null },
      });
    }

    if (event.state === "SUCCESSFUL" && payment.sale.status === "DRAFT") {
      await finalizeSale(payment.saleId, {
        storeId: payment.sale.storeId,
        cashierId: payment.sale.cashierId,
        allowPriceOverride: false,
      });

      await recordAudit({
        action: "UPDATE",
        entity: "Payment",
        entityId: payment.id,
        storeId: payment.sale.storeId,
        summary: `Payment confirmed by ${providerKey} webhook`,
      });
    }

    if (event.state === "FAILED" || event.state === "CANCELLED") {
      await releaseSaleStock(payment.saleId, {
        storeId: payment.sale.storeId,
        cashierId: payment.sale.cashierId,
      });
    }

    return ok({ received: true, matched: true });
  } catch (error) {
    return handleApiError(error);
  }
}
