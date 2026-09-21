"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownUp, History, PackageCheck, PackageMinus, PackagePlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { InventoryDialog, type InventoryProductOption } from "@/components/inventory/InventoryDialogs";
import { api, buildQuery } from "@/lib/api/client";
import { formatDate, formatNumber, formatQuantity } from "@/lib/utils/format";

interface InventoryItem extends InventoryProductOption {
  barcode: string | null;
  categoryName: string;
  reorderLevel: number;
  reorderQty: number;
  averageCost: number;
  sellingPrice: number;
  stockStatus: "ok" | "low" | "out";
  lastUpdatedAt: string | null;
}

interface Movement {
  id: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  unitCost: number;
  reason: string | null;
  referenceId: string | null;
  createdAt: string;
  productName: string;
  sku: string;
  performedBy: string;
}

const STATUS_LABELS = { ok: "In stock", low: "Low stock", out: "Out of stock" } as const;
const STATUS_VARIANTS = { ok: "success", low: "warning", out: "danger" } as const;

export function InventoryWorkspace() {
  const toast = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "low" | "out">("all");
  const [activeTab, setActiveTab] = useState("stock");
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<"receive" | "adjust" | null>(null);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const [stock, movementRows] = await Promise.all([
        api.get<InventoryItem[]>(`/inventory${buildQuery({ q: query, status, limit: 200 })}`),
        api.get<Movement[]>("/inventory/movements?limit=50"),
      ]);
      setItems(stock);
      setMovements(movementRows);
    } catch {
      toast.error("Could not load inventory", "Check the database connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [query, status, toast]);

  useEffect(() => {
    const timer = setTimeout(() => void loadInventory(), 250);
    return () => clearTimeout(timer);
  }, [loadInventory]);

  const productOptions = useMemo<InventoryProductOption[]>(
    () => items.map(({ id, name, sku, quantity, costPrice }) => ({ id, name, sku, quantity, costPrice })),
    [items],
  );

  const stats = useMemo(() => ({
    total: items.length,
    low: items.filter((item) => item.stockStatus === "low").length,
    out: items.filter((item) => item.stockStatus === "out").length,
    value: items.reduce((sum, item) => sum + item.quantity * item.averageCost, 0),
  }), [items]);

  const columns: DataTableColumn<InventoryItem>[] = [
    {
      key: "product",
      header: "Product",
      render: (item) => (
        <div className="min-w-44">
          <p className="font-medium text-fg">{item.name}</p>
          <p className="mt-0.5 text-xs text-fg-muted">{item.categoryName}</p>
        </div>
      ),
    },
    {
      key: "identifiers",
      header: "SKU / Barcode",
      hideOnMobile: true,
      render: (item) => <div className="text-xs text-fg-secondary"><p>{item.sku}</p><p className="mt-0.5 text-fg-muted">{item.barcode ?? "No barcode"}</p></div>,
    },
    {
      key: "quantity",
      header: "Quantity",
      align: "right",
      render: (item) => <span className="font-semibold tabular">{formatQuantity(item.quantity)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <Badge variant={STATUS_VARIANTS[item.stockStatus]} dot>{STATUS_LABELS[item.stockStatus]}</Badge>,
    },
    {
      key: "pricing",
      header: "Cost / Selling",
      hideOnMobile: true,
      render: (item) => <div className="text-right text-xs"><Money value={item.costPrice} className="block text-xs" /><Money value={item.sellingPrice} className="mt-0.5 block text-xs text-brand-700 dark:text-brand-300" /></div>,
    },
    {
      key: "reorder",
      header: "Reorder at",
      align: "right",
      hideOnMobile: true,
      render: (item) => <span className="text-fg-secondary tabular">{formatQuantity(item.reorderLevel)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Track stock levels, receive deliveries and review every movement."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" leftIcon={<ArrowDownUp className="size-4" />} onClick={() => setDialog("adjust")}>Adjust stock</Button>
            <Button leftIcon={<PackagePlus className="size-4" />} onClick={() => setDialog("receive")}>Receive stock</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard label="Products tracked" value={formatNumber(stats.total)} icon={<PackageCheck className="size-5" />} tone="brand" />
        <StatCard label="Low stock" value={formatNumber(stats.low)} icon={<AlertTriangle className="size-5" />} tone="accent" />
        <StatCard label="Out of stock" value={formatNumber(stats.out)} icon={<PackageMinus className="size-5" />} tone="danger" />
        <StatCard label="Stock value" value={`GH₵${stats.value.toLocaleString("en-GH", { maximumFractionDigits: 0 })}`} icon={<PackageCheck className="size-5" />} tone="success" />
      </div>

      <Card className="mt-4 sm:mt-6">
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center">
          <Tabs
            value={activeTab}
            onChange={setActiveTab}
            items={[{ value: "stock", label: "Stock levels" }, { value: "movements", label: "Movement history", icon: <History className="size-4" /> }]}
            className="w-full sm:w-auto"
          />
          {activeTab === "stock" && (
            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
              <SearchInput placeholder="Search product, SKU or barcode" onSearch={setQuery} className="sm:w-64" />
              <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
                {(["all", "low", "out"] as const).map((value) => (
                  <button key={value} type="button" onClick={() => setStatus(value)} className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${status === value ? "bg-card text-fg shadow-sm" : "text-fg-muted"}`}>
                    {value === "all" ? "All" : value === "low" ? "Low" : "Out"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {activeTab === "stock" ? (
            <DataTable
              columns={columns}
              rows={items}
              rowKey={(item) => item.id}
              loading={loading}
              emptyTitle="No inventory found"
              emptyMessage="Add products or change your search filters."
              mobileRow={(item) => (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-fg">{item.name}</p><p className="text-xs text-fg-muted">{item.sku} · {item.barcode ?? "No barcode"}</p></div><Badge variant={STATUS_VARIANTS[item.stockStatus]} size="sm">{STATUS_LABELS[item.stockStatus]}</Badge></div>
                  <div className="flex items-end justify-between"><span className="text-xs text-fg-muted">Reorder at {formatQuantity(item.reorderLevel)}</span><span className="text-lg font-semibold text-fg tabular">{formatQuantity(item.quantity)}</span></div>
                </div>
              )}
            />
          ) : (
            <MovementTable movements={movements} loading={loading} />
          )}
        </CardContent>
      </Card>

      {dialog && <InventoryDialog mode={dialog} open products={productOptions} onClose={() => setDialog(null)} onSaved={() => void loadInventory()} />}
    </div>
  );
}

function MovementTable({ movements, loading }: { movements: Movement[]; loading: boolean }) {
  const columns: DataTableColumn<Movement>[] = [
    { key: "date", header: "Date", render: (movement) => <span className="text-xs text-fg-secondary">{formatDate(movement.createdAt, "full")}</span> },
    { key: "product", header: "Product", render: (movement) => <div><p className="font-medium text-fg">{movement.productName}</p><p className="text-xs text-fg-muted">{movement.sku}</p></div> },
    { key: "type", header: "Movement", render: (movement) => <Badge variant={movement.quantity >= 0 ? "success" : "danger"}>{movement.type.replace(/_/g, " ")}</Badge> },
    { key: "quantity", header: "Change", align: "right", render: (movement) => <span className={`font-semibold tabular ${movement.quantity >= 0 ? "text-success" : "text-danger"}`}>{movement.quantity >= 0 ? "+" : ""}{formatQuantity(movement.quantity)}</span> },
    { key: "balance", header: "Balance", align: "right", render: (movement) => <span className="tabular">{formatQuantity(movement.balanceAfter)}</span> },
    { key: "user", header: "By", hideOnMobile: true, render: (movement) => <span className="text-xs text-fg-secondary">{movement.performedBy}</span> },
  ];
  return <DataTable columns={columns} rows={movements} rowKey={(movement) => movement.id} loading={loading} emptyTitle="No stock movements" emptyMessage="Receiving, sales and adjustments will appear here." />;
}
