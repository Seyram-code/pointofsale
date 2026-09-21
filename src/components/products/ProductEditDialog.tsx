"use client";

import { FormEvent, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api/client";
import type { PosProduct } from "@/lib/services/product.service";

interface ProductEditDialogProps {
  product: PosProduct | null;
  open: boolean;
  onClose: () => void;
  onSaved: (product: PosProduct) => void;
}

export function ProductEditDialog({ product, open, onClose, onSaved }: ProductEditDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState({ name: "", sku: "", barcode: "", costPrice: "", sellingPrice: "" });

  useEffect(() => {
    if (!product) return;
    setValues({ name: product.name, sku: product.sku, barcode: product.barcode ?? "", costPrice: String(product.costPrice), sellingPrice: String(product.unitPrice) });
    setError("");
  }, [product]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api.patch<PosProduct>(`/products/${product.id}`, values);
      onSaved(updated);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to update product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit product" size="sm" closeOnBackdrop={!saving}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Product name" value={values.name} required onChange={(event) => setValues({ ...values, name: event.target.value })} />
        <Input label="SKU" value={values.sku} required onChange={(event) => setValues({ ...values, sku: event.target.value })} />
        <Input label="Barcode" value={values.barcode} onChange={(event) => setValues({ ...values, barcode: event.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Cost price" type="number" min="0" step="0.01" value={values.costPrice} required onChange={(event) => setValues({ ...values, costPrice: event.target.value })} />
          <Input label="Selling price" type="number" min="0" step="0.01" value={values.sellingPrice} required onChange={(event) => setValues({ ...values, sellingPrice: event.target.value })} />
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving} leftIcon={<Save className="size-4" />}>Save changes</Button>
        </div>
      </form>
    </Modal>
  );
}