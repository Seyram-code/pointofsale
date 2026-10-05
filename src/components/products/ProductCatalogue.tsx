"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Barcode, Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { Tabs } from "@/components/ui/Tabs";
import { api, buildQuery } from "@/lib/api/client";
import type { PosProduct } from "@/lib/services/product.service";
import { ProductEditDialog } from "@/components/products/ProductEditDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pagination } from "@/components/ui/Pagination";
import type { PaginationMeta } from "@/lib/api/pagination";

interface ProductCatalogueProps {
  initialProducts: PosProduct[];
  categories: Array<{ id: string; name: string; productCount: number }>;
  canEdit: boolean;
  canDelete: boolean;
  canImport: boolean;
}

interface ProductImportResult {
  imported: number;
  skipped: number;
  issues: Array<{ row: number; message: string }>;
}

export function ProductCatalogue({ initialProducts, categories, canEdit, canDelete, canImport }: ProductCatalogueProps) {
  const [products, setProducts] = useState(initialProducts);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 15,
    total: initialProducts.length,
    totalPages: Math.max(1, Math.ceil(initialProducts.length / 15)),
    hasNext: initialProducts.length > 15,
    hasPrev: false,
  });
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PosProduct | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<PosProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ProductImportResult | null>(null);
  const [importError, setImportError] = useState("");
  const importFileRef = useRef<HTMLInputElement>(null);

  function replaceProduct(updated: PosProduct) {
    setProducts((current) => current.map((product) => product.id === updated.id ? updated : product));
    setEditingProduct(null);
  }

  function downloadProductBackup() {
    window.location.assign("/api/products/backup");
  }

  function downloadImportTemplate() {
    window.location.assign("/api/products/import");
  }

  async function importProductBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setImportError("");
    setImportResult(null);
    if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) {
      setImportError("Choose an Excel .xlsx product backup file.");
      return;
    }

    const form = new FormData();
    form.append("file", file);
    setImporting(true);
    try {
      const response = await fetch("/api/products/import", { method: "POST", body: form, credentials: "same-origin" });
      const payload = await response.json();
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error?.message ?? "Could not import this workbook.");
      }
      const result = payload.data as ProductImportResult;
      setImportResult(result);
      try {
        await loadProducts(page);
      } catch {
        setImportError("Products were imported, but the catalogue did not refresh. Reload the page to see them.");
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not import this workbook.");
    } finally {
      setImporting(false);
    }
  }

  async function loadProducts(requestedPage: number) {
    const response = await api.get<{ products: PosProduct[]; pagination: PaginationMeta }>(
      `/products/catalogue${buildQuery({ q: query, categoryId, page: requestedPage, pageSize: 15 })}`,
    );
    setProducts(response.products);
    setPagination(response.pagination);
    setPage(response.pagination.page);
  }

  async function deleteProduct() {
    if (!deletingProduct) return;
    setDeleting(true);
    try {
      await api.delete(`/products/${deletingProduct.id}`);
      await loadProducts(page);
      setDeletingProduct(null);
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<{ products: PosProduct[]; pagination: PaginationMeta }>(`/products/catalogue${buildQuery({ q: query, categoryId, page, pageSize: 15 })}`)
      .then((response) => {
        if (cancelled) return;
        setProducts(response.products);
        setPagination(response.pagination);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [query, categoryId, page]);

  const columns: DataTableColumn<PosProduct>[] = [
    {
      key: "product",
      header: "Product",
      render: (product) => (
        <div>
          <p className="font-medium text-fg">{product.name}</p>
          <p className="mt-0.5 text-xs text-fg-muted">{product.categoryName ?? "Uncategorised"}</p>
        </div>
      ),
    },
    {
      key: "sku",
      header: "SKU / Barcode",
      render: (product) => (
        <div className="text-xs text-fg-secondary">
          <p>{product.sku}</p>
          <p className="mt-0.5 flex items-center gap-1 text-fg-muted"><Barcode className="size-3" />{product.barcode ?? "No barcode"}</p>
        </div>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      render: (product) => <span className="tabular">{product.trackStock ? product.stock : "Not tracked"}</span>,
    },
    {
      key: "cost",
      header: "Cost price",
      align: "right",
      render: (product) => <Money value={product.costPrice} />,
    },
    {
      key: "selling",
      header: "Selling price",
      align: "right",
      render: (product) => <Money value={product.unitPrice} className="font-semibold text-brand-700 dark:text-brand-300" />,
    },
    {
      key: "status",
      header: "Status",
      render: (product) => <Badge variant={product.trackStock && product.stock <= 0 ? "danger" : "success"} dot>{product.trackStock && product.stock <= 0 ? "Out of stock" : "Active"}</Badge>,
    },
    ...(canEdit || canDelete ? [{
      key: "actions",
      header: "Actions",
      align: "right" as const,
      render: (product: PosProduct) => <div className="flex min-w-max justify-end gap-2 whitespace-nowrap">
        {canEdit && <Button size="sm" variant="outline" leftIcon={<Pencil className="size-3.5" />} aria-label={`Edit ${product.name}`} onClick={() => setEditingProduct(product)}>Edit</Button>}
        {canDelete && <Button size="sm" variant="outline" className="text-danger hover:text-danger" leftIcon={<Trash2 className="size-3.5" />} aria-label={`Delete ${product.name}`} onClick={() => setDeletingProduct(product)}>Delete</Button>}
      </div>,
    }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Products"
        description="Manage your catalogue, pricing, SKUs and barcodes."
        actions={<div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" leftIcon={<Download className="size-4" />} onClick={downloadProductBackup}>Download product backup</Button>
          {canImport && <Button type="button" variant="outline" leftIcon={<Download className="size-4" />} onClick={downloadImportTemplate}>Download import template</Button>}
          {canImport && <Button type="button" variant="outline" loading={importing} leftIcon={<Upload className="size-4" />} onClick={() => importFileRef.current?.click()}>Import products</Button>}
          <Link href="/products/new" className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"><Plus className="size-4" />Add product</Link>
        </div>}
      />
      {canImport && <input ref={importFileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => void importProductBackup(event)} />}
      {importError && <p role="alert" className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{importError}</p>}
      {importResult && <div role="status" className="mb-4 rounded-lg border border-line bg-card px-4 py-3 text-sm text-fg-secondary">
        <p>Imported {importResult.imported} product{importResult.imported === 1 ? "" : "s"}; skipped {importResult.skipped}. Existing products were not overwritten.</p>
        {importResult.issues.length > 0 && <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-fg-muted">
          {importResult.issues.slice(0, 5).map((issue, index) => <li key={`${issue.row}-${index}`}>Row {issue.row}: {issue.message}</li>)}
          {importResult.issues.length > 5 && <li>{importResult.issues.length - 5} more issue{importResult.issues.length - 5 === 1 ? "" : "s"}.</li>}
        </ul>}
      </div>}
      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center">
          <Tabs
            value={categoryId ?? "all"}
            onChange={(value) => { setCategoryId(value === "all" ? null : value); setPage(1); }}
            items={[{ value: "all", label: "All products" }, ...categories.map((category) => ({ value: category.id, label: category.name, count: category.productCount }))]}
            className="w-full overflow-x-auto sm:w-auto"
          />
          <SearchInput placeholder="Search name, SKU or barcode" onSearch={(value) => { setQuery(value); setPage(1); }} className="w-full sm:ml-auto sm:w-72" />
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            rows={products}
            rowKey={(product) => product.id}
            loading={loading}
            emptyTitle="No products found"
            emptyMessage="Create a product or change your search filters."
            mobileRow={(product) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-fg">{product.name}</p><p className="text-xs text-fg-muted">{product.sku} · {product.barcode ?? "No barcode"}</p></div><Badge variant={product.trackStock && product.stock <= 0 ? "danger" : "success"} size="sm">{product.trackStock && product.stock <= 0 ? "Out" : "Active"}</Badge></div>
                <div className="flex items-center justify-between text-sm"><span className="text-fg-muted">Stock: {product.trackStock ? product.stock : "Not tracked"}</span><Money value={product.unitPrice} className="font-semibold" /></div>
                {(canEdit || canDelete) && <div className="flex gap-2 pt-1">
                  {canEdit && <Button size="sm" variant="outline" leftIcon={<Pencil className="size-3.5" />} onClick={() => setEditingProduct(product)}>Edit</Button>}
                  {canDelete && <Button size="sm" variant="ghost" className="text-danger" leftIcon={<Trash2 className="size-3.5" />} onClick={() => setDeletingProduct(product)}>Delete</Button>}
                </div>}
              </div>
            )}
          />
          {!loading && <Pagination meta={pagination} onPageChange={setPage} />}
        </CardContent>
      </Card>
      <ProductEditDialog product={editingProduct} open={Boolean(editingProduct)} onClose={() => setEditingProduct(null)} onSaved={replaceProduct} />
      <ConfirmDialog open={Boolean(deletingProduct)} title="Delete product" message={`Delete ${deletingProduct?.name ?? "this product"}? It will be removed from the catalogue but retained in historical sales.`} confirmLabel="Delete product" destructive loading={deleting} onConfirm={deleteProduct} onCancel={() => setDeletingProduct(null)} />
    </>
  );
}
