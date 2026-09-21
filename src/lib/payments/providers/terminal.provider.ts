import "server-only";
import { missingKeys, terminalConfig } from "@/lib/payments/config";
import { PaymentError, PaymentNotConfiguredError } from "@/lib/payments/errors";
import type { PaymentProvider, PaymentRequest, PaymentResult } from "@/lib/payments/types";

/**
 * Ghana POS card terminals are not reachable over the public internet. A small
 * bridge service runs on the till LAN and speaks to the terminal over
 * USB/serial/TCP; this adapter only talks to that bridge.
 */
export class MockTerminalProvider implements PaymentProvider {
  readonly id = "terminal.mock";
  readonly method = "CARD_TERMINAL" as const;
  readonly capabilities = {
    requiresCustomerAction: true,
    supportsStatusQuery: true,
    supportsRefund: true,
    supportsWebhook: false,
  };

  async initiate(request: PaymentRequest): Promise<PaymentResult> {
    return {
      state: "SUCCESSFUL",
      externalRef: `MOCK-POS-${Date.now()}`,
      amount: request.amount,
      authCode: String(Math.floor(100000 + Math.random() * 899999)),
      rrn: `${Date.now()}`.slice(-12),
      cardScheme: "GHLINK",
      cardLast4: "4242",
      message: "Mock terminal approved the card",
      raw: { mock: true, terminalId: request.terminal?.terminalId ?? null },
    };
  }

  async getStatus(externalRef: string): Promise<PaymentResult> {
    return { state: "SUCCESSFUL", externalRef, amount: 0 };
  }

  async refund(): Promise<PaymentResult> {
    return { state: "REVERSED", externalRef: null, amount: 0, message: "Mock terminal reversal accepted" };
  }
}

export class LiveTerminalProvider implements PaymentProvider {
  readonly id = "terminal.live";
  readonly method = "CARD_TERMINAL" as const;
  readonly capabilities = {
    requiresCustomerAction: true,
    supportsStatusQuery: true,
    supportsRefund: true,
    supportsWebhook: false,
  };

  private config() {
    const config = terminalConfig();
    const missing = missingKeys(config, ["bridgeUrl", "apiKey"]);
    if (missing.length > 0) throw new PaymentNotConfiguredError("CARD_TERMINAL", missing);
    return config;
  }

  private async call(path: string, body: unknown, timeoutMs: number, apiKey: string, baseUrl: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      return { response, payload: (await response.json().catch(() => ({}))) as Record<string, unknown> };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new PaymentError("The card terminal did not respond in time", "TIMEOUT", "CARD_TERMINAL");
      }
      throw new PaymentError("Could not reach the card terminal bridge", "PROVIDER_UNAVAILABLE", "CARD_TERMINAL");
    } finally {
      clearTimeout(timer);
    }
  }

  async initiate(request: PaymentRequest): Promise<PaymentResult> {
    const config = this.config();

    const { response, payload } = await this.call(
      "/transactions/purchase",
      {
        amount: request.amount,
        currency: request.currency,
        reference: request.reference,
        terminalId: request.terminal?.terminalId,
      },
      config.timeoutMs,
      config.apiKey!,
      config.bridgeUrl!,
    );

    if (!response.ok || payload.approved !== true) {
      return {
        state: "FAILED",
        externalRef: payload.transactionId ? String(payload.transactionId) : null,
        amount: request.amount,
        failureReason: String(payload.responseMessage ?? "Card declined"),
        raw: payload,
      };
    }

    return {
      state: "SUCCESSFUL",
      externalRef: String(payload.transactionId),
      amount: request.amount,
      authCode: payload.authCode ? String(payload.authCode) : undefined,
      rrn: payload.rrn ? String(payload.rrn) : undefined,
      cardScheme: payload.scheme ? String(payload.scheme) : undefined,
      cardLast4: payload.last4 ? String(payload.last4) : undefined,
      raw: payload,
    };
  }

  async getStatus(externalRef: string): Promise<PaymentResult> {
    const config = this.config();
    const { payload } = await this.call(
      "/transactions/status",
      { transactionId: externalRef },
      config.timeoutMs,
      config.apiKey!,
      config.bridgeUrl!,
    );

    const status = String(payload.status ?? "").toLowerCase();
    return {
      state: status === "approved" ? "SUCCESSFUL" : status === "declined" ? "FAILED" : "PROCESSING",
      externalRef,
      amount: Number(payload.amount ?? 0),
      raw: payload,
    };
  }

  async refund(request: { externalRef: string; amount: number }): Promise<PaymentResult> {
    const config = this.config();
    const { response, payload } = await this.call(
      "/transactions/reversal",
      { transactionId: request.externalRef, amount: request.amount },
      config.timeoutMs,
      config.apiKey!,
      config.bridgeUrl!,
    );

    return {
      state: response.ok && payload.approved === true ? "REVERSED" : "FAILED",
      externalRef: request.externalRef,
      amount: request.amount,
      raw: payload,
    };
  }
}
