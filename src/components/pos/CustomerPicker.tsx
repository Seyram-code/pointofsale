"use client";

import { useEffect, useState } from "react";
import { UserPlus, UserRound } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Money } from "@/components/ui/Money";
import { api, buildQuery } from "@/lib/api/client";
import { formatGhanaPhone } from "@/lib/utils/format";
import type { CartCustomer } from "@/hooks/useCart";

interface CustomerResult {
  id: string;
  code: string;
  fullName: string;
  phone: string | null;
  loyaltyPoints: number;
  storeCredit: number;
}

export interface CustomerPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: CartCustomer | null) => void;
}

export function CustomerPicker({ open, onClose, onSelect }: CustomerPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

    api
      .get<CustomerResult[]>(`/customers/search${buildQuery({ q: query })}`)
      .then((data) => !cancelled && setResults(data))
      .catch(() => !cancelled && setResults([]))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [open, query]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Select customer"
      description="Attach a customer for loyalty and receipts"
      size="md"
      footer={
        <Button
          variant="outline"
          fullWidth
          className="sm:w-auto"
          onClick={() => {
            onSelect(null);
            onClose();
          }}
        >
          Continue as walk-in
        </Button>
      }
    >
      <SearchInput autoFocus placeholder="Name, phone or loyalty card" onSearch={setQuery} className="mb-3" />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="size-6" />}
          title="No customers found"
          message="Walk-in sales do not need a customer record."
        />
      ) : (
        <ul className="divide-y divide-[var(--border-base)]">
          {results.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect({ id: customer.id, fullName: customer.fullName, phone: customer.phone });
                  onClose();
                }}
                className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-muted"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                  <UserRound className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{customer.fullName}</span>
                  <span className="block truncate text-xs text-fg-muted">
                    {customer.phone ? formatGhanaPhone(customer.phone) : customer.code}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-fg-muted">
                  <span className="block">{customer.loyaltyPoints} pts</span>
                  {customer.storeCredit > 0 && <Money value={customer.storeCredit} className="block text-xs" />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
