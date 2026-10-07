"use client";

import { FormEvent, useEffect, useState } from "react";
import { Camera, Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CameraBarcodeScanner } from "@/components/pos/CameraBarcodeScanner";
import { api } from "@/lib/api/client";
import type { PosProduct } from "@/lib/services/product.service";
import { useCurrentUser } from "@/components/providers/SessionProvider";

interface ProductEditDialogProps {
  product: PosProduct | null;
  open: boolean;
  canManageNonStock: boolean;
  isSalonSpa: boolean;
  onClose: () => void;
  onSaved: (product: PosProduct) => void;
}

export function ProductEditDialog({ product, open, canManageNonStock, isSalonSpa, onClose, onSaved }: ProductEditDialogProps) {
  const scannerEnabled = useCurrentUser().scannerOutsidePos;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [values, setValues] = useState({ name: "", sku: "", barcode: "", costPrice: "", sellingPrice: "", nonStock: false, openingQuantity: "0" });

  useEffect(() => {
    if (!product) return;
    setValues({ name: product.name, sku: product.sku, barcode: product.barcode ?? "", costPrice: String(product.costPrice), sellingPrice: String(product.unitPrice), nonStock: !product.trackStock, openingQuantity: "0" });
    setError("");
  }, [product]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api.patch<PosProduct>(`/products/${product.id}`, {
        ...values,
        costPrice: values.nonStock ? 0 : values.costPrice,
        quantity: values.openingQuantity,
      });
      onSaved(updated);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to update product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={isSalonSpa ? "Edit service or product" : "Edit product"} size="sm" closeOnBackdrop={!saving}>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Product name" value={values.name} required onChange={(event) => setValues({ ...values, name: event.target.value })} />
          <Input label="SKU" value={values.sku} required onChange={(event) => setValues({ ...values, sku: event.target.value })} />
          <Input
            label="Barcode"
            value={values.barcode}
            onChange={(event) => setValues({ ...values, barcode: event.target.value })}
            rightSlot={scannerEnabled ? (
              <button
                type="button"
                onClick={() => setCameraScannerOpen(true)}
                aria-label="Scan barcode with camera"
                className="flex items-center justify-center rounded-md p-1 text-fg-muted transition hover:text-fg"
              >
                <Camera className="size-4" />
              </button>
            ) : undefined}
          />
          {canManageNonStock && (
            <label className="flex items-start gap-3 rounded-lg border border-line p-3">
              <input
                type="checkbox"
                checked={values.nonStock}
                onChange={(event) => setValues({ ...values, nonStock: event.target.checked })}
                className="mt-0.5 size-4 accent-brand-600"
              />
              <span>
                <span className="block text-sm font-medium text-fg">{isSalonSpa ? "Salon service (no stock)" : "Non-stock service"}</span>
                <span className="mt-0.5 block text-xs text-fg-muted">Stock is not deducted at checkout.</span>
              </span>
            </label>
          )}
          {canManageNonStock && product && !product.trackStock && !values.nonStock && (
            <Input
              label="Opening quantity"
              type="number"
              min="0"
              step="0.001"
              value={values.openingQuantity}
              required
              onChange={(event) => setValues({ ...values, openingQuantity: event.target.value })}
            />
          )}
          <div className={`grid gap-3 ${values.nonStock ? "grid-cols-1" : "grid-cols-2"}`}>
            {!values.nonStock && <Input label="Cost price" type="number" min="0" step="0.01" value={values.costPrice} required onChange={(event) => setValues({ ...values, costPrice: event.target.value })} />}
            <Input label={values.nonStock ? "Service fee" : "Selling price"} type="number" min="0" step="0.01" value={values.sellingPrice} required onChange={(event) => setValues({ ...values, sellingPrice: event.target.value })} />
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving} leftIcon={<Save className="size-4" />}>Save changes</Button>
          </div>
        </form>
      </Modal>

      {scannerEnabled && <CameraBarcodeScanner
        open={cameraScannerOpen}
        onClose={() => setCameraScannerOpen(false)}
        onDetected={(code) => {
          setValues((current) => ({ ...current, barcode: code }));
          setCameraScannerOpen(false);
        }}
      />}
    </>
  );
}