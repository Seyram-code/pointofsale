"use client";

import { useState } from "react";
import { Pencil, Power, Save, UserPlus, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

interface CustomerRecord {
  id: string;
  code: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  loyaltyCardNo: string | null;
  creditLimit: unknown;
  notes: string | null;
  isActive: boolean;
}

function CustomerFields({ customer }: { customer?: CustomerRecord }) {
  return <>
    <Input label="Full name" name="fullName" defaultValue={customer?.fullName} required placeholder="e.g. Ama Owusu" />
    <Input label="Phone" name="phone" defaultValue={customer?.phone ?? ""} placeholder="e.g. 024 000 0000" />
    <Input label="Email" name="email" type="email" defaultValue={customer?.email ?? ""} placeholder="Optional email" />
    <Input label="Loyalty card number" name="loyaltyCardNo" defaultValue={customer?.loyaltyCardNo ?? ""} placeholder="Optional card number" />
    <Input label="Address" name="addressLine" defaultValue={customer?.addressLine ?? ""} placeholder="Optional address" />
    <Input label="City" name="city" defaultValue={customer?.city ?? ""} placeholder="Optional city" />
    <Input label="Credit limit (GHS)" name="creditLimit" type="number" min="0" step="0.01" defaultValue={customer ? String(customer.creditLimit) : "0"} />
    <Input label="Notes" name="notes" defaultValue={customer?.notes ?? ""} placeholder="Optional notes" />
  </>;
}

export function CustomerManagement({ initialCustomers }: { initialCustomers: CustomerRecord[] }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CustomerRecord | null>(null);
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
        const updated = await api.patch<CustomerRecord>(`/customers/${editing.id}`, values);
        setCustomers((current) => current.map((customer) => customer.id === updated.id ? { ...customer, ...updated, ...values, creditLimit: values.creditLimit } : customer));
        toast.success("Customer updated", "The customer profile was updated successfully.");
      } else {
        await api.post("/customers", values);
        toast.success("Customer added", "The customer profile was created successfully.");
        window.setTimeout(() => window.location.reload(), 500);
      }
      setEditing(null);
      setShowForm(false);
    } catch (submissionError) {
      setError(submissionError instanceof ApiClientError ? submissionError.message : "Unable to save customer.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(customer: CustomerRecord) {
    setBusy(true);
    setError("");
    try {
      const updated = await api.patch<CustomerRecord>(`/customers/${customer.id}`, { isActive: !customer.isActive });
      setCustomers((current) => current.map((item) => item.id === customer.id ? { ...item, isActive: updated.isActive } : item));
      toast.success(updated.isActive ? "Customer enabled" : "Customer disabled", `${customer.fullName} was updated successfully.`);
    } catch (statusError) {
      setError(statusError instanceof ApiClientError ? statusError.message : "Unable to update customer status.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="mb-4 flex justify-end">
      <Button leftIcon={<UserPlus className="size-4" />} onClick={() => { setEditing(null); setError(""); setShowForm((value) => !value); }}>{showForm ? "Close form" : "Add customer"}</Button>
    </div>
    {showForm && <Card className="mb-5"><CardHeader><CardTitle>{editing ? "Edit customer" : "Add customer"}</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><CustomerFields customer={editing ?? undefined} />{error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/40 sm:col-span-2">{error}</p>}<div className="flex gap-2 sm:col-span-2"><Button type="submit" loading={busy} leftIcon={<Save className="size-4" />}>{editing ? "Save changes" : "Create customer"}</Button><Button type="button" variant="outline" leftIcon={<X className="size-4" />} onClick={() => { setEditing(null); setShowForm(false); }}>Cancel</Button></div></form></CardContent></Card>}
    <Card><CardHeader><CardTitle>Customer management</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr className="border-b border-line bg-muted/60"><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Customer</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Contact</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Status</th><th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">Actions</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id} className="border-b border-line last:border-0"><td className="px-4 py-3"><p className="font-medium text-fg">{customer.fullName}</p><p className="text-xs text-fg-muted">{customer.code}</p></td><td className="px-4 py-3 text-fg-secondary"><p>{customer.phone ?? "No phone"}</p><p className="text-xs text-fg-muted">{customer.email ?? "No email"}</p></td><td className="px-4 py-3"><span className={customer.isActive ? "text-success" : "text-fg-muted"}>{customer.isActive ? "Active" : "Inactive"}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" leftIcon={<Pencil className="size-4" />} onClick={() => { setEditing(customer); setError(""); setShowForm(true); }}>Edit</Button><Button size="sm" variant={customer.isActive ? "danger" : "success"} leftIcon={<Power className="size-4" />} loading={busy} onClick={() => void toggle(customer)}>{customer.isActive ? "Disable" : "Enable"}</Button></div></td></tr>)}</tbody></table></div></CardContent></Card>
  </>;
}
