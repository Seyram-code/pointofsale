"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import QRCode from "qrcode";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { api, ApiClientError } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";
import { PERMISSIONS } from "@/lib/auth/permissions";

export interface SalesWorkspaceRow {
  id: string;
  receiptNumber: string;
  createdAt: string;
  cashierId: string;
  cashierName: string;
  paymentMethod: string;
  itemCount: number;
  total: number;
  status: string;
  subtotal: number;
  tax: number;
  amountPaid: number;
  changeDue: number;
  items: Array<{ id: string; name: string; quantity: number; unitPrice: number; lineTotal: number }>;
  payments: Array<{ method: string; amount: number; tenderedAmount: number | null }>;
}

interface StaffOption {
  id: string;
  name: string;
}

interface SalesWorkspaceProps {
  sales: SalesWorkspaceRow[];
  staff: StaffOption[];
  canViewAll: boolean;
}

interface SavedReceipt {
  qrSvg: string;
  receiptNumber: string;
  issuedAt: string;
  store: { name: string; branchCode: string; addressLine: string | null; city: string | null; phone: string | null; tinNumber: string | null; vatNumber: string | null; footer: string | null };
  cashier: string;
  customer: { name: string; phone: string | null } | null;
  currency: string;
  items: Array<{ name: string; sku: string; quantity: number; unitPrice: number; lineTotal: number; taxAmount: number }>;
  totals: { subtotal: number; discount: number; tax: number; total: number; amountPaid: number; changeDue: number };
  payments: Array<{ method: string; label: string; amount: number; tenderedAmount: number | null; reference: string | null; cardLast4: string | null; momoPhone: string | null }>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusVariant(status: string) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "PARTIALLY_REFUNDED") return "warning" as const;
  if (status === "REFUNDED" || status === "VOIDED") return "danger" as const;
  return "neutral" as const;
}

function paymentLabel(method: string) {
  return {
    CASH: "Cash",
    MOMO: "Mobile money",
    CARD_TERMINAL: "Ghana POS",
    CARD: "Card",
    BANK_TRANSFER: "Bank transfer",
    STORE_CREDIT: "Store credit",
    LOYALTY_POINTS: "Loyalty points",
    VOUCHER: "Voucher",
  }[method] ?? method;
}

export function SalesWorkspace({ sales, staff, canViewAll }: SalesWorkspaceProps) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [selectedSale, setSelectedSale] = useState<SalesWorkspaceRow | null>(null);
  const [savedReceipt, setSavedReceipt] = useState<SavedReceipt | null>(null);
  const [printing, setPrinting] = useState(false);
  const [canReprintCurrent, setCanReprintCurrent] = useState(false);

  useEffect(() => {
    if (!selectedSale) return;
    let cancelled = false;
    api.get<{ permissions: string[] }>("/auth/me")
      .then((user) => {
        if (!cancelled) setCanReprintCurrent(user.permissions.includes(PERMISSIONS.POS_REPRINT_RECEIPT));
      })
      .catch(() => {
        if (!cancelled) setCanReprintCurrent(false);
      });
    return () => { cancelled = true; };
  }, [selectedSale]);

  useEffect(() => {
    if (!savedReceipt) return;
    const frame = window.requestAnimationFrame(() => window.print());
    const finish = () => {
      setSavedReceipt(null);
      setPrinting(false);
    };
    window.addEventListener("afterprint", finish, { once: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", finish);
    };
  }, [savedReceipt]);

  async function reprintReceipt() {
    if (!selectedSale || printing) return;
    setPrinting(true);
    try {
      const receipt = await api.get<Omit<SavedReceipt, "qrSvg">>(`/receipts/${selectedSale.id}`);
      const formatAmount = (amount: number) =>
        `${receipt.currency} ${new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
      const qrText = [
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
      const qrSvg = await QRCode.toString(qrText, { type: "svg", errorCorrectionLevel: "M", margin: 1, width: 180 });
      setSavedReceipt({ ...receipt, qrSvg });
    } catch (error) {
      toast.error("Could not print receipt", error instanceof ApiClientError ? error.message : "Please try again.");
      setPrinting(false);
    }
  }

  const filteredSales = useMemo(() => {
    const normalizedSearch = search.toLowerCase();
    return sales.filter((sale) => {
      const matchesCashier = !cashierId || sale.cashierId === cashierId;
      const matchesSearch =
        !normalizedSearch ||
        sale.receiptNumber.toLowerCase().includes(normalizedSearch) ||
        sale.cashierName.toLowerCase().includes(normalizedSearch) ||
        paymentLabel(sale.paymentMethod).toLowerCase().includes(normalizedSearch) ||
        sale.status.toLowerCase().includes(normalizedSearch);
      return matchesCashier && matchesSearch;
    });
  }, [cashierId, sales, search]);

  return (
    <>
    <Card className="mt-4">
      <CardHeader className="flex-col items-stretch gap-4 sm:flex-row sm:items-center">
        <CardTitle>Transaction history</CardTitle>
        <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onSearch={setSearch}
            placeholder="Search receipt, staff or payment..."
            className="sm:w-72"
          />
          {canViewAll && (
            <Select
              aria-label="Filter sales by staff"
              value={cashierId}
              onChange={(event) => setCashierId(event.target.value)}
              options={staff.map((member) => ({ value: member.id, label: member.name }))}
              placeholder="All staff"
              containerClassName="sm:w-52"
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredSales.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="font-medium text-fg">No matching transactions</p>
            <p className="mt-1 text-sm text-fg-muted">Try a different search or staff filter.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-muted/60">
                    {["Receipt", "Cashier", "Payment", "Items", "Total", "Status"].map((label) => (
                      <th
                        key={label}
                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-fg-muted ${
                          label === "Items" || label === "Total" ? "text-right" : "text-left"
                        }`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} onClick={() => setSelectedSale(sale)} className="cursor-pointer border-b border-line last:border-0 hover:bg-muted/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-fg">{sale.receiptNumber}</p>
                        <p className="mt-0.5 text-xs text-fg-muted">{formatDate(sale.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3 text-fg-secondary">{sale.cashierName}</td>
                      <td className="px-4 py-3 text-fg-secondary">{paymentLabel(sale.paymentMethod)}</td>
                      <td className="px-4 py-3 text-right tabular">{sale.itemCount}</td>
                      <td className="px-4 py-3 text-right">
                        <Money value={sale.total} className="font-semibold text-fg" />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(sale.status)} size="sm">
                          {sale.status.replaceAll("_", " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {filteredSales.map((sale) => (
                <li key={sale.id} onClick={() => setSelectedSale(sale)} className="cursor-pointer space-y-2 px-4 py-3 active:bg-muted">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-fg">{sale.receiptNumber}</p>
                      <p className="mt-0.5 text-xs text-fg-muted">
                        {formatDate(sale.createdAt)} · {sale.cashierName}
                      </p>
                    </div>
                    <Badge variant={statusVariant(sale.status)} size="sm">
                      {sale.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-fg-muted">{paymentLabel(sale.paymentMethod)} · {sale.itemCount} items</span>
                    <Money value={sale.total} className="font-semibold text-fg" />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
    <Modal
      open={Boolean(selectedSale)}
      onClose={() => setSelectedSale(null)}
      title={selectedSale ? `Receipt ${selectedSale.receiptNumber}` : "Receipt details"}
      description={selectedSale ? `${formatDate(selectedSale.createdAt)} · ${selectedSale.cashierName}` : undefined}
      size="md"
      footer={
        <>
          {canReprintCurrent && <Button variant="outline" leftIcon={<Printer className="size-4" />} loading={printing} onClick={reprintReceipt}>Print receipt</Button>}
          <Button variant="outline" fullWidth className="sm:w-auto" onClick={() => setSelectedSale(null)}>Close</Button>
        </>
      }
    >
      {selectedSale && (
        <div className={`space-y-4${savedReceipt ? " no-print" : ""}`}>
          <div className="rounded-xl border border-line bg-muted p-4">
            <p className="mb-3 font-semibold text-fg">Items purchased</p>
            <div className="space-y-3">
              {selectedSale.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">{item.name}</p>
                    <p className="text-xs text-fg-muted">{item.quantity} × <Money value={item.unitPrice} /></p>
                  </div>
                  <Money value={item.lineTotal} className="shrink-0 font-semibold text-fg" />
                </div>
              ))}
            </div>
          </div>
          <dl className="space-y-2 rounded-xl bg-muted p-4 text-sm">
            <div className="flex justify-between"><dt className="text-fg-secondary">Subtotal</dt><dd><Money value={selectedSale.subtotal} /></dd></div>
            <div className="flex justify-between"><dt className="text-fg-secondary">Tax</dt><dd><Money value={selectedSale.tax} /></dd></div>
            <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt className="text-fg">Total amount</dt><dd><Money value={selectedSale.total} /></dd></div>
            <div className="flex justify-between"><dt className="text-fg-secondary">Amount paid</dt><dd><Money value={selectedSale.amountPaid} /></dd></div>
            <div className="flex justify-between"><dt className="text-fg-secondary">Change due</dt><dd><Money value={selectedSale.changeDue} /></dd></div>
            <div className="flex justify-between"><dt className="text-fg-secondary">Payment</dt><dd className="text-right text-fg">{selectedSale.payments.map((payment) => paymentLabel(payment.method)).join(", ")}</dd></div>
          </dl>
        </div>
      )}
      {savedReceipt && (
        <div className="print-sheet space-y-3 text-sm">
          <header className="text-center">
            <p className="font-bold">{savedReceipt.store.name}</p>
            <p>Branch: {savedReceipt.store.branchCode}</p>
            {savedReceipt.store.addressLine && <p>{savedReceipt.store.addressLine}{savedReceipt.store.city ? `, ${savedReceipt.store.city}` : ""}</p>}
            {savedReceipt.store.phone && <p>{savedReceipt.store.phone}</p>}
            {savedReceipt.store.tinNumber && <p>TIN: {savedReceipt.store.tinNumber}</p>}
            {savedReceipt.store.vatNumber && <p>VAT: {savedReceipt.store.vatNumber}</p>}
            <p className="mt-2 font-semibold">Receipt: {savedReceipt.receiptNumber}</p>
            <p>{formatDate(savedReceipt.issuedAt)}</p>
            <p>Cashier: {savedReceipt.cashier}</p>
            {savedReceipt.customer && <p>Customer: {savedReceipt.customer.name}{savedReceipt.customer.phone ? ` · ${savedReceipt.customer.phone}` : ""}</p>}
          </header>
          <div className="space-y-2">
            <p className="font-semibold">Items purchased</p>
            {savedReceipt.items.map((item, index) => (
              <div key={`${item.sku}-${index}`} className="flex justify-between gap-3 border-b border-dashed border-line pb-1.5">
                <span>{item.quantity} x {item.name}<span className="block text-xs">@ <Money value={item.unitPrice} /></span></span>
                <Money value={item.lineTotal} className="shrink-0 font-medium" />
              </div>
            ))}
          </div>
          <dl className="space-y-1.5 border-t border-line pt-2">
            <div className="flex justify-between"><dt>Subtotal</dt><dd><Money value={savedReceipt.totals.subtotal} /></dd></div>
            {savedReceipt.totals.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>-<Money value={savedReceipt.totals.discount} /></dd></div>}
            <div className="flex justify-between"><dt>Tax</dt><dd><Money value={savedReceipt.totals.tax} /></dd></div>
            <div className="flex justify-between font-semibold"><dt>Total</dt><dd><Money value={savedReceipt.totals.total} /></dd></div>
            <div className="flex justify-between"><dt>Amount paid</dt><dd><Money value={savedReceipt.totals.amountPaid} /></dd></div>
            <div className="flex justify-between"><dt>Change</dt><dd><Money value={savedReceipt.totals.changeDue} /></dd></div>
          </dl>
          <div className="text-center">
            <p>Payment: {savedReceipt.payments.map((payment) => payment.label).join(", ")}</p>
            {savedReceipt.store.footer && <p className="mt-2">{savedReceipt.store.footer}</p>}
            <div className="mt-3 flex justify-center" role="img" aria-label={`QR code with details for receipt ${savedReceipt.receiptNumber}`} dangerouslySetInnerHTML={{ __html: savedReceipt.qrSvg }} />
            <p className="print-brand-footer mt-2 text-xs">POS by First Dest (0598925563)</p>
          </div>
        </div>
      )}
    </Modal>
    </>
  );
}
