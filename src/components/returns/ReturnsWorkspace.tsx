"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { api, ApiClientError } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";

export interface ReturnRow {
  id: string;
  returnNumber: string;
  saleReceipt: string;
  customerName: string;
  reason: string;
  refundMethod: string;
  total: number;
  status: string;
  createdAt: string;
}

interface SaleLookup {
  id: string;
  receiptNumber: string;
  customer: { fullName: string } | null;
  items: Array<{ id: string; name: string; availableQuantity: number; unitPrice: number }>;
}

interface ReturnsWorkspaceProps {
  returns: ReturnRow[];
  canCreate: boolean;
  canApprove: boolean;
}

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusVariant(status: string) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "REJECTED") return "danger" as const;
  if (status === "APPROVED") return "info" as const;
  return "warning" as const;
}

function refundLabel(method: string) {
  return method.replaceAll("_", " ").toLowerCase().replace(/(^| )\S/g, (letter) => letter.toUpperCase());
}

export function ReturnsWorkspace({ returns, canCreate, canApprove }: ReturnsWorkspaceProps) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("CASH");
  const [lookup, setLookup] = useState<SaleLookup | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const filteredReturns = useMemo(() => {
    const normalizedQuery = query.toLowerCase();
    return returns.filter((item) => {
      const matchesStatus = !status || item.status === status;
      const matchesQuery =
        !normalizedQuery ||
        item.returnNumber.toLowerCase().includes(normalizedQuery) ||
        item.saleReceipt.toLowerCase().includes(normalizedQuery) ||
        item.customerName.toLowerCase().includes(normalizedQuery) ||
        item.reason.toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [query, returns, status]);

  const selectedReturnTotal = useMemo(
    () => lookup?.items.reduce((total, item) => total + Math.min(Number(quantities[item.id] || 0), item.availableQuantity) * item.unitPrice, 0) ?? 0,
    [lookup, quantities],
  );

  const hasSelectedItems = selectedReturnTotal > 0;

  async function findSale() {
    setBusy(true);
    try {
      const sale = await api.get<SaleLookup>(`/returns?receiptNumber=${encodeURIComponent(receiptNumber)}`);
      setLookup(sale);
      setQuantities(Object.fromEntries(sale.items.map((item) => [item.id, "0"])));
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Could not find that sale");
      setLookup(null);
    } finally {
      setBusy(false);
    }
  }

  async function createReturn(event: React.FormEvent) {
    event.preventDefault();
    if (!lookup) return;
    const items = lookup.items
      .map((item) => ({ saleItemId: item.id, quantity: Number(quantities[item.id] || 0) }))
      .filter((item) => item.quantity > 0);
    if (!items.length) {
      toast.error("Choose at least one item to return");
      return;
    }
    setBusy(true);
    try {
      await api.post("/returns", { receiptNumber: lookup.receiptNumber, reason, refundMethod, restock: true, items });
      toast.success("Return request created", "The return is waiting for approval.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Could not create return request");
    } finally {
      setBusy(false);
    }
  }

  function setReturnQuantity(itemId: string, value: string, maximum: number) {
    const parsed = Number(value);
    const clamped = value === "" ? "" : Number.isFinite(parsed) ? String(Math.min(Math.max(parsed, 0), maximum)) : "0";
    setQuantities((current) => ({ ...current, [itemId]: clamped }));
  }

  async function updateReturn(id: string, action: "APPROVE" | "REJECT" | "COMPLETE") {
    setBusy(true);
    try {
      await api.patch(`/returns/${id}`, { action });
      if (action === "APPROVE") {
        await api.patch(`/returns/${id}`, { action: "COMPLETE" });
      }
      toast.success(action === "APPROVE" ? "Refund approved and completed" : action === "REJECT" ? "Return rejected" : "Refund completed");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Could not update return");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {canCreate && (
        <Card className="mb-4">
          <CardHeader className="flex-row items-center">
            <CardTitle>Create return request</CardTitle>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setShowForm((value) => !value)}>
              {showForm ? "Close" : "New return"}
            </Button>
          </CardHeader>
          {showForm && (
            <CardContent>
              <form onSubmit={createReturn} className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <Input label="Receipt number" value={receiptNumber} onChange={(event) => setReceiptNumber(event.target.value)} placeholder="e.g. RCP-202609-00014" required containerClassName="sm:max-w-sm" />
                  <Button type="button" variant="outline" loading={busy} onClick={() => void findSale()}>Find sale</Button>
                </div>
                {lookup && (
                  <div className="space-y-4 rounded-lg border border-line bg-muted p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
                      <div>
                        <p className="text-sm font-semibold text-fg">Purchased items</p>
                        <p className="mt-0.5 text-xs text-fg-muted">
                          {lookup.receiptNumber} · {lookup.customer?.fullName ?? "Walk-in customer"}
                        </p>
                      </div>
                      <Badge variant="info" size="sm">{lookup.items.length} product{lookup.items.length === 1 ? "" : "s"}</Badge>
                    </div>
                    {lookup.items.length === 0 ? (
                      <p className="text-sm text-fg-muted">No refundable products were found on this sale.</p>
                    ) : (
                      <div className="space-y-2">
                        {lookup.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 rounded-md bg-card px-3 py-2 text-sm">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-fg">{item.name}</p>
                              <p className="text-xs text-fg-muted">{item.availableQuantity} available · GHS {item.unitPrice.toFixed(2)} paid per item</p>
                            </div>
                            <Input aria-label={`Quantity returned for ${item.name}`} type="number" min="0" max={item.availableQuantity} step="1" value={quantities[item.id] ?? "0"} onChange={(event) => setReturnQuantity(item.id, event.target.value, item.availableQuantity)} containerClassName="w-24 shrink-0" />
                            <div className="w-28 shrink-0 text-right">
                              <Money value={item.unitPrice} className="font-semibold text-fg" />
                              <p className="text-[11px] text-fg-muted">unit price</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select label="Refund method" value={refundMethod} onChange={(event) => setRefundMethod(event.target.value)} options={[{ value: "CASH", label: "Cash" }, { value: "MOMO", label: "Mobile money" }, { value: "CARD_REVERSAL", label: "Card reversal" }, { value: "STORE_CREDIT", label: "Store credit" }, { value: "EXCHANGE", label: "Exchange" }]} />
                  <Textarea label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this item being returned?" required rows={2} />
                </div>
                <div className="flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-fg-secondary">Estimated refund: <Money value={selectedReturnTotal} className="font-semibold text-fg" /></p>
                  <Button type="submit" loading={busy} disabled={!lookup || !hasSelectedItems || !reason.trim()}>Submit return request</Button>
                </div>
              </form>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
      <CardHeader className="flex-col items-stretch gap-4 sm:flex-row sm:items-center">
        <CardTitle>Returns list</CardTitle>
        <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center">
          <SearchInput
            value={query}
            onSearch={setQuery}
            placeholder="Search return, receipt or customer..."
            className="sm:w-72"
          />
          <Select
            aria-label="Filter returns by status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={STATUS_OPTIONS}
            placeholder="All statuses"
            containerClassName="sm:w-44"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredReturns.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="font-medium text-fg">No matching returns</p>
            <p className="mt-1 text-sm text-fg-muted">Try a different search or status filter.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-muted/60">
                    {[
                      ["Return", "text-left"],
                      ["Sale", "text-left"],
                      ["Customer", "text-left"],
                      ["Refund method", "text-left"],
                      ["Amount", "text-right"],
                      ["Status", "text-left"],
                      ...(canApprove ? [["Actions", "text-left"]] : []),
                    ].map(([label, align]) => (
                      <th key={label} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-fg-muted ${align}`}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredReturns.map((item) => (
                    <tr key={item.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3"><p className="font-medium text-fg">{item.returnNumber}</p><p className="mt-0.5 text-xs text-fg-muted">{formatDate(item.createdAt)} · {item.reason}</p></td>
                      <td className="px-4 py-3 text-fg-secondary">{item.saleReceipt}</td>
                      <td className="px-4 py-3 text-fg-secondary">{item.customerName}</td>
                      <td className="px-4 py-3 text-fg-secondary">{refundLabel(item.refundMethod)}</td>
                      <td className="px-4 py-3 text-right"><Money value={item.total} className="font-semibold text-fg" /></td>
                      <td className="px-4 py-3"><Badge variant={statusVariant(item.status)} size="sm">{item.status}</Badge></td>
                      {canApprove && <td className="px-4 py-3"><div className="flex gap-2">{item.status === "PENDING" && <><Button size="sm" onClick={() => void updateReturn(item.id, "APPROVE")} disabled={busy}>Approve</Button><Button size="sm" variant="outline" onClick={() => void updateReturn(item.id, "REJECT")} disabled={busy}>Reject</Button></>}{item.status === "APPROVED" && <Button size="sm" onClick={() => void updateReturn(item.id, "COMPLETE")} disabled={busy}>Complete refund</Button>}</div></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {filteredReturns.map((item) => (
                <li key={item.id} className="space-y-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-sm font-medium text-fg">{item.returnNumber}</p><p className="mt-0.5 text-xs text-fg-muted">{item.saleReceipt} · {formatDate(item.createdAt)}</p></div>
                    <Badge variant={statusVariant(item.status)} size="sm">{item.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-fg-muted">{item.customerName} · {refundLabel(item.refundMethod)}</span><Money value={item.total} className="shrink-0 font-semibold text-fg" /></div>
                  <p className="text-xs text-fg-muted">{item.reason}</p>
                  {canApprove && item.status === "APPROVED" && <Button size="sm" className="w-full" onClick={() => void updateReturn(item.id, "COMPLETE")} disabled={busy}>Complete refund</Button>}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
      </Card>
    </>
  );
}
