"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { CameraBarcodeScanner } from "@/components/pos/CameraBarcodeScanner";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";
import { DEFAULT_TAX_RATE } from "@/lib/config/constants";
import { useCurrentUser } from "@/components/providers/SessionProvider";

export function ProductForm({ mode = "retail", canCreateNonStock = false }: { mode?: "retail" | "restaurant" | "salon"; canCreateNonStock?: boolean }) {
  const isRestaurant = mode === "restaurant";
  const isSalon = mode === "salon";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [barcode, setBarcode] = useState("");
  const [nonStock, setNonStock] = useState(false);
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [taxRate, setTaxRate] = useState(DEFAULT_TAX_RATE);
  const toast = useToast();
  const scannerEnabled = useCurrentUser().scannerOutsidePos;
  const preTaxPrice = Number(sellingPrice) || 0;
  const taxAmount = Math.round(preTaxPrice * taxRate * 100) / 100;
  const finalPrice = Math.round((preTaxPrice + taxAmount) * 100) / 100;

  useEffect(() => {
    api.get<Array<{ rate: number; isDefault: boolean; isActive: boolean }>>("/settings/tax-rates")
      .then((rates) => {
        const defaultRate = rates.find((rate) => rate.isDefault && rate.isActive);
        if (defaultRate) setTaxRate(defaultRate.rate);
      })
      .catch(() => undefined);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api.post("/products", {
        name: form.get("name"),
        sku: form.get("sku"),
        barcode: form.get("barcode"),
        costPrice: nonStock ? 0 : form.get("costPrice"),
        sellingPrice: finalPrice,
        quantity: nonStock ? 0 : form.get("quantity"),
        expiryDate: nonStock ? undefined : form.get("expiryDate") || undefined,
        nonStock,
      });
      toast.success(isRestaurant ? "Menu item added" : nonStock ? "Service added" : "Product added", isRestaurant ? "The menu item was added successfully." : nonStock ? "The service was added successfully." : "The product was added successfully.");
      window.setTimeout(() => window.location.assign("/products"), 600);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to create product.");
      setSaving(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} className="max-w-2xl space-y-4">
        <Card>
          <CardHeader><CardTitle>{isRestaurant ? "Menu item details" : isSalon ? "Salon service or product details" : "Product details"}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Input label={isRestaurant ? "Menu item name" : isSalon ? "Service or product name" : "Product name"} name="name" required placeholder={isRestaurant ? "e.g. Jollof rice" : isSalon ? "e.g. Hair styling" : "e.g. Milo 400g"} />
            <Input label={isRestaurant || isSalon ? "Item code (optional)" : "SKU (optional)"} name="sku" placeholder={isRestaurant ? "e.g. JOLLOF-01" : isSalon ? "e.g. HAIR-STYLE" : "e.g. MILO-400"} />
            <Input
              label="Barcode"
              name="barcode"
              placeholder="Optional barcode"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
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
            {!nonStock && <Input label={isRestaurant ? "Ingredient cost (GHS)" : "Cost price (GHS)"} name="costPrice" type="number" min="0" step="0.01" required placeholder="0.00" />}
            <Input
              label={nonStock ? (isSalon ? "Service fee before tax (GHS)" : "Service charge before tax (GHS)") : isRestaurant ? "Menu price before tax (GHS)" : isSalon ? "Product price before tax (GHS)" : "Selling price before tax (GHS)"}
              name="sellingPrice"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="0.00"
              value={sellingPrice}
              onChange={(event) => setSellingPrice(event.target.value)}
              hint={`Tax (${(taxRate * 100).toFixed(2)}%): GHS ${taxAmount.toFixed(2)}`}
            />
            <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 dark:border-brand-900 dark:bg-brand-950/30">
              <p className="text-xs font-medium text-fg-muted">{nonStock ? "Final service charge" : "Final checkout price"}</p>
              <p className="mt-1 text-xl font-semibold text-fg">GHS {finalPrice.toFixed(2)}</p>
              <p className="mt-0.5 text-xs text-fg-muted">{nonStock ? "Service fee plus tax" : "Selling price plus tax"}</p>
            </div>
            {canCreateNonStock && (
              <label className="flex items-start gap-3 rounded-lg border border-line p-3 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={nonStock}
                  onChange={(event) => setNonStock(event.target.checked)}
                  className="mt-0.5 size-4 accent-brand-600"
                />
                <span>
                  <span className="block text-sm font-medium text-fg">Non-stock service</span>
                  <span className="mt-0.5 block text-xs text-fg-muted">For services such as haircuts. Stock is not deducted at checkout.</span>
                </span>
              </label>
            )}
            {!nonStock && <Input label={isRestaurant ? "Opening stock" : "Opening quantity"} name="quantity" type="number" min="0" step="0.001" required placeholder="0" />}
            {!nonStock && <Input label={isRestaurant ? "Use-by date" : "Expiry date"} name="expiryDate" type="date" hint={isRestaurant ? "Optional for ingredients or prepared items" : "Optional for products with an expiry date"} />}
          </CardContent>
        </Card>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={saving} leftIcon={<Save className="size-4" />}>{isRestaurant ? "Create menu item" : isSalon && nonStock ? "Create service" : "Create product"}</Button>
          <Link href="/products" className="inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-card px-4 text-sm font-medium text-fg hover:bg-muted"><ArrowLeft className="size-4" />Cancel</Link>
        </div>
      </form>

      {scannerEnabled && <CameraBarcodeScanner
        open={cameraScannerOpen}
        onClose={() => setCameraScannerOpen(false)}
        onDetected={(code) => {
          setBarcode(code);
          setCameraScannerOpen(false);
        }}
      />}
    </>
  );
}
