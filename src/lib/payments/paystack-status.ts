import type { PaymentState } from "@/lib/payments/types";

const FAILED_STATUSES = new Set(["cancelled", "canceled", "failed"]);

export function mapPaystackStatus(status: string): PaymentState {
  const normalized = status.toLowerCase();
  if (normalized === "success") return "SUCCESSFUL";
  if (FAILED_STATUSES.has(normalized)) return "FAILED";
  return "PROCESSING";
}

export function mapPaystackVerificationStatus(apiSucceeded: boolean, transactionStatus: string): PaymentState {
  return apiSucceeded ? mapPaystackStatus(transactionStatus) : "PROCESSING";
}

export function isSuccessfulPaystackMomo(
  apiSucceeded: boolean,
  transactionStatus: string,
  channel: string,
  currency: string,
): boolean {
  return apiSucceeded && transactionStatus.toLowerCase() === "success" && channel.toLowerCase() === "mobile_money" && currency.toUpperCase() === "GHS";
}

export function isSuccessfulPaystackCard(
  apiSucceeded: boolean,
  transactionStatus: string,
  channel: string,
  currency: string,
): boolean {
  return apiSucceeded && transactionStatus.toLowerCase() === "success" && channel.toLowerCase() === "card" && currency.toUpperCase() === "GHS";
}

export function paystackFailureReason(status: string): string | undefined {
  switch (status.toLowerCase()) {
    case "cancelled":
    case "canceled":
      return "The Paystack payment was cancelled.";
    case "failed":
      return "Paystack reports the payment failed.";
    default:
      return undefined;
  }
}