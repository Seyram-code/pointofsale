"use client";

import { useState } from "react";
import { Check, Pencil, Save, Trash2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type TaxRateRecord = {
  id: string;
  name: string;
  rate: number;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
};

const emptyDraft = () => ({
  id: "",
  name: "",
  ratePercent: "21",
  description: "",
  isDefault: false,
  isActive: true,
});

export function TaxRateSettings({ initialTaxRates }: { initialTaxRates: TaxRateRecord[] }) {
  const [rates, setRates] = useState(initialTaxRates);
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetDraft() {
    setDraft(emptyDraft());
    setError(null);
  }

  async function handleSubmit() {
    const name = draft.name.trim();
    const ratePercent = Number(draft.ratePercent);

    if (!name) {
      setError("Tax rate name is required.");
      return;
    }
    if (Number.isNaN(ratePercent) || ratePercent < 0 || ratePercent > 100) {
      setError("Tax rate must be between 0% and 100%.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload = {
        name,
        rate: ratePercent / 100,
        description: draft.description.trim() || null,
        isDefault: draft.isDefault,
        isActive: draft.isActive,
      };

      let updatedRate: TaxRateRecord;
      if (draft.id) {
        updatedRate = await api.patch<TaxRateRecord>(`/settings/tax-rates/${draft.id}`, payload);
        setRates((current) => current.map((rate) => ({
          ...(rate.id === updatedRate.id ? updatedRate : rate),
          isDefault: updatedRate.isDefault ? rate.id === updatedRate.id : rate.id === updatedRate.id ? updatedRate.isDefault : rate.isDefault,
        })));
        setMessage("Tax rate updated.");
      } else {
        updatedRate = await api.post<TaxRateRecord>("/settings/tax-rates", payload);
        setRates((current) => [updatedRate, ...current.map((rate) => ({ ...rate, isDefault: updatedRate.isDefault ? false : rate.isDefault }))]);
        setMessage("Tax rate added.");
      }

      setDraft({
        id: "",
        name: "",
        ratePercent: updatedRate.rate ? String(Math.round(updatedRate.rate * 100)) : "0",
        description: updatedRate.description ?? "",
        isDefault: updatedRate.isDefault,
        isActive: updatedRate.isActive,
      });
    } catch (submitError) {
      setError(submitError instanceof ApiClientError ? submitError.message : "Could not save the tax rate.");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(rate: TaxRateRecord) {
    setError(null);
    setMessage(null);
    setDraft({
      id: rate.id,
      name: rate.name,
      ratePercent: String(rate.rate * 100),
      description: rate.description ?? "",
      isDefault: rate.isDefault,
      isActive: rate.isActive,
    });
  }

  async function handleDelete(rate: TaxRateRecord) {
    if (!window.confirm(`Remove the ${rate.name} tax rate?`)) return;

    try {
      await api.delete(`/settings/tax-rates/${rate.id}`);
      setRates((current) => current.filter((item) => item.id !== rate.id));
      if (draft.id === rate.id) resetDraft();
      setMessage("Tax rate removed.");
    } catch (deleteError) {
      setError(deleteError instanceof ApiClientError ? deleteError.message : "Could not remove the tax rate.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax rates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Input
            label="Tax rate name"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="Standard VAT"
          />
          <Input
            label="Rate (%)"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={draft.ratePercent}
            onChange={(event) => setDraft((current) => ({ ...current, ratePercent: event.target.value }))}
            placeholder="21"
          />
          <Input
            label="Description"
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            placeholder="VAT and levies"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-fg-secondary">
            <input
              type="checkbox"
              checked={draft.isDefault}
              onChange={(event) => setDraft((current) => ({ ...current, isDefault: event.target.checked }))}
            />
            Default rate
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-fg-secondary">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Active
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button leftIcon={<Save className="size-4" />} loading={saving} onClick={handleSubmit}>
            {draft.id ? "Save changes" : "Add tax rate"}
          </Button>
          {draft.id && (
            <Button variant="outline" onClick={resetDraft}>
              Cancel
            </Button>
          )}
          {message && <span className="text-sm text-success">{message}</span>}
          {error && <span className="text-sm text-danger">{error}</span>}
        </div>

        <div className="space-y-3">
          {rates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-strong bg-muted/40 p-4 text-sm text-fg-muted">
              No tax rates yet for this store.
            </div>
          ) : (
            rates.map((rate) => (
              <div key={rate.id} className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-fg">{rate.name}</p>
                    {rate.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                        <Check className="size-3" /> Default
                      </span>
                    )}
                    {!rate.isActive && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-fg-muted">Inactive</span>}
                  </div>
                  <p className="text-sm text-fg-muted">{(rate.rate * 100).toFixed(2)}% tax</p>
                  {rate.description && <p className="text-xs text-fg-muted">{rate.description}</p>}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" leftIcon={<Pencil className="size-3.5" />} onClick={() => handleEdit(rate)}>
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" leftIcon={<Trash2 className="size-3.5" />} onClick={() => handleDelete(rate)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

      </CardContent>
    </Card>
  );
}
