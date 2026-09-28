"use client";

import { useCallback, useMemo, useState } from "react";
import { computeCartTotals, type CartDiscountType } from "@/lib/services/pricing";

export interface CartLine {
  productId: string;
  name: string;
  sku: string;
  barcode: string | null;
  unitPrice: number;
  originalPrice: number;
  quantity: number;
  taxRate: number;
  isVatInclusive: boolean;
  unitAbbreviation: string | null;
  stock: number;
  trackStock: boolean;
}

export interface CartCustomer {
  id: string;
  fullName: string;
  phone: string | null;
}

export interface CartDiscount {
  type: CartDiscountType;
  value: number;
}

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<CartCustomer | null>(null);
  const [discount, setDiscount] = useState<CartDiscount | null>(null);
  const [note, setNote] = useState("");
  const [resumedSaleId, setResumedSaleId] = useState<string | null>(null);

  const addLine = useCallback((line: Omit<CartLine, "quantity">, quantity = 1) => {
    setLines((current) => {
      const index = current.findIndex((entry) => entry.productId === line.productId);
      const existingQuantity = index === -1 ? 0 : current[index].quantity;
      const availableQuantity = line.trackStock ? Math.max(line.stock - existingQuantity, 0) : quantity;
      const acceptedQuantity = line.trackStock ? Math.min(quantity, availableQuantity) : quantity;
      if (acceptedQuantity <= 0) return current;
      if (index === -1) return [...current, { ...line, quantity: acceptedQuantity }];

      // Repeat scans of the same barcode bump the existing line instead of duplicating it.
      const next = [...current];
      next[index] = { ...next[index], quantity: next[index].quantity + acceptedQuantity };
      return next;
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.productId !== productId)
        : current.map((line) =>
            line.productId === productId
              ? { ...line, quantity: line.trackStock ? Math.min(quantity, line.stock) : quantity }
              : line,
          ),
    );
  }, []);

  const adjustQuantity = useCallback((productId: string, delta: number) => {
    setLines((current) =>
      current
        .map((line) =>
          line.productId === productId
            ? {
                ...line,
                quantity: line.trackStock
                  ? Math.min(line.quantity + delta, line.stock)
                  : line.quantity + delta,
              }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }, []);

  const setUnitPrice = useCallback((productId: string, unitPrice: number) => {
    setLines((current) =>
      current.map((line) => (line.productId === productId ? { ...line, unitPrice } : line)),
    );
  }, []);

  const removeLine = useCallback((productId: string) => {
    setLines((current) => current.filter((line) => line.productId !== productId));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setCustomer(null);
    setDiscount(null);
    setNote("");
    setResumedSaleId(null);
  }, []);

  const totals = useMemo(
    () =>
      computeCartTotals(
        lines.map((line) => ({
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
          isVatInclusive: line.isVatInclusive,
        })),
        discount ?? undefined,
      ),
    [lines, discount],
  );

  return {
    lines,
    customer,
    discount,
    note,
    resumedSaleId,
    totals,
    addLine,
    setQuantity,
    adjustQuantity,
    setUnitPrice,
    removeLine,
    clear,
    setCustomer,
    setDiscount,
    setNote,
    setLines,
    setResumedSaleId,
  };
}

export type Cart = ReturnType<typeof useCart>;
