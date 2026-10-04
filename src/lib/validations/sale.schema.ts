import { z } from "zod";

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive().max(9999),
  /** Only honoured when the cashier holds the price-override permission. */
  unitPriceOverride: z.coerce.number().nonnegative().optional(),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;

export const cartDiscountSchema = z.object({
  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  value: z.coerce.number().nonnegative(),
});

export type CartDiscountInput = z.infer<typeof cartDiscountSchema>;

export const paymentInputSchema = z.object({
  method: z.enum(["CASH", "MOMO", "CARD_TERMINAL", "CARD"]),
  amount: z.coerce.number().positive(),
  tenderedAmount: z.coerce.number().nonnegative().optional(),
  momoNetwork: z.enum(["MTN", "VODAFONE", "AIRTELTIGO"]).optional(),
  momoPhone: z.string().trim().max(20).optional(),
  momoEmail: z.string().trim().email().max(254).optional(),
  terminalId: z.string().trim().max(60).optional(),
  cardScheme: z.string().trim().max(30).optional(),
  cardLast4: z.string().trim().regex(/^\d{4}$/).optional(),
  cardEmail: z.string().trim().email().max(254).optional(),
});

export type PaymentInput = z.infer<typeof paymentInputSchema>;

export const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Add at least one product"),
  customerId: z.string().min(1).nullable().optional(),
  discount: cartDiscountSchema.optional(),
  note: z.string().trim().max(500).optional(),
  payments: z.array(paymentInputSchema).min(1, "At least one payment is required"),
  /** Draft being resumed — replaced rather than duplicated. */
  resumeSaleId: z.string().min(1).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const holdSaleSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Add at least one product"),
  customerId: z.string().min(1).nullable().optional(),
  discount: cartDiscountSchema.optional(),
  note: z.string().trim().max(500).optional(),
  resumeSaleId: z.string().min(1).optional(),
});

export type HoldSaleInput = z.infer<typeof holdSaleSchema>;

export const productSearchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  categoryId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

export const barcodeLookupSchema = z.object({
  code: z.string().trim().min(1, "Barcode is required").max(60),
});
