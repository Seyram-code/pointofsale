"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { api, buildQuery } from "@/lib/api/client";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
} from "@/lib/validations/expense.schema";

export interface ExpenseReportData {
  range: { from: string; to: string };
  total: number;
  count: number;
  truncated: boolean;
  categories: Array<{ category: string; label: string; amount: number }>;
  expenses: Array<{
    id: string;
    amount: number;
    category: (typeof EXPENSE_CATEGORIES)[number];
    description: string;
    expenseDate: string;
    paymentMethod: (typeof EXPENSE_PAYMENT_METHODS)[number];
  }>;
}

export function ExpenseReportSummary({
  from,
  to,
  onSummaryChange,
  onLoadingChange,
}: {
  from: string;
  to: string;
  onSummaryChange: (summary: ExpenseReportData | null) => void;
  onLoadingChange: (loading: boolean) => void;
}) {
  const [summary, setSummary] = useState<ExpenseReportData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    setError("");
    onSummaryChange(null);
    onLoadingChange(true);

    api.get<ExpenseReportData>(`/expenses${buildQuery({ from, to })}`)
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        setError("");
        onSummaryChange(data);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load expense summary");
        onSummaryChange(null);
      })
      .finally(() => {
        if (!cancelled) onLoadingChange(false);
      });
    return () => { cancelled = true; };
  }, [from, onLoadingChange, onSummaryChange, to]);

  return (
    <Card className="mt-6">
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center">
        <div>
          <CardTitle>Operating expense summary</CardTitle>
          <p className="mt-1 text-sm text-fg-muted">For {from} – {to}; separate from stock purchases and gross profit.</p>
        </div>
      </CardHeader>
      <CardContent>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : !summary ? <p className="text-sm text-fg-muted">Loading expense totals…</p> : (
          <div className="grid gap-5 sm:grid-cols-[1fr_2fr]">
            <div><p className="text-sm text-fg-muted">Recorded expenses · {summary.count} items</p><Money value={summary.total} size="lg" className="mt-1 block text-danger" /></div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {summary.categories.map((item) => <div key={item.category} className="flex justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="text-fg-secondary">{EXPENSE_CATEGORY_LABELS[item.category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? item.label}</span><Money value={item.amount} className="font-medium text-fg" /></div>)}
              {!summary.categories.length && <p className="text-sm text-fg-muted">No expenses recorded in this period.</p>}
            </div>
          </div>
        )}
        {summary?.truncated && <p className="mt-3 text-xs text-danger">Showing only the first 500 expenses. Narrow the selected report period to include all matching records.</p>}
        <p className="mt-4 text-xs leading-5 text-fg-muted">This summary reflects recorded operating expenses only; it is not a net-profit calculation.</p>
      </CardContent>
    </Card>
  );
}
