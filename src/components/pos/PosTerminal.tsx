"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CloudOff, Loader2, ScanBarcode, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { Money } from "@/components/ui/Money";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { CartPanel } from "@/components/pos/CartPanel";
import { CustomerPicker } from "@/components/pos/CustomerPicker";
import { DiscountDialog } from "@/components/pos/DiscountDialog";
import { HeldSalesDialog } from "@/components/pos/HeldSalesDialog";
import { PaymentDialog, type CheckoutPaymentInput, type CheckoutResponse } from "@/components/pos/PaymentDialog";
import { CameraBarcodeScanner } from "@/components/pos/CameraBarcodeScanner";
import { useCart, type CartLine } from "@/hooks/useCart";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { api, ApiClientError, buildQuery } from "@/lib/api/client";
import type { PosProduct } from "@/lib/services/product.service";
import type { PaymentMethod } from "@/lib/payments/types";

export interface PosCategory {
  id: string;
  name: string;
}

export interface PosPaymentMethodOption {
  method: PaymentMethod;
  label: string;
}

interface HeldSaleDetail {
  id: string;
  discount: { type: "PERCENTAGE" | "FIXED_AMOUNT"; value: number } | null;
  customer: { id: string; fullName: string; phone: string | null } | null;
  items: Array<{
    productId: string;
    name: string;
    sku: string;
    barcode: string | null;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    isVatInclusive: boolean;
    unitAbbreviation: string | null;
  }>;
}

export interface PosTerminalProps {
  categories: PosCategory[];
  permissions: { canDiscount: boolean; canHold: boolean };
  paymentMethods: PosPaymentMethodOption[];
  mockPaymentDriver: boolean;
}

interface OfflineDraftPayload {
  id: string;
  customerId: string | null;
  note: string | null;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  createdAt: string;
}

const OFFLINE_DRAFTS_KEY = "mypos-offline-sale-drafts";

const SHORTCUTS = [
  ["F2", "Search"],
  ["F3", "Barcode"],
  ["F4", "Hold"],
  ["F6", "Customer"],
  ["F7", "Discount"],
  ["F8", "Checkout"],
] as const;

export function PosTerminal({ categories, permissions, paymentMethods, mockPaymentDriver }: PosTerminalProps) {
  const toast = useToast();
  const cart = useCart();

  const barcodeRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [barcode, setBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [cartOpen, setCartOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [offlineDraftCount, setOfflineDraftCount] = useState(0);

  const readOfflineDrafts = useCallback((): OfflineDraftPayload[] => {
    try {
      const stored = window.localStorage.getItem(OFFLINE_DRAFTS_KEY);
      return stored ? JSON.parse(stored) as OfflineDraftPayload[] : [];
    } catch {
      return [];
    }
  }, []);

  const writeOfflineDrafts = useCallback((drafts: OfflineDraftPayload[]) => {
    window.localStorage.setItem(OFFLINE_DRAFTS_KEY, JSON.stringify(drafts));
    setOfflineDraftCount(drafts.length);
  }, []);

  const saveOfflineDraft = useCallback(() => {
    if (cart.lines.length === 0) return;
    const draft: OfflineDraftPayload = {
      id: crypto.randomUUID(),
      customerId: cart.customer?.id ?? null,
      note: cart.note || null,
      items: cart.lines.map((line) => ({ productId: line.productId, quantity: line.quantity, unitPrice: line.unitPrice })),
      createdAt: new Date().toISOString(),
    };
    writeOfflineDrafts([...readOfflineDrafts(), draft]);
    cart.clear();
    setCheckoutOpen(false);
    toast.success("Sale saved offline", "It will sync when the connection returns.");
  }, [cart, readOfflineDrafts, toast, writeOfflineDrafts]);

  const syncOfflineDrafts = useCallback(async () => {
    if (!navigator.onLine) return;
    const drafts = readOfflineDrafts();
    if (drafts.length === 0) return;
    const remaining: OfflineDraftPayload[] = [];
    for (const draft of drafts) {
      try {
        await api.post("/pos/offline-drafts", { payload: draft });
      } catch {
        remaining.push(draft);
      }
    }
    writeOfflineDrafts(remaining);
  }, [readOfflineDrafts, writeOfflineDrafts]);

  useEffect(() => {
    setOnline(navigator.onLine);
    setOfflineDraftCount(readOfflineDrafts().length);
    const handleOnline = () => {
      setOnline(true);
      void syncOfflineDrafts();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    void syncOfflineDrafts();
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [readOfflineDrafts, syncOfflineDrafts]);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      setProducts(await api.get<PosProduct[]>(`/products/search${buildQuery({ q: query, categoryId, limit: 40 })}`));
    } catch {
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, [categoryId, query]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const toCartLine = useCallback(
    (product: PosProduct): Omit<CartLine, "quantity"> => ({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      unitPrice: product.unitPrice,
      originalPrice: product.unitPrice,
      taxRate: product.taxRate,
      isVatInclusive: product.isVatInclusive,
      unitAbbreviation: product.unitAbbreviation,
      stock: product.stock,
      trackStock: product.trackStock,
    }),
    [],
  );

  const addProduct = useCallback(
    (product: PosProduct) => {
      if (product.trackStock && product.stock <= 0) {
        toast.error("Out of stock", `${product.name} cannot be added to the cart.`);
        return;
      }
      const existingQuantity = cart.lines.find((line) => line.productId === product.id)?.quantity ?? 0;
      if (product.trackStock && existingQuantity >= product.stock) {
        toast.error("Stock limit reached", `Only ${product.stock} ${product.unitAbbreviation ?? "unit(s)"} of ${product.name} available.`);
        return;
      }

      cart.addLine(toCartLine(product));
      setSelectedProductId(product.id);
    },
    [cart, toast, toCartLine],
  );

  const scanBarcode = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      setScanning(true);
      try {
        const product = await api.get<PosProduct>(`/products/barcode${buildQuery({ code: trimmed })}`);
        addProduct(product);
        setBarcode("");
      } catch (error) {
        setBarcode("");
        toast.error(
          error instanceof ApiClientError && error.status === 404 ? "Product not found." : "Barcode lookup failed",
          trimmed,
        );
      } finally {
        setScanning(false);
        barcodeRef.current?.focus();
      }
    },
    [addProduct, toast],
  );

  const scanCameraBarcode = useCallback(
    async (code: string) => {
      setCameraOpen(false);
      await scanBarcode(code);
    },
    [scanBarcode],
  );

  // Catches hardware scanners even when focus has drifted away from the barcode box.
  useBarcodeScanner({ onScan: scanBarcode, enabled: !checkoutOpen && !customerOpen && !heldOpen });

  const holdSale = useCallback(async () => {
    if (cart.lines.length === 0 || !permissions.canHold) return;
    setBusy(true);
    try {
      await api.post("/sales/hold", {
        items: cart.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
        customerId: cart.customer?.id ?? null,
        discount: cart.discount ?? undefined,
        note: cart.note || undefined,
        resumeSaleId: cart.resumedSaleId ?? undefined,
      });
      toast.success("Sale held", "Resume it from Held sales.");
      cart.clear();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Could not hold the sale");
    } finally {
      setBusy(false);
      barcodeRef.current?.focus();
    }
  }, [cart, permissions.canHold, toast]);

  const resumeSale = useCallback(
    async (saleId: string) => {
      setBusy(true);
      try {
        const draft = await api.get<HeldSaleDetail>(`/sales/held/${saleId}`);
        cart.setLines(
          draft.items.map((item) => ({
            productId: item.productId,
            name: item.name,
            sku: item.sku,
            barcode: item.barcode,
            unitPrice: item.unitPrice,
            originalPrice: item.unitPrice,
            quantity: item.quantity,
            taxRate: item.taxRate,
            isVatInclusive: item.isVatInclusive,
            unitAbbreviation: item.unitAbbreviation,
            stock: Number.POSITIVE_INFINITY,
            trackStock: false,
          })),
        );
        cart.setCustomer(draft.customer);
        cart.setDiscount(draft.discount);
        cart.setResumedSaleId(draft.id);
        toast.success("Sale resumed");
      } catch (error) {
        toast.error(error instanceof ApiClientError ? error.message : "Could not resume the sale");
      } finally {
        setBusy(false);
      }
    },
    [cart, toast],
  );

  const completeSale = useCallback(
    async (payments: CheckoutPaymentInput[]): Promise<CheckoutResponse> => {
      try {
        return await api.post<CheckoutResponse>("/payments/checkout", {
          items: cart.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
          customerId: cart.customer?.id ?? null,
          discount: cart.discount ?? undefined,
          note: cart.note || undefined,
          payments,
          resumeSaleId: cart.resumedSaleId ?? undefined,
        });
      } catch (error) {
        if (!(error instanceof ApiClientError) && !navigator.onLine) saveOfflineDraft();
        throw error;
      }
    },
    [cart, saveOfflineDraft],
  );

  const finishSale = useCallback(() => {
    cart.clear();
    setCheckoutOpen(false);
    setCartOpen(false);
    barcodeRef.current?.focus();
  }, [cart]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const keyed = event.key;
      if (!keyed.startsWith("F") || keyed.length < 2) return;

      const actions: Record<string, () => void> = {
        F2: () => searchRef.current?.focus(),
        F3: () => barcodeRef.current?.focus(),
        F4: () => void holdSale(),
        F6: () => setCustomerOpen(true),
        F7: () => permissions.canDiscount && setDiscountOpen(true),
        F8: () => cart.lines.length > 0 && setCheckoutOpen(true),
        F9: () => cart.lines.length > 0 && setClearOpen(true),
      };

      const action = actions[keyed];
      if (!action) return;
      event.preventDefault();
      action();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [cart.lines.length, holdSale, permissions.canDiscount]);

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-3 max-sm:min-h-full sm:h-full sm:flex-row sm:gap-4 sm:overflow-hidden">
      {/* Catalogue */}
      <section className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            ref={barcodeRef}
            value={barcode}
            placeholder="Scan or type barcode, then press Enter"
            aria-label="Barcode"
            autoComplete="off"
            spellCheck={false}
            containerClassName="sm:max-w-sm"
            leftIcon={scanning ? <Loader2 className="size-4 animate-spin" /> : <ScanBarcode className="size-4" />}
            onChange={(event) => setBarcode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void scanBarcode(barcode);
            }}
          />
          <SearchInput
            ref={searchRef}
            placeholder="Search products (F2)"
            onSearch={setQuery}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            aria-label="Scan barcode with camera"
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-line-strong bg-card px-3 text-sm font-medium text-fg hover:bg-muted sm:w-auto"
          >
            <Camera className="size-4" />
            <span className="sm:hidden">Camera scan</span>
          </button>
        </div>

        <div className="no-scrollbar -mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-0.5">
          <CategoryChip label="All" active={categoryId === null} onClick={() => setCategoryId(null)} />
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              label={category.name}
              active={categoryId === category.id}
              onClick={() => setCategoryId(category.id)}
            />
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <ProductGrid products={products} loading={loadingProducts} onSelect={addProduct} />
        </div>

        <div className="hidden shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-muted lg:flex">
          {SHORTCUTS.map(([key, label]) => (
            <span key={key} className="flex items-center gap-1">
              <kbd className="rounded border border-line bg-muted px-1.5 py-0.5 font-mono">{key}</kbd>
              {label}
            </span>
          ))}
          <button type="button" onClick={() => setHeldOpen(true)} className="underline hover:text-fg">
            Held sales
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <CloudOff className={cn("size-3.5", online ? "text-fg-muted" : "text-warning")} />
          <span>{online ? "Online" : "Offline mode"}{offlineDraftCount > 0 ? ` · ${offlineDraftCount} pending` : ""}</span>
          {cart.lines.length > 0 && !online && (
            <button type="button" onClick={saveOfflineDraft} className="ml-auto font-medium text-brand-600 hover:underline">
              Save draft
            </button>
          )}
        </div>
      </section>

      {/* Cart — inline from tablet, full-screen sheet on phones */}
      <aside
        className={cn(
          "min-h-0 overflow-hidden rounded-card border border-line",
          "max-sm:fixed max-sm:inset-0 max-sm:z-50 max-sm:rounded-none max-sm:border-0",
          !cartOpen && "max-sm:hidden",
          "sm:flex sm:w-[320px] sm:shrink-0 lg:w-[360px] xl:w-[400px]",
        )}
      >
        <CartPanel
          cart={cart}
          busy={busy}
          selectedProductId={selectedProductId}
          onSelectLine={setSelectedProductId}
          onOpenCustomer={() => setCustomerOpen(true)}
          onOpenDiscount={() => setDiscountOpen(true)}
          onHold={holdSale}
          onClear={() => setClearOpen(true)}
          onCheckout={() => setCheckoutOpen(true)}
          onCloseMobile={() => setCartOpen(false)}
          canDiscount={permissions.canDiscount}
          canHold={permissions.canHold}
        />
      </aside>

      {/* Phone cart bar */}
      <div className="safe-bottom sticky bottom-0 z-30 flex items-center gap-3 rounded-card border border-line bg-card p-2.5 sm:hidden">
        <button
          type="button"
          onClick={() => setHeldOpen(true)}
          className="h-11 shrink-0 rounded-lg border border-line px-3 text-sm text-fg-secondary"
        >
          Held
        </button>
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="flex h-11 flex-1 items-center justify-between gap-3 rounded-lg bg-brand-600 px-4 text-white"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <ShoppingCart className="size-4" />
            View cart ({cart.totals.unitCount})
          </span>
          <Money value={cart.totals.total} className="font-semibold" />
        </button>
      </div>

      <CustomerPicker open={customerOpen} onClose={() => setCustomerOpen(false)} onSelect={cart.setCustomer} />

      <DiscountDialog
        open={discountOpen}
        subtotal={cart.totals.subtotal}
        current={cart.discount}
        onClose={() => setDiscountOpen(false)}
        onApply={cart.setDiscount}
      />

      <HeldSalesDialog open={heldOpen} onClose={() => setHeldOpen(false)} onResume={resumeSale} />

      <PaymentDialog
        open={checkoutOpen}
        total={cart.totals.total}
        methods={paymentMethods}
        mockDriver={mockPaymentDriver}
        onClose={() => setCheckoutOpen(false)}
        onSubmit={completeSale}
        onCompleted={() => void loadProducts()}
        onFinish={finishSale}
      />

      <CameraBarcodeScanner open={cameraOpen} onClose={() => setCameraOpen(false)} onDetected={(code) => void scanCameraBarcode(code)} />

      <ConfirmDialog
        open={clearOpen}
        title="Clear this sale?"
        message="All items, the customer and any discount will be removed."
        confirmLabel="Clear cart"
        destructive
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          cart.clear();
          setClearOpen(false);
          barcodeRef.current?.focus();
        }}
      />
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors",
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-line bg-card text-fg-secondary hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
