"use client";

import { useState } from "react";
import { CreditCard, LoaderCircle } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function PaymentProviderSettings({ initialPaystackEnabled, canManage }: { initialPaystackEnabled: boolean; canManage: boolean }) {
  const [enabled, setEnabled] = useState(initialPaystackEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function updateEnabled(nextEnabled: boolean) {
    setSaving(true);
    setError("");
    try {
      const result = await api.patch<{ paystackEnabled: boolean }>("/settings/payments", { paystackEnabled: nextEnabled });
      setEnabled(result.paystackEnabled);
    } catch (updateError) {
      setError(updateError instanceof ApiClientError ? updateError.message : "Could not update Paystack availability.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CreditCard className="size-5 text-brand-600" />Payment providers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-fg">Paystack payments</p>
            <p className="mt-1 max-w-xl text-sm text-fg-muted">Allow customers to pay by online card or Paystack Mobile Money checkout. Cash and Ghana POS terminal payments are not affected.</p>
          </div>
          <label className="inline-flex shrink-0 items-center gap-3 text-sm font-medium text-fg">
            <span>{enabled ? "Enabled" : "Disabled"}</span>
            <input
              type="checkbox"
              role="switch"
              aria-label="Enable Paystack payments"
              checked={enabled}
              disabled={!canManage || saving}
              onChange={(event) => void updateEnabled(event.target.checked)}
              className="size-5 accent-brand-600 disabled:opacity-60"
            />
            {saving && <LoaderCircle className="size-4 animate-spin text-fg-muted" aria-hidden="true" />}
          </label>
        </div>
        {!canManage && <p className="text-xs text-fg-muted">You need settings management permission to change this option.</p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
