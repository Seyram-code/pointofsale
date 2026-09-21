import { z } from "zod";

export const inventoryQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["all", "low", "out"]).default("all"),
  categoryId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;

export const stockReceiptSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive().max(1_000_000),
  unitCost: z.coerce.number().nonnegative().max(1_000_000).optional(),
  batchNumber: z.string().trim().max(80).optional(),
  expiryDate: z.coerce.date().optional(),
  reference: z.string().trim().max(100).optional(),
  reason: z.string().trim().max(300).optional(),
});

export type StockReceiptInput = z.infer<typeof stockReceiptSchema>;

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().min(-1_000_000).max(1_000_000).refine((value) => value !== 0, "Quantity cannot be zero"),
  reason: z.string().trim().min(3, "Explain why the stock is changing").max(300),
  reference: z.string().trim().max(100).optional(),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export const movementQuerySchema = z.object({
  productId: z.string().optional(),
  type: z
    .enum(["all", "PURCHASE_RECEIPT", "SALE", "SALE_RETURN", "ADJUSTMENT_IN", "ADJUSTMENT_OUT", "DAMAGE", "EXPIRY", "STOCK_COUNT"])
    .default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
