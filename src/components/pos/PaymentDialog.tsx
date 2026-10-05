"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Printer } from "lucide-react";
import QRCode from "qrcode";
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

function ReceiptBarcode({ receipt }: { receipt: NonNullable<CheckoutResponse["receipt"]> }) {
  const [svgMarkup, setSvgMarkup] = useState("");

  useEffect(() => {
    let cancelled = false;
    const formatAmount = (amount: number) =>
      `${receipt.currency} ${new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
    const contents = [
      `RECEIPT ${receipt.receiptNumber}`,
      `Date: ${new Date(receipt.issuedAt).toLocaleString("en-GH")}`,
      `Store: ${receipt.store.name}`,
      `Branch: ${receipt.store.branchCode}`,
      ...(receipt.store.addressLine ? [`Address: ${receipt.store.addressLine}${receipt.store.city ? `, ${receipt.store.city}` : ""}`] : []),
      ...(receipt.store.phone ? [`Phone: ${receipt.store.phone}`] : []),
      ...(receipt.store.tinNumber ? [`TIN: ${receipt.store.tinNumber}`] : []),
      ...(receipt.store.vatNumber ? [`VAT: ${receipt.store.vatNumber}`] : []),
      `Cashier: ${receipt.cashier}`,
      ...(receipt.customer ? [`Customer: ${receipt.customer.name}`, ...(receipt.customer.phone ? [`Customer phone: ${receipt.customer.phone}`] : [])] : []),
      "",
      "ITEMS",
      ...receipt.items.map((item) => `${item.quantity} x ${item.name} | ${formatAmount(item.unitPrice)} each | ${formatAmount(item.lineTotal)} total`),
      "",
      "PAYMENTS",
      ...receipt.payments.map((payment) => `${payment.label}: ${formatAmount(payment.amount)}${payment.tenderedAmount !== null ? ` (tendered ${formatAmount(payment.tenderedAmount)})` : ""}`),
      "",
      "TOTALS",
      `Subtotal: ${formatAmount(receipt.totals.subtotal)}`,
      `Discount: ${formatAmount(receipt.totals.discount)}`,
      `Tax: ${formatAmount(receipt.totals.tax)}`,
      `TOTAL: ${formatAmount(receipt.totals.total)}`,
      `Amount paid: ${formatAmount(receipt.totals.amountPaid)}`,
      `Change: ${formatAmount(receipt.totals.changeDue)}`,
    ].join("\n");

    QRCode.toString(contents, { type: "svg", errorCorrectionLevel: "M", margin: 1, width: 180 })
      .then((svg) => { if (!cancelled) setSvgMarkup(svg); })
      .catch(() => { if (!cancelled) setSvgMarkup(""); });

    return () => { cancelled = true; };
  }, [receipt]);

  if (!svgMarkup) return null;
  return <div role="img" aria-label={`QR code with items and totals for receipt ${receipt.receiptNumber}`} dangerouslySetInnerHTML={{ __html: svgMarkup }} />;
}

export interface CheckoutPaymentInput {
  method: PaymentMethod;
  amount: number;
  tenderedAmount?: number;
  momoNetwork?: "MTN" | "VODAFONE" | "AIRTELTIGO";
  momoPhone?: string;
  momoEmail?: string;
  terminalId?: string;
  cardEmail?: string;
}

export interface CheckoutResponse {
  saleId: string;
  receiptNumber: string;
  status: "COMPLETED" | "AWAITING_PAYMENT" | "FAILED";
  total: number;
  amountPaid: number;
  changeDue: number;
  orderItems?: Array<{ productId: string; sku: string; quantity: number }>;
  payments: Array<{ method: string; state: string; message?: string; authorizationUrl?: string; failureReason?: string }>;
  receipt: {
    receiptNumber: string;
    issuedAt: string;
    store: { name: string; branchCode: string; addressLine: string | null; city: string | null; phone: string | null; tinNumber: string | null; vatNumber: string | null; footer: string | null };
    cashier: string;
    customer: { name: string; phone: string | null } | null;
    currency: string;
    items: Array<{ name: string; sku: string; quantity: number; unitPrice: number; lineTotal: number; taxAmount: number }>;
    totals: { subtotal: number; discount: number; tax: number; total: number; amountPaid: number; changeDue: number };
    payments: Array<{ method: string; label: string; amount: number; tenderedAmount: number | null; reference: string | null; cardLast4: string | null; momoPhone: string | null }>;
  } | null;
}

export interface PaymentDialogProps {
  open: boolean;
  total: number;
  returnSaleId?: string | null;
  methods: Array<{ method: PaymentMethod; label: string }>;
  mockCardDriver: boolean;
  mockMomoDriver: boolean;
  defaultEmail: string;
  onClose: () => void;
  onSubmit: (payments: CheckoutPaymentInput[]) => Promise<CheckoutResponse>;
  onCompleted: () => void;
  onReturnHandled: () => void;
  onRestoreOrder: (items: Array<{ productId: string; sku: string; quantity: number }>) => Promise<void>;
  onFinish: () => void;
}

export function PaymentDialog({
  open,
  total,
  returnSaleId,
  methods,
  mockCardDriver,
  mockMomoDriver,
  defaultEmail,
  onClose,
  onSubmit,
  onCompleted,
  onReturnHandled,
  onRestoreOrder,
  onFinish,
}: PaymentDialogProps) {
  const toast = useToast();
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [tendered, setTendered] = useState("");
  const [momoNetwork, setMomoNetwork] = useState<"MTN" | "VODAFONE" | "AIRTELTIGO">("MTN");
  const [momoPhone, setMomoPhone] = useState("");
  const [momoEmail, setMomoEmail] = useState("");
  const [cardEmail, setCardEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutResponse | null>(null);
  const [restoringOrder, setRestoringOrder] = useState(false);
  const notifiedCompletedSaleRef = useRef<string | null>(null);

  const notifyCompleted = useCallback((response: CheckoutResponse) => {
    if (notifiedCompletedSaleRef.current === response.saleId) return;
    notifiedCompletedSaleRef.current = response.saleId;
    toast.success("Payment confirmed", `Order ${response.receiptNumber} was completed successfully.`);
    onCompleted();
  }, [onCompleted, toast]);

  useEffect(() => {
    if (!open) return;
    setMethod("CASH");
    setTendered("");
    setMomoPhone("");
    setMomoEmail(defaultEmail);
    setCardEmail(defaultEmail);
    setError(null);
    setResult(null);
  }, [defaultEmail, open]);

  useEffect(() => {
    if (!open || !returnSaleId) return;
    let cancelled = false;
    setLoading(true);
    api.get<CheckoutResponse>(`/payments/status/${returnSaleId}`)
      .then((response) => {
        if (cancelled) return;
        setResult(response);
        if (response.status === "COMPLETED") {
          notifyCompleted(response);
        } else if (response.status === "FAILED") {
          setError(response.payments.find((payment) => payment.failureReason)?.failureReason ?? "The payment was not completed");
          onReturnHandled();
        }
      })
      .catch((statusError) => {
        if (!cancelled) setError(statusError instanceof ApiClientError ? statusError.message : "Could not verify the payment");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [notifyCompleted, onReturnHandled, open, returnSaleId]);

  // While a MoMo prompt or card payment settles, poll until the provider decides.
  useEffect(() => {
    if (!result || result.status !== "AWAITING_PAYMENT") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const next = await api.get<CheckoutResponse>(`/payments/status/${result.saleId}`);
        if (cancelled) return;
        if (next.status !== "AWAITING_PAYMENT") {
          setResult(next);
          if (next.status === "COMPLETED") {
            notifyCompleted(next);
          } else if (next.status === "FAILED" && returnSaleId) {
            onReturnHandled();
          }
          return;
        }
      } catch {
        // Retry transient network/provider errors without overlapping requests.
      }
      if (!cancelled) timer = setTimeout(poll, 1000);
    };
    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [notifyCompleted, onReturnHandled, result, returnSaleId]);

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
    (method === "CASH"
      ? tenderedAmount + 0.001 >= total
      : method === "MOMO"
        ? momoPhone.trim().length > 0 && (mockMomoDriver || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(momoEmail.trim()))
        : method === "CARD" && !mockCardDriver
          ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cardEmail.trim())
          : true);

  async function confirm() {
    setError(null);

    if (method === "MOMO" && !normalizeGhanaPhone(momoPhone)) {
      setError("Enter a valid Ghanaian mobile number, e.g. 024 123 4567");
      return;
    }
    if (method === "MOMO" && !mockMomoDriver && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(momoEmail.trim())) {
      setError("Enter a valid customer email for Paystack mobile-money checkout");
      return;
    }
    if (method === "CARD" && !mockCardDriver && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cardEmail.trim())) {
      setError("Enter a valid customer email for Paystack checkout");
      return;
    }

    setLoading(true);
    try {
      const payment: CheckoutPaymentInput = {
        method,
        amount: total,
        ...(method === "CASH" ? { tenderedAmount } : {}),
        ...(method === "MOMO"
          ? {
              momoNetwork,
              momoPhone: normalizeGhanaPhone(momoPhone) ?? momoPhone,
              ...(!mockMomoDriver ? { momoEmail: momoEmail.trim() } : {}),
            }
          : {}),
        ...(method === "CARD" && !mockCardDriver ? { cardEmail: cardEmail.trim() } : {}),
      };

      const response = await onSubmit([payment]);
      setResult(response);

      if (response.status === "FAILED") {
        setError(response.payments.find((p) => p.failureReason)?.failureReason ?? "The payment was declined");
      } else if (response.status === "COMPLETED") {
        notifyCompleted(response);
      } else {
        const authorizationUrl = response.payments.find((p) => p.authorizationUrl)?.authorizationUrl;
        if (authorizationUrl) window.location.assign(authorizationUrl);
      }
    } catch (submitError) {
      setError(submitError instanceof ApiClientError ? submitError.message : "Could not complete the sale");
    } finally {
      setLoading(false);
    }
  }

  function printReceipt() {
    window.addEventListener("afterprint", onFinish, { once: true });
    window.print();
  }

  if (result?.status === "COMPLETED") {
    const receipt = result.receipt;
    const hasCashTender = receipt?.payments.some((payment) => payment.tenderedAmount !== null) ?? false;
    const tendered = receipt?.payments.reduce((sum, payment) => sum + (payment.tenderedAmount ?? 0), 0) ?? 0;

    return (
      <Modal
        open={open}
        onClose={onFinish}
        size="sm"
        closeOnBackdrop={false}
        footer={
          <div className="no-print mb-2 grid w-full grid-cols-3 gap-2 sm:mb-3 sm:flex sm:w-auto sm:gap-4">
            <Button variant="ghost" className="min-w-0 w-full px-2 text-sm sm:w-auto sm:px-4" onClick={onFinish}>
              Close
            </Button>
            <Button
              variant="outline"
              className="min-w-0 w-full px-2 text-sm sm:w-auto sm:px-4"
              leftIcon={<Printer className="size-4" />}
              onClick={printReceipt}
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
          <div className="no-print">
            <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-brand-50 text-success dark:bg-brand-950">
              <CheckCircle2 className="size-8" />
            </span>
            <p className="text-lg font-semibold text-fg">Sale completed</p>
            <p className="mt-1 text-sm text-fg-muted">{result.receiptNumber}</p>
          </div>

          {receipt && (
            <div className="print-sheet mt-5 w-full space-y-4 text-left text-sm">
              <div className="print-flat rounded-xl border border-line bg-muted px-4 py-3">
                <div className="mb-4 text-center text-fg">
                  <p className="font-bold">{receipt.store.name}</p>
                  <p>Branch: {receipt.store.branchCode}</p>
                  {receipt.store.addressLine && <p>{receipt.store.addressLine}{receipt.store.city ? `, ${receipt.store.city}` : ""}</p>}
                  {receipt.store.phone && <p>{receipt.store.phone}</p>}
                  {receipt.store.tinNumber && <p>TIN: {receipt.store.tinNumber}</p>}
                  {receipt.store.vatNumber && <p>VAT: {receipt.store.vatNumber}</p>}
                  <p className="mt-2 font-semibold">Receipt: {receipt.receiptNumber || result.receiptNumber}</p>
                  <p>{new Date(receipt.issuedAt).toLocaleString()}</p>
                  <p>Cashier: {receipt.cashier}</p>
                </div>
                <p className="mb-2 font-semibold text-fg">Items purchased</p>
                <div className="space-y-2">
                  {receipt.items.map((item, index) => (
                    <div key={`${item.sku}-${index}`} className="flex justify-between gap-3 border-b border-dashed border-line pb-1.5 last:border-0">
                      <span className="min-w-0 text-fg-secondary">{item.quantity} x {item.name} <span className="block text-xs">@ <Money value={item.unitPrice} /></span></span>
                      <Money value={item.lineTotal} className="shrink-0 font-medium text-fg" />
                    </div>
                  ))}
                </div>
              </div>

              <dl className="print-flat space-y-2 rounded-xl bg-muted p-4 text-sm">
                <div className="flex justify-between"><dt className="text-fg-secondary">Subtotal</dt><dd><Money value={receipt.totals.subtotal} /></dd></div>
                {receipt.totals.discount > 0 && <div className="flex justify-between"><dt className="text-fg-secondary">Discount</dt><dd>-<Money value={receipt.totals.discount} /></dd></div>}
                <div className="flex justify-between"><dt className="text-fg-secondary">Tax</dt><dd><Money value={receipt.totals.tax} /></dd></div>
                {hasCashTender && <div className="flex justify-between"><dt className="text-fg-secondary">Amount tendered</dt><dd><Money value={tendered} /></dd></div>}
                <div className="flex justify-between"><dt className="text-fg-secondary">Balance</dt><dd><Money value={receipt.totals.changeDue} className="font-semibold text-success" /></dd></div>
                <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt className="text-fg">Total</dt><dd><Money value={receipt.totals.total} /></dd></div>
              </dl>

              <div className="flex justify-between gap-3 px-1 text-sm">
                <span className="text-fg-secondary">Mode of payment</span>
                <span className="text-right font-medium text-fg">{receipt.payments.map((payment) => payment.label).join(", ")}</span>
              </div>
              {receipt.store.footer && <p className="text-center text-xs text-fg-muted">{receipt.store.footer}</p>}
              <div className="mt-3 flex justify-center">
                <ReceiptBarcode receipt={receipt} />
              </div>
              <p className="print-brand-footer mt-2 text-center text-xs text-fg-muted">POS by First Dest (0598925563)</p>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  if (result?.status === "FAILED") {
    const failureReason = result.payments.find((payment) => payment.failureReason)?.failureReason ?? error ?? "The payment was not completed";

    return (
      <Modal
        open={open}
        onClose={onFinish}
        title="Payment not completed"
        size="sm"
        closeOnBackdrop={false}
        footer={
          <div className="mb-2 flex w-full justify-between gap-3">
            <Button variant="outline" onClick={onFinish}>Close</Button>
            {result.orderItems && result.orderItems.length > 0 && (
              <Button
                size="lg"
                loading={restoringOrder}
                onClick={async () => {
                  setRestoringOrder(true);
                  try {
                    await onRestoreOrder(result.orderItems!);
                  } catch (restoreError) {
                    setError(restoreError instanceof Error ? restoreError.message : "Could not restore the order");
                  } finally {
                    setRestoringOrder(false);
                  }
                }}
              >
                Restore order
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-baseline justify-between rounded-xl bg-brand-600 px-4 py-3 text-white">
            <span className="text-sm">Amount due</span>
            <Money value={result.total} size="xl" />
          </div>
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-danger dark:border-red-900 dark:bg-red-950/40">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{failureReason}</span>
          </div>
          <p className="text-sm text-fg-muted">No receipt was issued because payment was not confirmed. Restoring the order won&apos;t create another sale or charge.</p>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
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
          {result.payments.find((payment) => payment.authorizationUrl)?.authorizationUrl && (
            <a
              href={result.payments.find((payment) => payment.authorizationUrl)?.authorizationUrl}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Open Paystack checkout
            </a>
          )}
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

      {((method === "CARD" && mockCardDriver) || (method === "MOMO" && mockMomoDriver)) && (
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
          {!mockMomoDriver && (
            <Input
              type="email"
              autoComplete="email"
              label="Customer email"
              placeholder="name@example.com"
              value={momoEmail}
              onChange={(event) => setMomoEmail(event.target.value)}
              required
            />
          )}
        </div>
      )}

      {method === "CARD_TERMINAL" && (
        <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-fg-secondary">
          Send the amount to the Ghana POS terminal and ask the customer to insert or tap their card, then confirm
          here.
        </p>
      )}

      {method === "CARD" && (
        <div className="mt-4 space-y-3">
          {!mockCardDriver && (
            <Input
              autoFocus
              type="email"
              autoComplete="email"
              label="Customer email"
              placeholder="name@example.com"
              value={cardEmail}
              onChange={(event) => setCardEmail(event.target.value)}
              required
            />
          )}
          <p className="rounded-lg bg-muted p-3 text-sm text-fg-secondary">
            The customer completes payment on Paystack. Card details are entered there and never stored by this system.
          </p>
        </div>
      )}
    </Modal>
  );
}
