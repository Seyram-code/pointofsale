/**
 * Provider-agnostic payment contracts.
 *
 * Nothing in here imports a concrete gateway. Swapping the mock driver for a
 * live Ghanaian provider (Hubtel, Paystack, ExpressPay, a terminal bridge…)
 * means adding a class that satisfies `PaymentProvider` and registering it.
 */

export type PaymentMethod = "CASH" | "MOMO" | "CARD_TERMINAL" | "CARD";

export type PaymentState =
  | "PENDING"
  | "PROCESSING"
  | "SUCCESSFUL"
  | "FAILED"
  | "CANCELLED"
  | "REVERSED";

export type MomoNetwork = "MTN" | "VODAFONE" | "AIRTELTIGO";

export interface PaymentCapabilities {
  /** Customer must act on their phone or the terminal before the payment settles. */
  requiresCustomerAction: boolean;
  supportsStatusQuery: boolean;
  supportsRefund: boolean;
  supportsWebhook: boolean;
}

export interface CashDetails {
  tenderedAmount: number;
}

export interface MomoDetails {
  network: MomoNetwork;
  phone: string;
}

export interface TerminalDetails {
  /** Terminal ID (TID) of the till's card machine. */
  terminalId?: string;
}

export interface CardDetails {
  /** Only ever a masked/tokenised reference — raw PANs never enter this system. */
  token?: string;
  scheme?: string;
  last4?: string;
}

export interface PaymentRequest {
  method: PaymentMethod;
  /** Amount in Ghana Cedi, already rounded to 2dp by the pricing engine. */
  amount: number;
  currency: "GHS";
  /** Receipt number — shown to the customer on their MoMo prompt. */
  reference: string;
  description?: string;
  storeId: string;
  cashierId: string;
  saleId?: string;
  cash?: CashDetails;
  momo?: MomoDetails;
  terminal?: TerminalDetails;
  card?: CardDetails;
}

export interface PaymentResult {
  state: PaymentState;
  /** Provider-side identifier used for polling, reconciliation and refunds. */
  externalRef: string | null;
  amount: number;
  changeAmount?: number;
  /** Shown to the cashier, e.g. "Ask the customer to approve the prompt". */
  message?: string;
  failureReason?: string;
  authCode?: string;
  rrn?: string;
  cardScheme?: string;
  cardLast4?: string;
  raw?: Record<string, unknown>;
}

export interface RefundRequest {
  externalRef: string;
  amount: number;
  reason?: string;
  method: PaymentMethod;
}

export interface WebhookEvent {
  externalRef: string;
  state: PaymentState;
  amount?: number;
  raw: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly id: string;
  readonly method: PaymentMethod;
  readonly capabilities: PaymentCapabilities;

  /** Starts the payment. May return SUCCESSFUL immediately (cash) or PROCESSING (MoMo). */
  initiate(request: PaymentRequest): Promise<PaymentResult>;

  /** Polls the provider for the current state of an in-flight payment. */
  getStatus?(externalRef: string): Promise<PaymentResult>;

  refund?(request: RefundRequest): Promise<PaymentResult>;

  /** Validates the signature of an inbound callback and normalises the payload. */
  parseWebhook?(rawBody: string, headers: Record<string, string>): Promise<WebhookEvent | null>;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  MOMO: "Mobile Money",
  CARD_TERMINAL: "Ghana POS",
  CARD: "Card",
};
