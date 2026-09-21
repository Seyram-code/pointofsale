import { addMoney, money, multiplyMoney, subtractMoney, taxFromExclusive, taxFromInclusive } from "@/lib/utils/money";

export type CartDiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

export interface PricedLine {
  quantity: number;
  unitPrice: number;
  taxRate: number;
  isVatInclusive: boolean;
  lineDiscount?: number;
}

export interface LineTotals {
  gross: number;
  net: number;
  taxAmount: number;
  lineTotal: number;
}

export interface CartTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  itemCount: number;
  unitCount: number;
}

/**
 * Shared pricing engine. The client uses it to preview totals; the server
 * recomputes with database prices so a tampered cart cannot change the amount.
 */
export function computeCartTotals(
  lines: PricedLine[],
  discount?: { type: CartDiscountType; value: number },
): CartTotals & { lines: LineTotals[] } {
  const gross = lines.map((line) => money(multiplyMoney(line.unitPrice, line.quantity)));
  const netBeforeOrderDiscount = lines.map((line, index) => subtractMoney(gross[index], line.lineDiscount ?? 0));
  const subtotal = addMoney(...netBeforeOrderDiscount);

  let discountAmount = 0;
  if (discount && discount.value > 0 && subtotal > 0) {
    discountAmount =
      discount.type === "PERCENTAGE"
        ? multiplyMoney(subtotal, Math.min(discount.value, 100) / 100)
        : money(discount.value);
    discountAmount = Math.min(discountAmount, subtotal);
  }

  // Spread the order-level discount across lines so per-line tax stays correct.
  const ratio = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 0;

  const lineTotals: LineTotals[] = lines.map((line, index) => {
    const net = money(multiplyMoney(netBeforeOrderDiscount[index], ratio));
    const taxAmount = line.isVatInclusive
      ? taxFromInclusive(net, line.taxRate)
      : taxFromExclusive(net, line.taxRate);
    return {
      gross: gross[index],
      net,
      taxAmount,
      lineTotal: line.isVatInclusive ? net : addMoney(net, taxAmount),
    };
  });

  return {
    subtotal,
    discountAmount,
    taxAmount: addMoney(...lineTotals.map((line) => line.taxAmount)),
    total: addMoney(...lineTotals.map((line) => line.lineTotal)),
    itemCount: lines.length,
    unitCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    lines: lineTotals,
  };
}
