"use client";

import { useState } from "react";
import { Pencil, Power, Save, Truck, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { RegionSelect } from "@/components/ui/RegionSelect";
import { useToast } from "@/components/ui/Toast";

interface SupplierRecord {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  region: string | null;
  tinNumber: string | null;
  paymentTerms: string | null;
  creditLimit: unknown;
  balance: unknown;
  notes: string | null;
  isActive: boolean;
}

function SupplierFields({ supplier }: { supplier?: SupplierRecord }) {
  return <>
    <Input label="Supplier name" name="name" defaultValue={supplier?.name} required placeholder="e.g. Tema Food Market" />
    <Input label="Contact person" name="contactPerson" defaultValue={supplier?.contactPerson ?? ""} placeholder="Optional contact" />
    <Input label="Phone" name="phone" defaultValue={supplier?.phone ?? ""} placeholder="e.g. 024 000 0000" />
    <Input label="Email" name="email" type="email" defaultValue={supplier?.email ?? ""} placeholder="Optional email" />
    <Input label="Address" name="addressLine" defaultValue={supplier?.addressLine ?? ""} placeholder="Optional address" />
    <Input label="City" name="city" defaultValue={supplier?.city ?? ""} placeholder="Optional city" />
    <RegionSelect label="Region" name="region" defaultValue={supplier?.region ?? ""} placeholder="Select region" />
    <Input label="TIN number" name="tinNumber" defaultValue={supplier?.tinNumber ?? ""} placeholder="Optional TIN" />
    <Input label="Payment terms" name="paymentTerms" defaultValue={supplier?.paymentTerms ?? ""} placeholder="e.g. Net 30" />
    <Input label="Credit limit (GHS)" name="creditLimit" type="number" min="0" step="0.01" defaultValue={supplier ? String(supplier.creditLimit) : "0"} />
    <Input label="Notes" name="notes" defaultValue={supplier?.notes ?? ""} placeholder="Optional notes" />
  </>;
}

export function SupplierManagement({ initialSuppliers }: { initialSuppliers: SupplierRecord[] }) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SupplierRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());

    try {
      if (editing) {
        const updated = await api.patch<SupplierRecord>(`/suppliers/${editing.id}`, values);
        setSuppliers((current) => current.map((supplier) => supplier.id === updated.id ? { ...supplier, ...updated, ...values, creditLimit: values.creditLimit } : supplier));
        toast.success("Supplier updated", "Supplier details were saved successfully.");
      } else {
        await api.post("/suppliers", values);
        toast.success("Supplier added", "The supplier was created successfully.");
        window.setTimeout(() => window.location.reload(), 500);
      }
      setEditing(null);
      setShowForm(false);
    } catch (submissionError) {
      setError(submissionError instanceof ApiClientError ? submissionError.message : "Unable to save supplier.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(supplier: SupplierRecord) {
    setBusy(true);
    setError("");
    try {
      const updated = await api.patch<SupplierRecord>(`/suppliers/${supplier.id}`, { isActive: !supplier.isActive });
      setSuppliers((current) => current.map((item) => item.id === supplier.id ? { ...item, isActive: updated.isActive } : item));
      toast.success(updated.isActive ? "Supplier enabled" : "Supplier disabled", `${supplier.name} was updated successfully.`);
    } catch (statusError) {
      setError(statusError instanceof ApiClientError ? statusError.message : "Unable to update supplier status.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="mb-4 flex justify-end">
      <Button leftIcon={<Truck className="size-4" />} onClick={() => { setEditing(null); setError(""); setShowForm((value) => !value); }}>{showForm ? "Close form" : "Add supplier"}</Button>
    </div>

    {showForm && (
      <Card className="mb-5">
        <CardHeader><CardTitle>{editing ? "Edit supplier" : "Add supplier"}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <SupplierFields supplier={editing ?? undefined} />
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/40 sm:col-span-2">{error}</p>}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" loading={busy} leftIcon={<Save className="size-4" />}>{editing ? "Save changes" : "Create supplier"}</Button>
              <Button type="button" variant="outline" leftIcon={<X className="size-4" />} onClick={() => { setEditing(null); setShowForm(false); }}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    )}

    <Card>
      <CardHeader><CardTitle>Supplier management</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-muted/60">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Payment terms</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Balance</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-fg">{supplier.name}</p>
                    <p className="text-xs text-fg-muted">{supplier.code}</p>
                  </td>
                  <td className="px-4 py-3 text-fg-secondary">
                    <p>{supplier.contactPerson ?? "No contact"}</p>
                    <p className="text-xs text-fg-muted">{supplier.phone ?? supplier.email ?? "No details"}</p>
                  </td>
                  <td className="px-4 py-3 text-fg-secondary">{supplier.paymentTerms ?? "-"}</td>
                  <td className="px-4 py-3 text-fg-secondary">GHS {Number(supplier.balance ?? 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" leftIcon={<Pencil className="size-4" />} onClick={() => { setEditing(supplier); setError(""); setShowForm(true); }}>Edit</Button>
                      <Button size="sm" variant={supplier.isActive ? "danger" : "success"} leftIcon={<Power className="size-4" />} loading={busy} onClick={() => void toggle(supplier)}>{supplier.isActive ? "Disable" : "Enable"}</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  </>;
}
