"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Pencil, Plus, ReceiptText, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Money } from "@/components/ui/Money";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/StatCard";
import { api, buildQuery } from "@/lib/api/client";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_METHOD_LABELS,
} from "@/lib/validations/expense.schema";

interface ExpenseRecord {
  id: string;
  amount: number;
  category: (typeof EXPENSE_CATEGORIES)[number];
  description: string;
  expenseDate: string;
  paymentMethod: (typeof EXPENSE_PAYMENT_METHODS)[number];
  supplierName: string | null;
  receiptReference: string | null;
  createdBy: { fullName: string } | null;
}

interface ExpenseReport {
  range: { from: string; to: string };
  total: number;
  count: number;
  truncated: boolean;
  categories: Array<{ category: string; label: string; amount: number }>;
  expenses: ExpenseRecord[];
}

type ExpenseForm = {
  amount: string;
  category: ExpenseRecord["category"];
  description: string;
  expenseDate: string;
  paymentMethod: ExpenseRecord["paymentMethod"];
  supplierName: string;
  receiptReference: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const thirtyDaysAgo = () => new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function emptyForm(): ExpenseForm {
  return {
    amount: "",
    category: "OTHER",
    description: "",
    expenseDate: today(),
    paymentMethod: "CASH",
    supplierName: "",
    receiptReference: "",
  };
}

function escapeCsv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function ExpensesWorkspace({ canManage }: { canManage: boolean }) {
  const [report, setReport] = useState<ExpenseReport | null>(null);
  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<ExpenseReport>(`/expenses${buildQuery({ from, to, category, search })}`);
      setReport(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load expenses");
    } finally {
      setLoading(false);
    }
  }, [category, from, search, to]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadExpenses(), 200);
    return () => window.clearTimeout(timer);
  }, [loadExpenses]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const categoryOptions = useMemo(
    () => EXPENSE_CATEGORIES.map((value) => ({ value, label: EXPENSE_CATEGORY_LABELS[value] })),
    [],
  );

  function startCreate() {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setDialogOpen(true);
  }

  function startEdit(expense: ExpenseRecord) {
    setEditing(expense);
    setForm({
      amount: String(expense.amount),
      category: expense.category,
      description: expense.description,
      expenseDate: expense.expenseDate.slice(0, 10),
      paymentMethod: expense.paymentMethod,
      supplierName: expense.supplierName ?? "",
      receiptReference: expense.receiptReference ?? "",
    });
    setError("");
    setDialogOpen(true);
  }

  async function saveExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      amount: Number(form.amount),
      supplierName: form.supplierName || null,
      receiptReference: form.receiptReference || null,
    };
    try {
      if (editing) await api.patch(`/expenses/${editing.id}`, payload);
      else await api.post("/expenses", payload);
      setDialogOpen(false);
      await loadExpenses();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save expense");
    } finally {
      setSaving(false);
    }
  }

  async function removeExpense(expense: ExpenseRecord) {
    if (!window.confirm(`Remove "${expense.description}" (${Number(expense.amount).toFixed(2)}) from active expense records?`)) return;
    setError("");
    try {
      await api.delete(`/expenses/${expense.id}`);
      await loadExpenses();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not remove expense");
    }
  }

  function exportCsv() {
    if (!report) return;
    const rows: unknown[][] = [
      ["Date", "Description", "Category", "Amount (GHS)", "Payment method", "Supplier", "Receipt reference", "Recorded by"],
      ...report.expenses.map((expense) => [
        expense.expenseDate.slice(0, 10),
        expense.description,
        EXPENSE_CATEGORY_LABELS[expense.category],
        Number(expense.amount).toFixed(2),
        EXPENSE_PAYMENT_METHOD_LABELS[expense.paymentMethod],
        expense.supplierName,
        expense.receiptReference,
        expense.createdBy?.fullName,
      ]),
      [],
      ["Total expenses (GHS)", report.total.toFixed(2)],
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `vidypos-expenses-${report.range.from}-to-${report.range.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function setField<K extends keyof ExpenseForm>(key: K, value: ExpenseForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Track operating expenses separately from inventory purchases and sales."
        actions={<div className="flex flex-wrap gap-2">
          <Button variant="outline" leftIcon={<Download className="size-4" />} onClick={exportCsv} disabled={!report || report.expenses.length === 0}>Export CSV</Button>
          {canManage && <Button leftIcon={<Plus className="size-4" />} onClick={startCreate}>Record expense</Button>}
        </div>}
      />

      <div className="mb-4 grid gap-3 rounded-card border border-line bg-card p-3 sm:grid-cols-2 lg:grid-cols-4 sm:p-4">
        <Input label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <Input label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <Select label="Category" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="All categories" options={categoryOptions} />
        <label className="grid gap-1 text-sm font-medium text-fg">
          Search
          <span className="relative">
            <Search className="absolute left-3 top-3 size-4 text-fg-muted" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Description, supplier or receipt"
              className="h-11 w-full rounded-lg border border-line-strong bg-card pl-9 pr-3 text-sm text-fg outline-none focus:border-brand-600"
            />
          </span>
        </label>
      </div>

      {error && !dialogOpen && <p role="alert" className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>}
      {report?.truncated && <p role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">Showing the first 500 expenses. Narrow the date range or filters to see all matching records.</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <StatCard label="Total expenses" value={<Money value={report?.total ?? 0} />} icon={<ReceiptText className="size-5" />} tone="danger" />
        <StatCard label="Recorded items" value={String(report?.count ?? 0)} hint={`${report?.range.from ?? from} – ${report?.range.to ?? to}`} tone="neutral" />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <Card>
          <CardHeader><CardTitle>Expense records</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? <p className="p-6 text-sm text-fg-muted">Loading expenses…</p> : !report?.expenses.length ? (
              <div className="p-8 text-center"><ReceiptText className="mx-auto size-9 text-fg-muted" /><p className="mt-2 font-medium text-fg">No expenses found</p><p className="mt-1 text-sm text-fg-muted">Try a different date range or record an operating expense.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-line text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-fg-muted"><tr><th className="px-4 py-3">Date / Details</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3 text-right">Amount</th>{canManage && <th className="px-4 py-3 text-right">Actions</th>}</tr></thead>
                  <tbody className="divide-y divide-line">
                    {report.expenses.map((expense) => (
                      <tr key={expense.id} className="align-top">
                        <td className="px-4 py-3"><p className="font-medium text-fg">{expense.description}</p><p className="mt-0.5 text-xs text-fg-muted">{expense.expenseDate.slice(0, 10)} · {expense.createdBy?.fullName ?? "Staff removed"}</p>{expense.supplierName && <p className="mt-1 text-xs text-fg-secondary">Supplier: {expense.supplierName}</p>}{expense.receiptReference && <p className="text-xs text-fg-secondary">Receipt ref: {expense.receiptReference}</p>}</td>
                        <td className="px-4 py-3 text-fg-secondary">{EXPENSE_CATEGORY_LABELS[expense.category]}</td>
                        <td className="px-4 py-3 text-fg-secondary">{EXPENSE_PAYMENT_METHOD_LABELS[expense.paymentMethod]}</td>
                        <td className="px-4 py-3 text-right font-semibold text-fg"><Money value={expense.amount} /></td>
                        {canManage && <td className="px-4 py-3"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" aria-label={`Edit ${expense.description}`} onClick={() => startEdit(expense)}><Pencil className="size-4" /></Button><Button size="sm" variant="ghost" className="text-danger" aria-label={`Remove ${expense.description}`} onClick={() => void removeExpense(expense)}><Trash2 className="size-4" /></Button></div></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Totals by category</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!report?.categories.length ? <p className="text-sm text-fg-muted">Category totals will appear when expenses are recorded.</p> : report.categories.map((item) => (
              <div key={item.category} className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0">
                <span className="text-sm text-fg-secondary">{item.label}</span><Money value={item.amount} className="text-sm font-semibold text-fg" />
              </div>
            ))}
            <p className="border-t border-line pt-3 text-xs leading-5 text-fg-muted">Operating expenses only. Inventory purchases and stock costs are tracked separately; this is not a net-profit calculation.</p>
          </CardContent>
        </Card>
      </div>

      <Modal
        open={dialogOpen}
        onClose={() => { if (!saving) setDialogOpen(false); }}
        title={editing ? "Edit expense" : "Record expense"}
        description="Record operating costs here. Use purchase orders for stock bought for resale."
        footer={<><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button><Button type="submit" form="expense-form" loading={saving}>{editing ? "Save changes" : "Save expense"}</Button></>}
      >
        <form id="expense-form" onSubmit={saveExpense} className="grid gap-4 sm:grid-cols-2">
          {error && <p role="alert" className="rounded-lg bg-danger/5 p-3 text-sm text-danger sm:col-span-2">{error}</p>}
          <Input label="Amount (GHS)" type="number" min="0.01" max="1000000000" step="0.01" required value={form.amount} onChange={(event) => setField("amount", event.target.value)} />
          <Select label="Category" value={form.category} onChange={(event) => setField("category", event.target.value as ExpenseForm["category"])} options={categoryOptions} />
          <Input label="Description" required maxLength={500} value={form.description} onChange={(event) => setField("description", event.target.value)} containerClassName="sm:col-span-2" />
          <Input label="Expense date" type="date" required value={form.expenseDate} onChange={(event) => setField("expenseDate", event.target.value)} />
          <Select label="Payment method" value={form.paymentMethod} onChange={(event) => setField("paymentMethod", event.target.value as ExpenseForm["paymentMethod"])} options={EXPENSE_PAYMENT_METHODS.map((value) => ({ value, label: EXPENSE_PAYMENT_METHOD_LABELS[value] }))} />
          <Input label="Supplier / payee (optional)" maxLength={120} value={form.supplierName} onChange={(event) => setField("supplierName", event.target.value)} />
          <Input label="Receipt number / reference (optional)" maxLength={120} value={form.receiptReference} onChange={(event) => setField("receiptReference", event.target.value)} hint="Enter a receipt reference; file uploads are not supported." />
        </form>
      </Modal>
    </>
  );
}
