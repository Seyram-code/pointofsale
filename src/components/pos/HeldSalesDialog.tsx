"use client";

import { useEffect, useState } from "react";
import { PauseCircle, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Money } from "@/components/ui/Money";
import { api } from "@/lib/api/client";
import { formatDate } from "@/lib/utils/format";
import { useToast } from "@/components/ui/Toast";

export interface HeldSale {
  id: string;
  receiptNumber: string;
  total: number;
  itemCount: number;
  note: string | null;
  createdAt: string;
  cashierName: string;
  customerName: string | null;
}

export interface HeldSalesDialogProps {
  open: boolean;
  onClose: () => void;
  onResume: (saleId: string) => void;
}

export function HeldSalesDialog({ open, onClose, onResume }: HeldSalesDialogProps) {
  const toast = useToast();
  const [sales, setSales] = useState<HeldSale[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

    api
      .get<HeldSale[]>("/sales/held")
      .then((data) => !cancelled && setSales(data))
      .catch(() => !cancelled && setSales([]))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [open]);

  async function discard(saleId: string) {
    const discarded = sales.find((sale) => sale.id === saleId);
    try {
      await api.delete(`/sales/held/${saleId}`);
      setSales((current) => current.filter((sale) => sale.id !== saleId));
      toast.success("Held sale discarded", discarded ? `${discarded.receiptNumber} was removed.` : undefined);
    } catch {
      toast.error("Could not discard held sale", "The sale is still available.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Held sales" description="Resume a parked transaction" size="md">
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : sales.length === 0 ? (
        <EmptyState
          icon={<PauseCircle className="size-6" />}
          title="No held sales"
          message="Park a sale with F4 to serve another customer, then resume it here."
        />
      ) : (
        <ul className="divide-y divide-[var(--border-base)]">
          {sales.map((sale) => (
            <li key={sale.id} className="flex items-center gap-2 py-2.5">
              <button
                type="button"
                onClick={() => {
                  onResume(sale.id);
                  onClose();
                }}
                className="min-w-0 flex-1 rounded-lg px-1 py-1 text-left hover:bg-muted"
              >
                <span className="block truncate text-sm font-medium text-fg">{sale.receiptNumber}</span>
                <span className="block truncate text-xs text-fg-muted">
                  {sale.customerName ?? "Walk-in"} &middot; {sale.itemCount} line
                  {sale.itemCount === 1 ? "" : "s"} &middot; {formatDate(sale.createdAt, "full")}
                </span>
                {sale.note && <span className="block truncate text-xs italic text-fg-muted">{sale.note}</span>}
              </button>
              <Money value={sale.total} className="shrink-0 font-semibold" />
              <button
                type="button"
                aria-label={`Discard ${sale.receiptNumber}`}
                onClick={() => discard(sale.id)}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-red-50 hover:text-danger dark:hover:bg-red-950/40"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
