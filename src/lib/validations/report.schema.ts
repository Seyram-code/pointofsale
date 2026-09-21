import { z } from "zod";

export const reportQuerySchema = z.object({
  period: z.enum(["daily", "weekly", "monthly", "yearly"]).default("daily"),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  cashierId: z.string().min(1).optional(),
  paymentMethod: z.enum(["all", "CASH", "MOMO", "CARD_TERMINAL", "CARD"]).default("all"),
  productId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
