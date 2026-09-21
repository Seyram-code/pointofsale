import "server-only";
import { cardConfig, missingKeys } from "@/lib/payments/config";
import { PaymentNotConfiguredError } from "@/lib/payments/errors";
import type { PaymentProvider, PaymentRequest, PaymentResult, WebhookEvent } from "@/lib/payments/types";

/**
 * Card-not-present payments (payment link / hosted checkout), as opposed to the
 * physical Ghana POS terminal. Raw card data never touches this system — the
 * gateway tokenises it.
 */
export class MockCardProvider implements PaymentProvider {
  readonly id = "card.mock";
  readonly method = "CARD" as const;
  readonly capabilities = {
    requiresCustomerAction: true,
    supportsStatusQuery: true,
    supportsRefund: true,
    supportsWebhook: false,
  };

  async initiate(request: PaymentRequest): Promise<PaymentResult> {
    return {
      state: "SUCCESSFUL",
      externalRef: `MOCK-CARD-${Date.now()}`,
      amount: request.amount,
      authCode: String(Math.floor(100000 + Math.random() * 899999)),
      cardScheme: request.card?.scheme ?? "VISA",
      cardLast4: request.card?.last4 ?? "4242",
      message: "Mock card authorised",
      raw: { mock: true },
    };
  }

  async getStatus(externalRef: string): Promise<PaymentResult> {
    return { state: "SUCCESSFUL", externalRef, amount: 0 };
  }

  async refund(): Promise<PaymentResult> {
    return { state: "REVERSED", externalRef: null, amount: 0, message: "Mock card refund accepted" };
  }
}

/** Live gateway adapter (Paystack-shaped; amounts are sent in pesewas). */
export class LiveCardProvider implements PaymentProvider {
  readonly id = "card.live";
  readonly method = "CARD" as const;
  readonly capabilities = {
    requiresCustomerAction: true,
    supportsStatusQuery: true,
    supportsRefund: true,
    supportsWebhook: true,
  };

  private config() {
    const config = cardConfig();
    const missing = missingKeys(config, ["baseUrl", "secretKey"]);
    if (missing.length > 0) throw new PaymentNotConfiguredError("CARD", missing);
    return config;
  }

  async initiate(request: PaymentRequest): Promise<PaymentResult> {
    const config = this.config();

    const response = await fetch(`${config.baseUrl}/transaction/initialize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.secretKey}`,
      },
      body: JSON.stringify({
        amount: Math.round(request.amount * 100),
        currency: request.currency,
        reference: request.reference,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok || payload.status !== true) {
      return {
        state: "FAILED",
        externalRef: null,
        amount: request.amount,
        failureReason: String(payload.message ?? `Gateway returned ${response.status}`),
        raw: payload,
      };
    }

    const data = (payload.data ?? {}) as Record<string, unknown>;
    return {
      state: "PROCESSING",
      externalRef: String(data.reference ?? request.reference),
      amount: request.amount,
      message: "Waiting for the customer to complete the card payment",
      raw: payload,
    };
  }

  async getStatus(externalRef: string): Promise<PaymentResult> {
    const config = this.config();

    const response = await fetch(`${config.baseUrl}/transaction/verify/${encodeURIComponent(externalRef)}`, {
      headers: { Authorization: `Bearer ${config.secretKey}` },
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const status = String(data.status ?? "").toLowerCase();
    const authorization = (data.authorization ?? {}) as Record<string, unknown>;

    return {
      state: status === "success" ? "SUCCESSFUL" : status === "failed" ? "FAILED" : "PROCESSING",
      externalRef,
      amount: Number(data.amount ?? 0) / 100,
      cardScheme: authorization.brand ? String(authorization.brand).toUpperCase() : undefined,
      cardLast4: authorization.last4 ? String(authorization.last4) : undefined,
      raw: payload,
    };
  }

  async parseWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookEvent | null> {
    const config = cardConfig();
    const secret = config.webhookSecret ?? config.secretKey;
    if (!secret) throw new PaymentNotConfiguredError("CARD", ["webhookSecret"]);

    const signature = headers["x-paystack-signature"] ?? headers["x-webhook-signature"];
    const { createHmac, timingSafeEqual } = await import("node:crypto");
    const expected = createHmac("sha512", secret).update(rawBody).digest("hex");

    if (
      !signature ||
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      return null;
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const data = (payload.data ?? {}) as Record<string, unknown>;

    return {
      externalRef: String(data.reference ?? ""),
      state: payload.event === "charge.success" ? "SUCCESSFUL" : "FAILED",
      amount: Number(data.amount ?? 0) / 100,
      raw: payload,
    };
  }
}
