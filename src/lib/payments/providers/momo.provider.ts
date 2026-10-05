import "server-only";
import { missingKeys, momoConfig, paystackConfig } from "@/lib/payments/config";
import { getAppUrl } from "@/lib/config/app-url";
import { PaymentError, PaymentNotConfiguredError } from "@/lib/payments/errors";
import { mapPaystackStatus } from "@/lib/payments/paystack-status";
import { normalizeGhanaPhone } from "@/lib/utils/format";
import { MOMO_NETWORK_PREFIXES } from "@/lib/config/constants";
import { generateExternalReference } from "@/lib/services/id-registry";
import type {
  MomoNetwork,
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
  WebhookEvent,
} from "@/lib/payments/types";

function validate(request: PaymentRequest) {
  const phone = request.momo?.phone ? normalizeGhanaPhone(request.momo.phone) : null;
  if (!phone) {
    throw new PaymentError("A valid Ghanaian mobile number is required", "INVALID_REQUEST", "MOMO");
  }

  const network = request.momo!.network;
  const prefix = phone.slice(0, 3);
  const expected = Object.entries(MOMO_NETWORK_PREFIXES).find(([, prefixes]) => prefixes.includes(prefix));

  // A mismatched network is the most common cause of failed prompts in the field.
  if (expected && expected[0] !== network) {
    throw new PaymentError(
      `${phone} looks like a ${expected[0]} number, not ${network}`,
      "INVALID_REQUEST",
      "MOMO",
    );
  }

  return { phone, network: network as MomoNetwork };
}

/** Simulates the push-prompt lifecycle so the till can be exercised without a gateway. */
export class MockMomoProvider implements PaymentProvider {
  readonly id = "momo.mock";
  readonly method = "MOMO" as const;
  readonly capabilities = {
    requiresCustomerAction: true,
    supportsStatusQuery: true,
    supportsRefund: true,
    supportsWebhook: false,
  };

  async initiate(request: PaymentRequest): Promise<PaymentResult> {
    const { phone, network } = validate(request);

    return {
      state: "SUCCESSFUL",
      externalRef: generateExternalReference("MOCK-MOMO"),
      amount: request.amount,
      message: `Mock ${network} prompt approved on ${phone}`,
      raw: { mock: true, phone, network },
    };
  }

  async getStatus(externalRef: string): Promise<PaymentResult> {
    return { state: "SUCCESSFUL", externalRef, amount: 0, message: "Mock payment settled" };
  }

  async refund(): Promise<PaymentResult> {
    return { state: "REVERSED", externalRef: null, amount: 0, message: "Mock refund accepted" };
  }
}

/** Paystack hosted checkout restricted to its mobile-money channel. */
export class PaystackMomoProvider implements PaymentProvider {
  readonly id = "momo.paystack";
  readonly method = "MOMO" as const;
  readonly capabilities = {
    requiresCustomerAction: true,
    supportsStatusQuery: true,
    supportsRefund: true,
    supportsWebhook: true,
  };

  private config() {
    const config = paystackConfig();
    const missing = missingKeys(config, ["baseUrl", "secretKey"]);
    if (missing.length > 0) throw new PaymentNotConfiguredError("MOMO", missing);
    return config;
  }

  async initiate(request: PaymentRequest): Promise<PaymentResult> {
    const config = this.config();
    const { phone, network } = validate(request);
    if (!request.momo?.email) {
      return {
        state: "FAILED",
        externalRef: null,
        amount: request.amount,
        failureReason: "A customer email is required for Paystack mobile-money checkout",
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
        email: request.momo.email,
        channels: ["mobile_money"],
        callback_url: request.callbackUrl ?? `${getAppUrl()}/pos${request.saleId ? `?payment_sale=${encodeURIComponent(request.saleId)}` : ""}`,
        metadata: {
          sale_id: request.saleId,
          store_id: request.storeId,
          momo_network: network,
          momo_phone: phone,
          ...request.metadata,
        },
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
        failureReason: String(payload.message ?? `Paystack returned ${response.status} without a checkout URL`),
        raw: payload,
      };
    }

    return {
      state: "PROCESSING",
      externalRef: String(data.reference ?? request.reference),
      amount: request.amount,
      message: `Continue on Paystack to approve the ${network} mobile-money payment`,
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
    const isMobileMoney = String(data.channel ?? "").toLowerCase() === "mobile_money";
    const isGhs = String(data.currency ?? "").toUpperCase() === "GHS";
    const isSuccessful = status === "success" && isMobileMoney && isGhs;

    return {
      state: isSuccessful ? "SUCCESSFUL" : status === "success" ? "FAILED" : mapPaystackStatus(status),
      externalRef,
      amount: Number(data.amount ?? 0) / 100,
      failureReason: status === "success" && !isSuccessful ? "Verified transaction was not GHS mobile money" : undefined,
      raw: payload,
    };
  }

  async parseWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookEvent | null> {
    const config = this.config();
    const secret = config.webhookSecret ?? config.secretKey;
    if (!secret) throw new PaymentNotConfiguredError("MOMO", ["webhookSecret"]);

    const signature = headers["x-paystack-signature"];
    const { createHmac, timingSafeEqual } = await import("node:crypto");
    const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
    if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
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
      method: "MOMO",
      raw: payload,
    };
  }
}

/**
 * Live aggregator adapter (Hubtel-shaped). The request/response mapping is the
 * only part that needs revisiting when the real merchant account is issued.
 */
export class LiveMomoProvider implements PaymentProvider {
  readonly id = "momo.live";
  readonly method = "MOMO" as const;
  readonly capabilities = {
    requiresCustomerAction: true,
    supportsStatusQuery: true,
    supportsRefund: true,
    supportsWebhook: true,
  };

  private config() {
    const config = momoConfig();
    const missing = missingKeys(config, ["baseUrl", "clientId", "clientSecret", "merchantAccount"]);
    if (missing.length > 0) throw new PaymentNotConfiguredError("MOMO", missing);
    return config;
  }

  private authHeader(clientId: string, clientSecret: string) {
    return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  }

  async initiate(request: PaymentRequest): Promise<PaymentResult> {
    const config = this.config();
    const { phone, network } = validate(request);

    const response = await fetch(`${config.baseUrl}/merchantaccount/merchants/${config.merchantAccount}/receive/mobilemoney`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader(config.clientId!, config.clientSecret!),
      },
      body: JSON.stringify({
        CustomerName: request.description ?? "POS customer",
        CustomerMsisdn: phone,
        CustomerEmail: "",
        Channel: network.toLowerCase(),
        Amount: request.amount,
        PrimaryCallbackUrl: config.callbackUrl,
        Description: request.description ?? request.reference,
        ClientReference: request.reference,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      return {
        state: "FAILED",
        externalRef: null,
        amount: request.amount,
        failureReason: String(payload.Message ?? `Provider returned ${response.status}`),
        raw: payload,
      };
    }

    const data = (payload.Data ?? {}) as Record<string, unknown>;
    return {
      state: "PROCESSING",
      externalRef: String(data.TransactionId ?? request.reference),
      amount: request.amount,
      message: `Approve the ${network} prompt on ${phone}`,
      raw: payload,
    };
  }

  async getStatus(externalRef: string): Promise<PaymentResult> {
    const config = this.config();

    const response = await fetch(
      `${config.baseUrl}/merchantaccount/merchants/${config.merchantAccount}/transactions/status?clientReference=${encodeURIComponent(externalRef)}`,
      { headers: { Authorization: this.authHeader(config.clientId!, config.clientSecret!) } },
    );

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const data = (payload.Data ?? {}) as Record<string, unknown>;
    const status = String(data.Status ?? "").toLowerCase();

    return {
      state: status === "paid" ? "SUCCESSFUL" : status === "failed" ? "FAILED" : "PROCESSING",
      externalRef,
      amount: Number(data.Amount ?? 0),
      raw: payload,
    };
  }

  async parseWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookEvent | null> {
    const config = momoConfig();
    if (!config.webhookSecret) throw new PaymentNotConfiguredError("MOMO", ["webhookSecret"]);

    const signature = headers["x-webhook-signature"] ?? headers["authorization"];
    const { createHmac, timingSafeEqual } = await import("node:crypto");
    const expected = createHmac("sha256", config.webhookSecret).update(rawBody).digest("hex");

    if (
      !signature ||
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      return null;
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const data = (payload.Data ?? payload) as Record<string, unknown>;
    const status = String(data.Status ?? "").toLowerCase();

    return {
      externalRef: String(data.ClientReference ?? data.TransactionId ?? ""),
      state: status === "paid" ? "SUCCESSFUL" : status === "failed" ? "FAILED" : "PROCESSING",
      amount: Number(data.Amount ?? 0),
      raw: payload,
    };
  }
}
