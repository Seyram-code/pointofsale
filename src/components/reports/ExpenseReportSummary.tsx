"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Money } from "@/components/ui/Money";
import { api, buildQuery } from "@/lib/api/client";

interface ExpenseSummary {
  total: number;
  count: number;
  categories: Array<{ category: string; label: string; amount: number }>;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function ExpenseReportSummary() {
  const [to, setTo] = useState(() => dateKey(new Date()));
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 29);
    return dateKey(date);
  });
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.get<ExpenseSummary>(`/expenses${buildQuery({ from, to })}`)
      .then((data) => { if (!cancelled) { setSummary(data); setError(""); } })
      .catch((loadError) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load expense summary"); });
    return () => { cancelled = true; };
  }, [from, to]);

  return (
    <Card className="mt-6">
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center">
        <div><CardTitle>Operating expense summary</CardTitle><p className="mt-1 text-sm text-fg-muted">Separate from stock purchases and gross profit.</p></div>
        <div className="grid w-full gap-3 sm:ml-auto sm:w-auto sm:grid-cols-2">
          <Input label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      </CardHeader>
      <CardContent>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : !summary ? <p className="text-sm text-fg-muted">Loading expense totals…</p> : (
          <div className="grid gap-5 sm:grid-cols-[1fr_2fr]">
            <div><p className="text-sm text-fg-muted">Recorded expenses · {summary.count} items</p><Money value={summary.total} size="lg" className="mt-1 block text-danger" /></div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {summary.categories.map((item) => <div key={item.category} className="flex justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="text-fg-secondary">{item.label}</span><Money value={item.amount} className="font-medium text-fg" /></div>)}
              {!summary.categories.length && <p className="text-sm text-fg-muted">No expenses recorded in this period.</p>}
            </div>
          </div>
        )}
        <p className="mt-4 text-xs leading-5 text-fg-muted">This summary reflects recorded operating expenses only; it is not a net-profit calculation.</p>
      </CardContent>
    </Card>
  );
}
