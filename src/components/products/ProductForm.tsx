"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";
import { DEFAULT_TAX_RATE } from "@/lib/config/constants";

export function ProductForm({ mode = "retail" }: { mode?: "retail" | "restaurant" }) {
  const isRestaurant = mode === "restaurant";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [taxRate, setTaxRate] = useState(DEFAULT_TAX_RATE);
  const toast = useToast();
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
        costPrice: form.get("costPrice"),
        sellingPrice: finalPrice,
        quantity: form.get("quantity"),
        expiryDate: form.get("expiryDate") || undefined,
      });
      toast.success(isRestaurant ? "Menu item added" : "Product added", isRestaurant ? "The menu item was added successfully." : "The product was added successfully.");
      window.setTimeout(() => window.location.assign("/products"), 600);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to create product.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      <Card>
        <CardHeader><CardTitle>{isRestaurant ? "Menu item details" : "Product details"}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input label={isRestaurant ? "Menu item name" : "Product name"} name="name" required placeholder={isRestaurant ? "e.g. Jollof rice" : "e.g. Milo 400g"} />
          <Input label={isRestaurant ? "Item code (optional)" : "SKU (optional)"} name="sku" placeholder={isRestaurant ? "e.g. JOLLOF-01" : "e.g. MILO-400"} />
          <Input label="Barcode" name="barcode" placeholder="Optional barcode" />
          <Input label={isRestaurant ? "Ingredient cost (GHS)" : "Cost price (GHS)"} name="costPrice" type="number" min="0" step="0.01" required placeholder="0.00" />
          <Input
            label={isRestaurant ? "Menu price before tax (GHS)" : "Selling price before tax (GHS)"}
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
            <p className="text-xs font-medium text-fg-muted">Final checkout price</p>
            <p className="mt-1 text-xl font-semibold text-fg">GHS {finalPrice.toFixed(2)}</p>
            <p className="mt-0.5 text-xs text-fg-muted">Selling price plus tax</p>
          </div>
          <Input label={isRestaurant ? "Opening stock" : "Opening quantity"} name="quantity" type="number" min="0" step="0.001" required placeholder="0" />
          <Input label={isRestaurant ? "Use-by date" : "Expiry date"} name="expiryDate" type="date" hint={isRestaurant ? "Optional for ingredients or prepared items" : "Optional for products with an expiry date"} />
        </CardContent>
      </Card>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={saving} leftIcon={<Save className="size-4" />}>{isRestaurant ? "Create menu item" : "Create product"}</Button>
        <Link href="/products" className="inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-card px-4 text-sm font-medium text-fg hover:bg-muted"><ArrowLeft className="size-4" />Cancel</Link>
      </div>
    </form>
  );
}
