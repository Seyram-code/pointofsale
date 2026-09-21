import { z } from "zod";

export const returnItemSchema = z.object({
  saleItemId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  condition: z.enum(["RESALEABLE", "DAMAGED", "EXPIRED"]).optional(),
  reason: z.string().trim().max(300).optional(),
});

export const createReturnSchema = z.object({
  receiptNumber: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(500),
  refundMethod: z.enum(["CASH", "MOMO", "CARD_REVERSAL", "STORE_CREDIT", "EXCHANGE"]).default("CASH"),
  restock: z.boolean().default(true),
  items: z.array(returnItemSchema).min(1),
});

export const returnActionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "COMPLETE"]),
});
