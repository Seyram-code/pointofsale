import type { PaymentMethod } from "@/lib/payments/types";

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_CONFIGURED"
      | "PROVIDER_UNAVAILABLE"
      | "DECLINED"
      | "TIMEOUT"
      | "INVALID_REQUEST"
      | "UNSUPPORTED",
    readonly method?: PaymentMethod,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

/** Thrown when a live driver is selected but its credentials are absent. */
export class PaymentNotConfiguredError extends PaymentError {
  constructor(method: PaymentMethod, missing: string[]) {
    super(
      `${method} payments are not configured. Missing environment variables: ${missing.join(", ")}`,
      "NOT_CONFIGURED",
      method,
    );
    this.name = "PaymentNotConfiguredError";
  }
}
