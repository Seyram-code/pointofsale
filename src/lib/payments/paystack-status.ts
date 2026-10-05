import type { PaymentState } from "@/lib/payments/types";

const FAILED_STATUSES = new Set(["abandoned", "cancelled", "canceled", "failed"]);

export function mapPaystackStatus(status: string): PaymentState {
  const normalized = status.toLowerCase();
  if (normalized === "success") return "SUCCESSFUL";
  if (FAILED_STATUSES.has(normalized)) return "FAILED";
  return "PROCESSING";
}