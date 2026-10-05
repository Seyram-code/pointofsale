import "server-only";
import { cardConfig, missingKeys } from "@/lib/payments/config";
import { getAppUrl } from "@/lib/config/app-url";
import { PaymentNotConfiguredError } from "@/lib/payments/errors";
import { mapPaystackStatus } from "@/lib/payments/paystack-status";
import { generateAuthorizationCode, generateExternalReference } from "@/lib/services/id-registry";
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
      externalRef: generateExternalReference("MOCK-CARD"),
      amount: request.amount,
      authCode: generateAuthorizationCode(),
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
    if (!request.card?.email) {
      return {
        state: "FAILED",
        externalRef: null,
        amount: request.amount,
        failureReason: "A customer email is required for Paystack checkout",
      };
    }

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
        email: request.card.email,
        channels: ["card"],
        callback_url: request.callbackUrl ?? `${getAppUrl()}/pos${request.saleId ? `?payment_sale=${encodeURIComponent(request.saleId)}` : ""}`,
        metadata: { sale_id: request.saleId, store_id: request.storeId, ...request.metadata },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const authorizationUrl = String(data.authorization_url ?? "");
    if (!response.ok || payload.status !== true || !authorizationUrl) {
      return {
        state: "FAILED",
        externalRef: null,
        amount: request.amount,
        failureReason: String(payload.message ?? `Gateway returned ${response.status} without a checkout URL`),
        raw: payload,
      };
    }
    return {
      state: "PROCESSING",
      externalRef: String(data.reference ?? request.reference),
      amount: request.amount,
      message: "Waiting for the customer to complete the card payment",
      authorizationUrl,
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
    const status = payload.status === true ? String(data.status ?? "").toLowerCase() : "failed";
    const authorization = (data.authorization ?? {}) as Record<string, unknown>;

    return {
      state: mapPaystackStatus(status),
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

    const eventName = String(payload.event ?? "");
    return {
      externalRef: String(data.reference ?? ""),
      state: eventName === "charge.success" ? "SUCCESSFUL" : eventName === "charge.failed" ? "FAILED" : "PROCESSING",
      amount: Number(data.amount ?? 0) / 100,
      currency: typeof data.currency === "string" ? data.currency : undefined,
      method: "CARD",
      raw: payload,
    };
  }
}
