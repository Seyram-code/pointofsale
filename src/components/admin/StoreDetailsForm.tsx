"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { RegionSelect } from "@/components/ui/RegionSelect";

interface StoreDetailsFormProps {
  initialValues: { name: string; addressLine: string | null; phone: string | null; city: string | null; region: string | null; ghanaPostGps: string | null; tinNumber: string | null; vatNumber: string | null; receiptFooter: string | null; currency: string; timezone: string };
}

export function StoreDetailsForm({ initialValues }: StoreDetailsFormProps) {
  const [values, setValues] = useState({
    name: initialValues.name,
    addressLine: initialValues.addressLine ?? "",
    phone: initialValues.phone ?? "",
    city: initialValues.city ?? "",
    region: initialValues.region ?? "",
    ghanaPostGps: initialValues.ghanaPostGps ?? "",
    tinNumber: initialValues.tinNumber ?? "",
    vatNumber: initialValues.vatNumber ?? "",
    receiptFooter: initialValues.receiptFooter ?? "",
    currency: initialValues.currency,
    timezone: initialValues.timezone,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await api.patch("/settings", values);
      setMessage("Company details saved.");
    } catch (saveError) {
      setError(saveError instanceof ApiClientError ? saveError.message : "Could not save company details");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Company details</CardTitle></CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="Company name" value={values.name} required onChange={(event) => setValues({ ...values, name: event.target.value })} />
          <Input label="Address" value={values.addressLine} onChange={(event) => setValues({ ...values, addressLine: event.target.value })} />
          <Input label="Phone number" value={values.phone} onChange={(event) => setValues({ ...values, phone: event.target.value })} />
          <Input label="City" value={values.city} onChange={(event) => setValues({ ...values, city: event.target.value })} />
          <RegionSelect label="Region" value={values.region} onChange={(event) => setValues({ ...values, region: event.target.value })} />
          <Input label="Ghana Post GPS" value={values.ghanaPostGps} onChange={(event) => setValues({ ...values, ghanaPostGps: event.target.value })} />
          <Input label="TIN number" value={values.tinNumber} onChange={(event) => setValues({ ...values, tinNumber: event.target.value })} />
          <Input label="VAT number" value={values.vatNumber} onChange={(event) => setValues({ ...values, vatNumber: event.target.value })} />
          <Input label="Currency" value={values.currency} onChange={(event) => setValues({ ...values, currency: event.target.value.toUpperCase() })} />
          <Input label="Timezone" value={values.timezone} hint="Example: Africa/Accra" onChange={(event) => setValues({ ...values, timezone: event.target.value })} />
          <Input label="Receipt footer" value={values.receiptFooter} containerClassName="md:col-span-2" placeholder="Thank you for shopping with us" onChange={(event) => setValues({ ...values, receiptFooter: event.target.value })} />
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          {message && <span className="text-sm text-success">{message}</span>}
          {error && <span className="text-sm text-danger">{error}</span>}
          <Button leftIcon={<Save className="size-4" />} loading={saving} disabled={!values.name.trim()} onClick={save}>Save details</Button>
        </div>
      </CardContent>
    </Card>
  );
}