export interface OfflineDraftLine {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface OfflineDraftSaleTotalsInput {
  items: OfflineDraftLine[];
}

export function calculateOfflineSaleTotals(payload: OfflineDraftSaleTotalsInput) {
  const itemCount = payload.items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const subtotal = payload.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);

  return {
    subtotal: Number(subtotal.toFixed(2)),
    itemCount,
    total: Number(subtotal.toFixed(2)),
  };
}
