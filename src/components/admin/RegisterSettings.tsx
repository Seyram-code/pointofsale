"use client";

import { useState } from "react";
import { Pencil, Save } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type RegisterRecord = {
  id: string;
  name: string;
  code: string;
  terminalId: string | null;
  isActive: boolean;
};

const emptyDraft = () => ({ id: "", name: "", terminalId: "", isActive: true });

export function RegisterSettings({ initialRegisters }: { initialRegisters: RegisterRecord[] }) {
  const [registers, setRegisters] = useState(initialRegisters);
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
    if (!name) {
      setError("Register name is required.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = {
        name,
        terminalId: draft.terminalId.trim() || null,
        ...(draft.id ? { isActive: draft.isActive } : {}),
      };
      const register = draft.id
        ? await api.patch<RegisterRecord>(`/settings/registers/${draft.id}`, payload)
        : await api.post<RegisterRecord>("/settings/registers", payload);

      setRegisters((current) => draft.id
        ? current.map((item) => item.id === register.id ? register : item)
        : [...current, register].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)));
      setMessage(draft.id ? "Register updated." : "Register added.");
      resetDraft();
    } catch (submitError) {
      setError(submitError instanceof ApiClientError ? submitError.message : "Could not save the register.");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(register: RegisterRecord) {
    setMessage(null);
    setError(null);
    setDraft({
      id: register.id,
      name: register.name,
      terminalId: register.terminalId ?? "",
      isActive: register.isActive,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registers and tills</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-fg-muted">
          Add a till here, then select it when opening a shift. Active registers appear in the shift register list.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Register name"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="Front counter"
          />
          <Input
            label="Terminal ID (optional)"
            value={draft.terminalId}
            onChange={(event) => setDraft((current) => ({ ...current, terminalId: event.target.value }))}
            placeholder="Card terminal serial or TID"
          />
        </div>
        <p className="text-xs text-fg-muted">A unique register code will be generated automatically when you add the till.</p>

        {draft.id && (
          <label className="inline-flex items-center gap-2 text-sm text-fg-secondary">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Active (available for new shifts)
          </label>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button leftIcon={<Save className="size-4" />} loading={saving} onClick={handleSubmit}>
            {draft.id ? "Save changes" : "Add register"}
          </Button>
          {draft.id && <Button variant="outline" onClick={resetDraft}>Cancel</Button>}
          {message && <span className="text-sm text-success">{message}</span>}
          {error && <span className="text-sm text-danger">{error}</span>}
        </div>

        <div className="space-y-3">
          {registers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-strong bg-muted/40 p-4 text-sm text-fg-muted">
              No registers set up yet. Add one above to make it available when opening a shift.
            </div>
          ) : (
            registers.map((register) => (
              <div key={register.id} className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-fg">{register.name}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-fg-secondary">{register.code}</span>
                    {!register.isActive && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-fg-muted">Inactive</span>}
                  </div>
                  {register.terminalId && <p className="mt-1 text-sm text-fg-muted">Terminal ID: {register.terminalId}</p>}
                </div>
                <Button variant="outline" size="sm" leftIcon={<Pencil className="size-3.5" />} onClick={() => handleEdit(register)}>
                  Edit
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
