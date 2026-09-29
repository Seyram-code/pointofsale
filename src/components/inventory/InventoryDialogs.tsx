"use client";

import { useEffect, useState } from "react";
import { ArrowDownUp, PackagePlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api/client";
import { formatQuantity } from "@/lib/utils/format";

export interface InventoryProductOption {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  costPrice: number;
}

export interface InventoryDialogProps {
  products: InventoryProductOption[];
  mode: "receive" | "adjust";
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function InventoryDialog({ products, mode, open, onClose, onSaved }: InventoryDialogProps) {
  const toast = useToast();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProductId(products[0]?.id ?? "");
    setQuantity("");
    setUnitCost(products[0] ? String(products[0].costPrice) : "");
    setReason("");
    setReference("");
    setBatchNumber("");
    setExpiryDate("");
  }, [open, products]);

  const selected = products.find((product) => product.id === productId);
  const isReceive = mode === "receive";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      if (isReceive) {
        await api.post("/inventory/receive", {
          productId,
          quantity: Number(quantity),
          unitCost: Number(unitCost),
          batchNumber: batchNumber || undefined,
          expiryDate: expiryDate || undefined,
          reference: reference || undefined,
          reason: reason || undefined,
        });
        toast.success("Stock received", `${quantity} unit(s) added to ${selected?.name ?? "inventory"}.`);
      } else {
        await api.post("/inventory/adjust", {
          productId,
          quantity: Number(quantity),
          reason,
          reference: reference || undefined,
        });
        toast.success("Stock adjusted", "The movement and audit record were created.");
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Could not update inventory");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isReceive ? "Receive stock" : "Adjust stock"}
      description={isReceive ? "Increase inventory from a delivery or purchase" : "Record a counted variance, damage or correction"}
      size="md"
      footer={
        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:gap-4">
          <Button variant="outline" className="min-w-0 w-full sm:w-auto" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" form="inventory-form" className="min-w-0 w-full sm:w-auto" loading={loading}>
            {isReceive ? "Receive stock" : "Save adjustment"}
          </Button>
        </div>
      }
    >
      <form id="inventory-form" onSubmit={submit} className="space-y-4">
        <Select
          label="Product"
          value={productId}
          onChange={(event) => {
            const next = products.find((product) => product.id === event.target.value);
            setProductId(event.target.value);
            if (isReceive && next) setUnitCost(String(next.costPrice));
          }}
          options={products.map((product) => ({ value: product.id, label: `${product.name} · ${product.sku}` }))}
        />
        {isReceive && (
          <p className="-mt-2 text-sm text-fg-muted">
            Available now: <span className="font-semibold tabular text-fg">{formatQuantity(selected?.quantity ?? 0)}</span>
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={isReceive ? "Quantity received" : "Quantity change"}
            hint={isReceive ? "Use a positive quantity" : "Positive adds, negative removes"}
            type="number"
            inputMode="decimal"
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
          {isReceive ? (
            <Input
              label="Unit cost (GH₵)"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={unitCost}
              onChange={(event) => setUnitCost(event.target.value)}
              required
            />
          ) : (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-fg-muted">Current quantity</p>
              <p className="mt-1 text-lg font-semibold text-fg tabular">{selected?.quantity ?? 0}</p>
            </div>
          )}
        </div>

        {isReceive && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Batch number" value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)} />
            <Input label="Expiry date" type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
          </div>
        )}

        <Input label="Reference (optional)" placeholder={isReceive ? "PO-2026-0001" : "Stock count #"} value={reference} onChange={(event) => setReference(event.target.value)} />
        <Textarea
          label={isReceive ? "Note (optional)" : "Reason"}
          placeholder={isReceive ? "Supplier delivery note" : "Why is the physical count changing?"}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required={!isReceive}
        />
      </form>
    </Modal>
  );
}

export function InventoryActionIcon({ mode }: { mode: "receive" | "adjust" }) {
  return mode === "receive" ? <PackagePlus className="size-4" /> : <ArrowDownUp className="size-4" />;
}
