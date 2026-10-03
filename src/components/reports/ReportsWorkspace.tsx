"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Download, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/StatCard";
import { api, buildQuery } from "@/lib/api/client";
import type { ReportData } from "@/lib/services/report.service";

type Period = "daily" | "weekly" | "monthly" | "yearly";

export function ReportsWorkspace({ initialData, canViewAll, currentUserId }: { initialData: ReportData | null; canViewAll: boolean; currentUserId: string }) {
  const [data, setData] = useState<ReportData | null>(initialData);
  const [period, setPeriod] = useState<Period>("daily");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cashierId, setCashierId] = useState(canViewAll ? "" : currentUserId);
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [productId, setProductId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api.get<ReportData>(`/reports${buildQuery({ period, from, to, cashierId, paymentMethod, productId, categoryId })}`);
      setData(next);
    } finally {
      setLoading(false);
    }
  }, [categoryId, cashierId, from, paymentMethod, period, productId, to]);

  useEffect(() => {
    if (period === "daily" && !from && !to && !cashierId && paymentMethod === "all" && !productId && !categoryId) return;
    const timer = setTimeout(() => void loadReport(), 250);
    return () => clearTimeout(timer);
  }, [categoryId, cashierId, from, loadReport, paymentMethod, period, productId, to]);

  const summary = data?.summary;
  const title = period === "daily" ? "Daily report" : period === "weekly" ? "Weekly report" : period === "monthly" ? "Monthly report" : "Yearly report";

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Metric", "Value"],
      ["Period", `${data.range.from} to ${data.range.to}`],
      ["Total sales", data.summary.totalSales],
      ["Transactions", data.summary.transactions],
      ["Products sold", data.summary.productsSold],
      ["Cash sales", data.summary.cashSales],
      ["MoMo sales", data.summary.momoSales],
      ["Ghana POS sales", data.summary.ghanaPosSales],
      ["Card sales", data.summary.cardSales],
      ["Discounts", data.summary.discounts],
      ["Refunds", data.summary.refunds],
      ["Cost of goods sold", data.summary.costOfGoods],
      ["Gross profit", data.summary.grossProfit],
      ["Average transaction value", data.summary.averageTransactionValue],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `vidypos-${period}-report-${data.range.from}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="print-area">
      <PageHeader
        title="Reports"
        description="Sales, payment and profitability reporting for your store."
        actions={<div className="flex flex-wrap gap-2"><Button variant="outline" leftIcon={<FileSpreadsheet className="size-4" />} onClick={exportCsv}>CSV / Excel</Button><Button variant="outline" leftIcon={<Printer className="size-4" />} onClick={() => window.print()}>PDF / Print</Button></div>}
      />

      <div className="mb-4 grid gap-3 rounded-card border border-line bg-card p-3 sm:grid-cols-2 lg:grid-cols-4 sm:p-4">
        <Select label="Report period" value={period} onChange={(event) => setPeriod(event.target.value as Period)} options={[{ value: "daily", label: "Daily report" }, { value: "weekly", label: "Weekly report" }, { value: "monthly", label: "Monthly report" }, { value: "yearly", label: "Yearly report" }]} />
        <Input label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <Input label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <Select label="Payment method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} options={[{ value: "all", label: "All methods" }, { value: "CASH", label: "Cash" }, { value: "MOMO", label: "MoMo" }, { value: "CARD_TERMINAL", label: "Ghana POS" }, { value: "CARD", label: "Card" }]} />
        {canViewAll ? <Select label="Cashier" value={cashierId} onChange={(event) => setCashierId(event.target.value)} placeholder="All cashiers" options={(data?.cashiers ?? []).map((cashier) => ({ value: cashier.id, label: cashier.name }))} /> : <div className="flex items-end pb-2 text-sm text-fg-muted">Showing your sales only</div>}
        <Select label="Product" value={productId} onChange={(event) => setProductId(event.target.value)} placeholder="All products" options={(data?.products ?? []).map((product) => ({ value: product.id, label: `${product.name} · ${product.sku}` }))} />
        <Select label="Category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} placeholder="All categories" options={(data?.categories ?? []).map((category) => ({ value: category.id, label: category.name }))} />
        <div className="flex items-end"><Button variant="ghost" leftIcon={<Download className="size-4" />} onClick={exportCsv}>Export filtered data</Button></div>
      </div>

      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-fg">{title}</h2><span className="text-sm text-fg-muted">{data?.range.from} – {data?.range.to}{loading ? " · Updating…" : ""}</span></div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total sales" value={<Money value={summary?.totalSales ?? 0} />} icon={<BarChart3 className="size-5" />} tone="brand" />
        <StatCard label="Transactions" value={String(summary?.transactions ?? 0)} hint="Completed sales" tone="accent" />
        <StatCard label="Products sold" value={String(summary?.productsSold ?? 0)} hint="Units" tone="neutral" />
        <StatCard label="Average transaction" value={<Money value={summary?.averageTransactionValue ?? 0} />} tone="success" />
        <StatCard label="Cash sales" value={<Money value={summary?.cashSales ?? 0} />} tone="success" />
        <StatCard label="MoMo sales" value={<Money value={summary?.momoSales ?? 0} />} tone="accent" />
        <StatCard label="Ghana POS sales" value={<Money value={summary?.ghanaPosSales ?? 0} />} tone="brand" />
        <StatCard label="Card sales" value={<Money value={summary?.cardSales ?? 0} />} tone="neutral" />
        <StatCard label="Discounts" value={<Money value={summary?.discounts ?? 0} />} tone="danger" />
        <StatCard label="Refunds" value={<Money value={summary?.refunds ?? 0} />} tone="danger" />
        <StatCard label="Cost of goods" value={<Money value={summary?.costOfGoods ?? 0} />} tone="neutral" />
        <StatCard label="Gross profit" value={<Money value={summary?.grossProfit ?? 0} />} tone="success" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SalesTrendChart data={data?.chart ?? []} />
        <PaymentBreakdown summary={summary} />
      </div>

      <Card className="mt-4"><CardHeader><CardTitle>Top products</CardTitle></CardHeader><CardContent className="p-0"><div className="divide-y divide-[var(--border-base)]">{(data?.topProducts ?? []).map((product, index) => <div key={`${product.sku}-${index}`} className="flex items-center gap-3 px-4 py-3"><span className="flex size-7 items-center justify-center rounded-lg bg-muted text-xs tabular">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-fg">{product.name}</p><p className="text-xs text-fg-muted">{product.sku} · {product.quantity} sold</p></div><Money value={product.sales} className="font-semibold" /></div>)}</div></CardContent></Card>
    </div>
  );
}

function SalesTrendChart({ data }: { data: ReportData["chart"] }) {
  const max = Math.max(...data.map((point) => point.sales), 1);
  return <Card><CardHeader><CardTitle>Sales trend</CardTitle></CardHeader><CardContent><div className="flex h-56 items-end gap-2">{data.length === 0 ? <p className="w-full text-center text-sm text-fg-muted">No sales in this period.</p> : data.map((point) => <div key={point.date} className="group flex h-full flex-1 flex-col justify-end" title={`${point.label}: GH₵${point.sales.toFixed(2)}`}><div className="rounded-t-md bg-brand-600 transition-colors group-hover:bg-brand-400" style={{ height: `${Math.max((point.sales / max) * 100, point.sales > 0 ? 4 : 1)}%` }} /><span className="mt-2 truncate text-center text-[11px] text-fg-muted">{point.label}</span></div>)}</div></CardContent></Card>;
}

function PaymentBreakdown({ summary }: { summary: ReportData["summary"] | undefined }) {
  const values = [{ label: "Cash", value: summary?.cashSales ?? 0, color: "bg-success" }, { label: "MoMo", value: summary?.momoSales ?? 0, color: "bg-accent-500" }, { label: "Ghana POS", value: summary?.ghanaPosSales ?? 0, color: "bg-brand-600" }, { label: "Card", value: summary?.cardSales ?? 0, color: "bg-info" }];
  const total = values.reduce((sum, item) => sum + item.value, 0);
  return <Card><CardHeader><CardTitle>Payment mix</CardTitle></CardHeader><CardContent className="space-y-4">{values.map((item) => <div key={item.label}><div className="mb-1 flex justify-between text-sm"><span className="text-fg-secondary">{item.label}</span><Money value={item.value} className="text-sm font-medium" /></div><div className="h-2 overflow-hidden rounded-full bg-inset"><div className={`h-full ${item.color}`} style={{ width: `${total ? (item.value / total) * 100 : 0}%` }} /></div></div>)}</CardContent></Card>;
}
