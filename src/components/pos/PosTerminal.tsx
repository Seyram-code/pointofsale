"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { MenuOptionsDialog, type MenuOptionChoice } from "@/components/pos/MenuOptionsDialog";
import { CameraBarcodeScanner } from "@/components/pos/CameraBarcodeScanner";
import { useCart, type CartLine } from "@/hooks/useCart";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useCurrentUser } from "@/components/providers/SessionProvider";
import { getPlanLimits } from "@/lib/config/plan-features";
import { getPlanFeatureStatus } from "@/lib/config/platform-features";
import { api, ApiClientError, buildQuery } from "@/lib/api/client";
import type { PosProduct } from "@/lib/services/product.service";
import type { PaymentMethod } from "@/lib/payments/types";
import type { RestaurantOrderType } from "@/lib/validations/sale.schema";

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
  orderType: RestaurantOrderType | null;
  tableNumber: string | null;
  items: Array<{
    productId: string;
    lineId: string;
    name: string;
    sku: string;
    barcode: string | null;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    isVatInclusive: boolean;
    unitAbbreviation: string | null;
    optionIds: string[];
    selectedOptions: MenuOptionChoice[];
  }>;
}

export interface PosTerminalProps {
  categories: PosCategory[];
  permissions: { canDiscount: boolean; canHold: boolean };
  paymentMethods: PosPaymentMethodOption[];
  mockCardDriver: boolean;
  mockMomoDriver: boolean;
  storeEmail: string;
  isRestaurant: boolean;
}

interface OfflineDraftPayload {
  id: string;
  customerId: string | null;
  note: string | null;
  orderType: RestaurantOrderType | null;
  tableNumber: string | null;
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

export function PosTerminal({ categories, permissions, paymentMethods, mockCardDriver, mockMomoDriver, storeEmail, isRestaurant }: PosTerminalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const cart = useCart();
  const currentUser = useCurrentUser();
  const scannerEnabled = currentUser.scannerOnPos;
  const customersEnabled = getPlanLimits(currentUser.plan).customers;
  const offlineEnabled = getPlanFeatureStatus(currentUser.plan, "offlinePos");

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
  const [orderType, setOrderType] = useState<RestaurantOrderType>("TAKEAWAY");
  const [tableNumber, setTableNumber] = useState("");
  const [pendingOptionsProduct, setPendingOptionsProduct] = useState<PosProduct | null>(null);
  const [pendingMenuOptions, setPendingMenuOptions] = useState<MenuOptionChoice[]>([]);

  const [cartOpen, setCartOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const returnSaleId = searchParams.get("payment_sale");
  const [clearOpen, setClearOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [offlineDraftCount, setOfflineDraftCount] = useState(0);

  const readOfflineDrafts = useCallback((): OfflineDraftPayload[] => {
    if (typeof window === "undefined") return [];

    try {
      const stored = window.localStorage.getItem(OFFLINE_DRAFTS_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? (parsed as OfflineDraftPayload[]) : [];
    } catch {
      return [];
    }
  }, []);

  const writeOfflineDrafts = useCallback((drafts: OfflineDraftPayload[]) => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(OFFLINE_DRAFTS_KEY, JSON.stringify(drafts));
      setOfflineDraftCount(drafts.length);
    } catch {
      toast.error("Storage limit reached", "Offline drafts could not be saved on this device.");
    }
  }, [toast]);

  const saveOfflineDraft = useCallback(() => {
    if (!offlineEnabled) {
      toast.error("Offline POS is not included", "Upgrade your plan to save sales while offline.");
      return;
    }
    if (cart.lines.length === 0) return;
    if (cart.lines.some((line) => line.optionIds.length > 0)) {
      toast.error("Menu add-ons need a connection", "Connect to the internet before saving this order offline.");
      return;
    }
    const draft: OfflineDraftPayload = {
      id: crypto.randomUUID(),
      customerId: cart.customer?.id ?? null,
      note: cart.note || null,
      orderType: isRestaurant ? orderType : null,
      tableNumber: isRestaurant && orderType === "DINE_IN" ? tableNumber.trim() : null,
      items: cart.lines.map((line) => ({ productId: line.productId, quantity: line.quantity, unitPrice: line.unitPrice })),
      createdAt: new Date().toISOString(),
    };
    writeOfflineDrafts([...readOfflineDrafts(), draft]);
    cart.clear();
    setCheckoutOpen(false);
    toast.success("Sale saved offline", "It will sync when the connection returns.");
  }, [cart, isRestaurant, offlineEnabled, orderType, readOfflineDrafts, tableNumber, toast, writeOfflineDrafts]);

  const syncOfflineDrafts = useCallback(async () => {
    if (!offlineEnabled || !navigator.onLine) return;
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
  }, [offlineEnabled, readOfflineDrafts, writeOfflineDrafts]);

  const handleConnectionStatusAction = useCallback(() => {
    if (!offlineEnabled) return;
    if (!online) {
      saveOfflineDraft();
      return;
    }
    if (offlineDraftCount > 0) {
      void syncOfflineDrafts();
    }
  }, [offlineDraftCount, offlineEnabled, online, saveOfflineDraft, syncOfflineDrafts]);

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
    (product: PosProduct, selectedOptions: MenuOptionChoice[] = []): Omit<CartLine, "quantity"> => ({
      lineId: `${product.id}:${selectedOptions.map((option) => option.id).sort().join(",")}`,
      productId: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      unitPrice: product.unitPrice + selectedOptions.reduce((sum, option) => sum + option.priceDelta, 0),
      originalPrice: product.unitPrice + selectedOptions.reduce((sum, option) => sum + option.priceDelta, 0),
      taxRate: product.taxRate,
      isVatInclusive: product.isVatInclusive,
      unitAbbreviation: product.unitAbbreviation,
      stock: product.stock,
      trackStock: product.trackStock,
      optionIds: selectedOptions.map((option) => option.id),
      selectedOptions,
    }),
    [],
  );

  const addProductWithOptions = useCallback(
    (product: PosProduct, selectedOptions: MenuOptionChoice[] = []) => {
      if (product.trackStock && product.stock <= 0) {
        toast.error("Out of stock", `${product.name} cannot be added to the cart.`);
        return;
      }
      const existingQuantity = cart.lines.filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.quantity, 0);
      if (product.trackStock && existingQuantity >= product.stock) {
        toast.error("Stock limit reached", `Only ${product.stock} ${product.unitAbbreviation ?? "unit(s)"} of ${product.name} available.`);
        return;
      }

      const line = toCartLine(product, selectedOptions);
      cart.addLine(line);
      setSelectedProductId(line.lineId);
    },
    [cart, toast, toCartLine],
  );

  const addProduct = useCallback(async (product: PosProduct) => {
    if (product.trackStock && product.stock <= 0) {
      toast.error("Out of stock", `${product.name} cannot be added to the cart.`);
      return;
    }
    if (isRestaurant) {
      if (product.menuOptions && product.menuOptions.length > 0) {
          setPendingMenuOptions(product.menuOptions);
          setPendingOptionsProduct(product);
          return;
      }
    }
    addProductWithOptions(product);
  }, [addProductWithOptions, isRestaurant, toast]);

  const scanBarcode = useCallback(
    async (code: string) => {
      if (!scannerEnabled) return;
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
    [addProduct, scannerEnabled, toast],
  );

  const scanCameraBarcode = useCallback(
    async (code: string) => {
      setCameraOpen(false);
      await scanBarcode(code);
    },
    [scanBarcode],
  );

  // Catches hardware scanners even when focus has drifted away from the barcode box.
  useBarcodeScanner({ onScan: scanBarcode, enabled: scannerEnabled && !checkoutOpen && !customerOpen && !heldOpen });

  const holdSale = useCallback(async () => {
    if (cart.lines.length === 0 || !permissions.canHold) return;
    setBusy(true);
    try {
      await api.post("/sales/hold", {
        items: cart.lines.map((line) => ({ productId: line.productId, quantity: line.quantity, optionIds: line.optionIds })),
        customerId: cart.customer?.id ?? null,
        ...(isRestaurant ? { orderType, tableNumber: orderType === "DINE_IN" ? tableNumber : undefined } : {}),
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
  }, [cart, isRestaurant, orderType, permissions.canHold, tableNumber, toast]);

  const resumeSale = useCallback(
    async (saleId: string) => {
      setBusy(true);
      try {
        const draft = await api.get<HeldSaleDetail>(`/sales/held/${saleId}`);
        cart.setLines(
          draft.items.map((item) => ({
            lineId: item.lineId,
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
            optionIds: item.optionIds,
            selectedOptions: item.selectedOptions,
          })),
        );
        cart.setCustomer(draft.customer);
        cart.setDiscount(draft.discount);
        setOrderType(draft.orderType ?? "TAKEAWAY");
        setTableNumber(draft.tableNumber ?? "");
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
          items: cart.lines.map((line) => ({ productId: line.productId, quantity: line.quantity, optionIds: line.optionIds })),
          customerId: cart.customer?.id ?? null,
          ...(isRestaurant ? { orderType, tableNumber: orderType === "DINE_IN" ? tableNumber : undefined } : {}),
          discount: cart.discount ?? undefined,
          note: cart.note || undefined,
          payments,
          resumeSaleId: cart.resumedSaleId ?? undefined,
        });
      } catch (error) {
        if (!(error instanceof ApiClientError) && !navigator.onLine) {
          if (offlineEnabled) saveOfflineDraft();
          else toast.error("Connection lost", "Offline sales are not available on your plan.");
        }
        throw error;
      }
    },
    [cart, isRestaurant, offlineEnabled, orderType, saveOfflineDraft, tableNumber, toast],
  );

  const finishSale = useCallback(() => {
    cart.clear();
    setCheckoutOpen(false);
    setCartOpen(false);
    void loadProducts();
    if (returnSaleId) router.replace("/pos");
    searchRef.current?.focus();
  }, [cart, loadProducts, returnSaleId, router]);

  const finishPaymentReturn = useCallback(() => {
    router.replace("/pos");
  }, [router]);

  const handlePaymentCompleted = useCallback(() => {
    void loadProducts();
  }, [loadProducts]);

  const restoreFailedOrder = useCallback(async (items: NonNullable<CheckoutResponse["orderItems"]>) => {
    const productsForOrder = await Promise.all(items.map(async (item) => {
      const matches = await api.get<PosProduct[]>(`/products/search${buildQuery({ q: item.sku, limit: 1 })}`);
      const product = matches.find((entry) => entry.id === item.productId);
      if (!product) throw new Error(`${item.sku} is no longer available. Check the sale before retrying.`);
      if (product.trackStock && product.stock < item.quantity) {
        throw new Error(`Only ${product.stock} unit(s) of ${product.name} are available now.`);
      }
      const availableOptions = isRestaurant ? product.menuOptions ?? [] : [];
      const selectedOptions = availableOptions.filter((option) => item.optionIds.includes(option.id));
      if (selectedOptions.length !== item.optionIds.length) throw new Error(`Some add-ons for ${product.name} are no longer available.`);
      return { product, quantity: item.quantity, selectedOptions };
    }));

    cart.setLines(productsForOrder.map(({ product, quantity, selectedOptions }) => ({
      ...toCartLine(product, selectedOptions),
      quantity,
    })));
    setCheckoutOpen(false);
    setCartOpen(false);
    if (returnSaleId) router.replace("/pos");
  }, [cart, isRestaurant, returnSaleId, router, toCartLine]);

  useEffect(() => {
    if (!returnSaleId) return;
    setCheckoutOpen(true);
  }, [returnSaleId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const keyed = event.key;
      if (!keyed.startsWith("F") || keyed.length < 2) return;

      const actions: Record<string, () => void> = {
        F2: () => searchRef.current?.focus(),
        F3: () => barcodeRef.current?.focus(),
        F4: () => void holdSale(),
        F6: () => customersEnabled && setCustomerOpen(true),
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
  }, [cart.lines.length, customersEnabled, holdSale, permissions.canDiscount]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-3 max-sm:min-h-full sm:h-full sm:flex-row sm:gap-4 sm:overflow-hidden">
      {/* Catalogue */}
      <section className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput
            ref={searchRef}
            placeholder="Search products (F2)"
            onSearch={setQuery}
            className="flex-1"
          />
          {scannerEnabled && <Input
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
          />}
          {scannerEnabled && <button
            type="button"
            onClick={() => setCameraOpen(true)}
            aria-label="Scan barcode with camera"
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-line-strong bg-card px-3 text-sm font-medium text-fg hover:bg-muted sm:w-auto"
          >
            <Camera className="size-4" />
            <span className="sm:hidden">Camera scan</span>
          </button>}
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
          <button
            type="button"
            onClick={handleConnectionStatusAction}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition hover:bg-muted"
            aria-label={online ? "Sync pending offline drafts" : "Save current cart as an offline draft"}
          >
            <CloudOff className={cn("size-3.5", online ? "text-fg-muted" : "text-warning")} />
            <span>
              {online ? "Online" : offlineEnabled ? "Offline mode" : "Offline unavailable"}
              {offlineEnabled && offlineDraftCount > 0 ? ` · ${offlineDraftCount} pending` : ""}
            </span>
          </button>
          {offlineEnabled && cart.lines.length > 0 && !online && (
            <button type="button" onClick={saveOfflineDraft} className="ml-auto font-medium text-brand-600 hover:underline">
              Save draft
            </button>
          )}
          {offlineEnabled && online && offlineDraftCount > 0 && (
            <button type="button" onClick={() => void syncOfflineDrafts()} className="ml-auto font-medium text-brand-600 hover:underline">
              Sync now
            </button>
          )}
        </div>
      </section>

      {/* Cart — inline from tablet, full-screen sheet on phones */}
      <aside
        className={cn(
          "min-h-0 overflow-hidden rounded-card border border-line",
          "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-50 max-sm:h-auto max-sm:max-h-[88dvh] max-sm:rounded-t-2xl max-sm:border max-sm:border-line max-sm:shadow-2xl",
          !cartOpen && "max-sm:hidden",
          "sm:flex sm:w-[320px] sm:shrink-0 lg:w-[360px] xl:w-[400px]",
        )}
      >
        <CartPanel
          cart={cart}
          isRestaurant={isRestaurant}
          orderType={orderType}
          tableNumber={tableNumber}
          onOrderTypeChange={(value) => {
            setOrderType(value);
            if (value !== "DINE_IN") setTableNumber("");
          }}
          onTableNumberChange={setTableNumber}
          busy={busy}
          selectedProductId={selectedProductId}
          onSelectLine={setSelectedProductId}
          onOpenCustomer={() => setCustomerOpen(true)}
          canSelectCustomer={customersEnabled}
          onOpenDiscount={() => setDiscountOpen(true)}
          onHold={holdSale}
          onClear={() => setClearOpen(true)}
          onCheckout={() => setCheckoutOpen(true)}
          onCloseMobile={() => setCartOpen(false)}
          canDiscount={permissions.canDiscount}
          canHold={permissions.canHold}
        />
      </aside>

      {cartOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(false)}
          aria-label="Close cart"
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
        />
      )}

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

      {customersEnabled && <CustomerPicker open={customerOpen} onClose={() => setCustomerOpen(false)} onSelect={cart.setCustomer} />}

      <DiscountDialog
        open={discountOpen}
        subtotal={cart.totals.subtotal}
        current={cart.discount}
        onClose={() => setDiscountOpen(false)}
        onApply={cart.setDiscount}
      />

      <HeldSalesDialog open={heldOpen} onClose={() => setHeldOpen(false)} onResume={resumeSale} />

      <MenuOptionsDialog
        open={pendingOptionsProduct !== null}
        productName={pendingOptionsProduct?.name ?? "menu item"}
        options={pendingMenuOptions}
        onClose={() => setPendingOptionsProduct(null)}
        onConfirm={(selected) => {
          if (pendingOptionsProduct) addProductWithOptions(pendingOptionsProduct, selected);
          setPendingOptionsProduct(null);
        }}
      />

      <PaymentDialog
        open={checkoutOpen}
        total={cart.totals.total}
        returnSaleId={returnSaleId}
        methods={paymentMethods}
        mockCardDriver={mockCardDriver}
        mockMomoDriver={mockMomoDriver}
        defaultEmail={storeEmail}
        onReturnHandled={finishPaymentReturn}
        onRestoreOrder={restoreFailedOrder}
        onClose={() => setCheckoutOpen(false)}
        onSubmit={completeSale}
        onCompleted={handlePaymentCompleted}
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
