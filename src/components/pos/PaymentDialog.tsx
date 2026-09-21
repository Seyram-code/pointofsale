"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Printer } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import { PaymentMethodSelector } from "@/components/pos/PaymentMethodSelector";
import { cn } from "@/lib/utils/cn";
import { CASH_DENOMINATIONS } from "@/lib/config/constants";
import { roundCashTender, subtractMoney } from "@/lib/utils/money";
import { normalizeGhanaPhone } from "@/lib/utils/format";
import { api, ApiClientError } from "@/lib/api/client";
import type { PaymentMethod } from "@/lib/payments/types";
import { useToast } from "@/components/ui/Toast";

const MOMO_NETWORKS = [
  { value: "MTN", label: "MTN" },
  { value: "VODAFONE", label: "Telecel" },
  { value: "AIRTELTIGO", label: "AirtelTigo" },
] as const;

export interface CheckoutPaymentInput {
  method: PaymentMethod;
  amount: number;
  tenderedAmount?: number;
  momoNetwork?: "MTN" | "VODAFONE" | "AIRTELTIGO";
  momoPhone?: string;
  terminalId?: string;
}

export interface CheckoutResponse {
  saleId: string;
  receiptNumber: string;
  status: "COMPLETED" | "AWAITING_PAYMENT" | "FAILED";
  total: number;
  amountPaid: number;
  changeDue: number;
  payments: Array<{ method: string; state: string; message?: string; failureReason?: string }>;
  receipt: {
    store: { name: string; addressLine: string | null; city: string | null; phone: string | null; receiptFooter: string | null };
    items: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number }>;
    totals: { subtotal: number; discount: number; tax: number; total: number; amountPaid: number; changeDue: number };
    payments: Array<{ label: string; amount: number; tenderedAmount: number | null }>;
  } | null;
}

export interface PaymentDialogProps {
  open: boolean;
  total: number;
  methods: Array<{ method: PaymentMethod; label: string }>;
  mockDriver: boolean;
  onClose: () => void;
  onSubmit: (payments: CheckoutPaymentInput[]) => Promise<CheckoutResponse>;
  onCompleted: () => void;
  onFinish: () => void;
}

export function PaymentDialog({
  open,
  total,
  methods,
  mockDriver,
  onClose,
  onSubmit,
  onCompleted,
  onFinish,
}: PaymentDialogProps) {
  const toast = useToast();
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [tendered, setTendered] = useState("");
  const [momoNetwork, setMomoNetwork] = useState<"MTN" | "VODAFONE" | "AIRTELTIGO">("MTN");
  const [momoPhone, setMomoPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    setMethod("CASH");
    setTendered("");
    setMomoPhone("");
    setError(null);
    setResult(null);
  }, [open]);

  // While a MoMo prompt or card payment settles, poll until the provider decides.
  useEffect(() => {
    if (!result || result.status !== "AWAITING_PAYMENT") return;

    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const next = await api.get<CheckoutResponse>(`/payments/status/${result.saleId}`);
        if (cancelled) return;
        if (next.status !== "AWAITING_PAYMENT") {
          setResult(next);
          if (next.status === "COMPLETED") {
            toast.success("Payment confirmed", `Order ${next.receiptNumber} was completed successfully.`);
            onCompleted();
          }
        }
      } catch {
        /* keep polling — a transient network blip should not abort the sale */
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [onCompleted, result, toast]);

  const tenderedAmount = Number(tendered) || 0;
  const change = useMemo(() => Math.max(subtractMoney(tenderedAmount, total), 0), [tenderedAmount, total]);

  const quickTenders = useMemo(() => {
    const options = new Set<number>([roundCashTender(total)]);
    for (const note of CASH_DENOMINATIONS) {
      if (note >= 1) options.add(Math.ceil(total / note) * note);
    }
    return Array.from(options)
      .filter((amount) => amount >= total)
      .sort((a, b) => a - b)
      .slice(0, 5);
  }, [total]);

  const canConfirm =
    !loading &&
    (method === "CASH" ? tenderedAmount + 0.001 >= total : method === "MOMO" ? momoPhone.trim().length > 0 : true);

  async function confirm() {
    setError(null);

    if (method === "MOMO" && !normalizeGhanaPhone(momoPhone)) {
      setError("Enter a valid Ghanaian mobile number, e.g. 024 123 4567");
      return;
    }

    setLoading(true);
    try {
      const payment: CheckoutPaymentInput = {
        method,
        amount: total,
        ...(method === "CASH" ? { tenderedAmount } : {}),
        ...(method === "MOMO"
          ? { momoNetwork, momoPhone: normalizeGhanaPhone(momoPhone) ?? momoPhone }
          : {}),
      };

      const response = await onSubmit([payment]);
      setResult(response);

      if (response.status === "FAILED") {
        setError(response.payments.find((p) => p.failureReason)?.failureReason ?? "The payment was declined");
      } else if (response.status === "COMPLETED") {
        toast.success("Payment confirmed", `Order ${response.receiptNumber} was completed successfully.`);
        onCompleted();
      }
    } catch (submitError) {
      setError(submitError instanceof ApiClientError ? submitError.message : "Could not complete the sale");
    } finally {
      setLoading(false);
    }
  }

  if (result?.status === "COMPLETED") {
    const receipt = result.receipt;
    const tendered = receipt?.payments.reduce((sum, payment) => sum + (payment.tenderedAmount ?? payment.amount), 0) ?? result.amountPaid;

    return (
      <Modal
        open={open}
        onClose={onFinish}
        size="sm"
        closeOnBackdrop={false}
        footer={
          <div className="mb-2 grid w-full grid-cols-3 gap-2 sm:mb-3 sm:flex sm:w-auto sm:gap-4">
            <Button variant="ghost" className="min-w-0 w-full px-2 text-sm sm:w-auto sm:px-4" onClick={onFinish}>
              Close
            </Button>
            <Button
              variant="outline"
              className="min-w-0 w-full px-2 text-sm sm:w-auto sm:px-4"
              leftIcon={<Printer className="size-4" />}
              onClick={() => window.print()}
            >
              Print
            </Button>
            <Button size="lg" className="min-w-0 w-full px-2 text-sm sm:w-auto sm:px-6 sm:text-base" onClick={onFinish} autoFocus>
              <span className="sm:hidden">New</span><span className="hidden sm:inline">New sale</span>
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center py-2 text-center">
          <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-brand-50 text-success dark:bg-brand-950">
            <CheckCircle2 className="size-8" />
          </span>
          <p className="text-lg font-semibold text-fg">Sale completed</p>
          <p className="mt-1 text-sm text-fg-muted">{result.receiptNumber}</p>

          {receipt && (
            <div className="mt-5 w-full space-y-4 text-left">
              <div className="rounded-xl border border-line bg-muted px-4 py-3 text-sm">
                <div className="mb-4 text-center text-fg">
                  <p className="font-semibold">{receipt.store.name}</p>
                  {receipt.store.addressLine && <p>{receipt.store.addressLine}{receipt.store.city ? `, ${receipt.store.city}` : ""}</p>}
                  {receipt.store.phone && <p>{receipt.store.phone}</p>}
                </div>
                <p className="mb-2 font-semibold text-fg">Items purchased</p>
                <div className="space-y-2">
                  {receipt.items.map((item) => (
                    <div key={`${item.name}-${item.quantity}-${item.lineTotal}`} className="flex justify-between gap-3">
                      <span className="min-w-0 text-fg-secondary">{item.quantity} x {item.name}</span>
                      <Money value={item.lineTotal} className="shrink-0 font-medium text-fg" />
                    </div>
                  ))}
                </div>
              </div>

              <dl className="space-y-2 rounded-xl bg-muted p-4 text-sm">
                <div className="flex justify-between"><dt className="text-fg-secondary">Subtotal</dt><dd><Money value={receipt.totals.subtotal} /></dd></div>
                <div className="flex justify-between"><dt className="text-fg-secondary">Tax</dt><dd><Money value={receipt.totals.tax} /></dd></div>
                {receipt.payments.some((payment) => payment.tenderedAmount !== null) && <div className="flex justify-between"><dt className="text-fg-secondary">Amount tendered</dt><dd><Money value={tendered} /></dd></div>}
                <div className="flex justify-between"><dt className="text-fg-secondary">Balance</dt><dd><Money value={receipt.totals.changeDue} className="font-semibold text-success" /></dd></div>
                <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt className="text-fg">Total</dt><dd><Money value={receipt.totals.total} /></dd></div>
              </dl>

              <div className="flex justify-between gap-3 px-1 text-sm">
                <span className="text-fg-secondary">Mode of payment</span>
                <span className="text-right font-medium text-fg">{receipt.payments.map((payment) => payment.label).join(", ")}</span>
              </div>
              {receipt.store.receiptFooter && <p className="text-center text-xs text-fg-muted">{receipt.store.receiptFooter}</p>}
            </div>
          )}
        </div>
      </Modal>
    );
  }

  if (result?.status === "AWAITING_PAYMENT") {
    return (
      <Modal open={open} onClose={onClose} title="Waiting for payment" size="sm" closeOnBackdrop={false}>
        <div className="flex flex-col items-center py-6 text-center">
          <Loader2 className="mb-4 size-10 animate-spin text-brand-600" />
          <p className="text-sm font-medium text-fg">
            {result.payments.find((p) => p.message)?.message ?? "Waiting for the customer to approve"}
          </p>
          <p className="mt-1.5 text-sm text-fg-muted">
            This screen updates automatically once the provider confirms.
          </p>
          <Money value={result.total} size="xl" className="mt-5" />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Take payment"
      size="sm"
      closeOnBackdrop={!loading}
      footer={
        <div className="mb-4 grid w-full grid-cols-2 gap-3 sm:mb-2 sm:flex sm:w-auto sm:gap-4">
          <Button variant="outline" className="min-w-0 w-full px-3 sm:w-auto sm:px-4" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="lg" className="min-w-0 w-full px-3 text-sm sm:w-auto sm:px-6 sm:text-base" loading={loading} disabled={!canConfirm} onClick={confirm}>
            Confirm payment
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex items-baseline justify-between rounded-xl bg-brand-600 px-4 py-3 text-white">
        <span className="text-sm">Amount due</span>
        <Money value={total} size="xl" />
      </div>

      {mockDriver && (
        <Badge
          variant="neutral"
          size="sm"
          className="mb-3"
          style={{
            backgroundColor: "var(--surface-muted)",
            borderColor: "var(--border-strong)",
            color: "var(--text-primary)",
          }}
        >
          Mock provider — no live gateway connected
        </Badge>
      )}

      {error && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-danger dark:border-red-900 dark:bg-red-950/40"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <PaymentMethodSelector options={methods} value={method} disabled={loading} onChange={setMethod} />

      {method === "CASH" && (
        <div className="mt-4">
          <Input
            autoFocus
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            label="Cash tendered"
            value={tendered}
            onChange={(event) => setTendered(event.target.value)}
          />
          <div className="mt-2.5 flex flex-wrap gap-2">
            {quickTenders.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setTendered(String(amount))}
                className="h-10 rounded-lg border border-line px-3 text-sm text-fg-secondary hover:bg-muted"
              >
                <Money value={amount} className="text-sm" />
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
            <span className="text-fg-secondary">Change due</span>
            <Money value={change} size="lg" className={change > 0 ? "text-success" : undefined} />
          </div>
        </div>
      )}

      {method === "MOMO" && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {MOMO_NETWORKS.map((network) => (
              <button
                key={network.value}
                type="button"
                onClick={() => setMomoNetwork(network.value)}
                className={cn(
                  "h-10 rounded-lg border text-xs font-medium transition-colors",
                  momoNetwork === network.value
                    ? "border-accent-500 bg-accent-100 text-accent-900 dark:bg-accent-900/40 dark:text-accent-100"
                    : "border-line bg-card text-fg-secondary hover:bg-muted",
                )}
              >
                {network.label}
              </button>
            ))}
          </div>
          <Input
            autoFocus
            type="tel"
            inputMode="numeric"
            label="Customer mobile number"
            placeholder="024 123 4567"
            value={momoPhone}
            onChange={(event) => setMomoPhone(event.target.value)}
          />
        </div>
      )}

      {method === "CARD_TERMINAL" && (
        <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-fg-secondary">
          Send the amount to the Ghana POS terminal and ask the customer to insert or tap their card, then confirm
          here.
        </p>
      )}

      {method === "CARD" && (
        <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-fg-secondary">
          A secure payment link is raised with the gateway. Card details are entered by the customer and never stored
          by this system.
        </p>
      )}
    </Modal>
  );
}
