"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Money } from "@/components/ui/Money";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { api, ApiClientError } from "@/lib/api/client";
import { formatDate } from "@/lib/utils/format";
import { useToast } from "@/components/ui/Toast";

interface FailedPaymentSale {
  id: string;
  receiptNumber: string;
  status: "DRAFT" | "VOIDED";
  total: number;
  createdAt: string;
  items: Array<{ name: string; quantity: number }>;
  payments: Array<{ method: string; status: string; failureReason: string | null }>;
}

interface FailedPaymentActionResult {
  status: "COMPLETED" | "FAILED" | "AWAITING_PAYMENT";
  released: boolean;
  requiresConfirmation: boolean;
  manuallyReleased?: boolean;
}

export interface FailedSalesDialogProps {
  open: boolean;
  onClose: () => void;
  onStockChanged: () => void;
}

export function FailedSalesDialog({ open, onClose, onStockChanged }: FailedSalesDialogProps) {
  const toast = useToast();
  const [sales, setSales] = useState<FailedPaymentSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingOnSale, setActingOnSale] = useState<string | null>(null);
  const [confirmSaleId, setConfirmSaleId] = useState<string | null>(null);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      setSales(await api.get<FailedPaymentSale[]>("/payments/failed"));
    } catch (error) {
      toast.error("Could not load failed sales", error instanceof ApiClientError ? error.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) void loadSales();
  }, [loadSales, open]);

  async function checkPayment(saleId: string, forceRelease = false) {
    setActingOnSale(saleId);
    try {
      const result = await api.post<FailedPaymentActionResult>(`/payments/failed/${saleId}`, { forceRelease });
      if (result.requiresConfirmation) {
        setConfirmSaleId(saleId);
        return;
      }
      if (result.status === "COMPLETED") {
        toast.success("Payment confirmed", "The sale was completed and the receipt issued.");
      } else if (result.manuallyReleased) {
        toast.success("Stock released", "The unresolved payment was flagged for late-payment review.");
      } else {
        toast.success("Payment failed", "The sale was voided and stock was returned.");
      }
      setConfirmSaleId(null);
      await loadSales();
      onStockChanged();
    } catch (error) {
      toast.error("Could not update failed sale", error instanceof ApiClientError ? error.message : undefined);
    } finally {
      setActingOnSale(null);
    }
  }

  const confirmSale = sales.find((sale) => sale.id === confirmSaleId);

  return (
    <>
      <Modal open={open} onClose={onClose} title="Failed sales" description="Review unresolved and failed payment attempts" size="md">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)}
          </div>
        ) : sales.length === 0 ? (
          <EmptyState
            icon={<RotateCw className="size-6" />}
            title="No failed or unresolved sales"
            message="Unresolved hosted payments and recently failed MoMo or card payments will appear here."
          />
        ) : (
          <ul className="divide-y divide-[var(--border-base)]">
            {sales.map((sale) => {
              const unresolved = sale.status === "DRAFT";
              const payment = sale.payments[0];
              const manuallyReleased = payment?.failureReason?.startsWith("Stock manually released") ?? false;
              const timedOut = payment?.failureReason?.startsWith("Paystack did not confirm") ?? false;
              return (
                <li key={sale.id} className="space-y-2 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-fg">{sale.receiptNumber}</p>
                      <p className="text-xs text-fg-muted">
                        {sale.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")} · {formatDate(sale.createdAt, "full")}
                      </p>
                      {payment?.failureReason && <p className="mt-1 text-xs text-danger">{payment.failureReason}</p>}
                    </div>
                    <Money value={sale.total} className="shrink-0 font-semibold" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-xs ${unresolved ? "text-warning" : "text-success"}`}>
                      {unresolved
                        ? "Payment unresolved · stock reserved"
                        : manuallyReleased || timedOut
                          ? "Stock released · payment may still settle"
                          : "Payment failed · stock released"}
                    </span>
                    {unresolved ? (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={actingOnSale === sale.id}
                        disabled={actingOnSale !== null}
                        onClick={() => void checkPayment(sale.id)}
                      >
                        Check status
                      </Button>
                    ) : (
                      <span className="text-xs text-fg-muted">{payment?.method === "MOMO" ? "MoMo" : "Card"}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmSale !== undefined}
        title="Release stock while payment is unresolved?"
        message={`Paystack still reports ${confirmSale?.receiptNumber ?? "this payment"} as unresolved. Releasing stock lets you sell these items again, but a late MoMo debit may still arrive and require a refund. Continue only after discussing this risk with the customer.`}
        confirmLabel="Release stock"
        destructive
        loading={confirmSaleId !== null && actingOnSale === confirmSaleId}
        onCancel={() => setConfirmSaleId(null)}
        onConfirm={() => {
          if (confirmSaleId) void checkPayment(confirmSaleId, true);
        }}
      />
    </>
  );
}
