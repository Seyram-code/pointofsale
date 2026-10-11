import "server-only";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/response";
import { paystackConfig } from "@/lib/payments/config";

interface PaystackEnvelope<T> {
  status?: boolean;
  message?: string;
  data?: T;
}

interface PaystackBank {
  name?: string;
  code?: string;
  active?: boolean;
  country?: string;
  currency?: string;
  type?: string;
}

interface PaystackAccount {
  account_name?: string;
  account_number?: string;
}

interface PaystackSubaccount {
  subaccount_code?: string;
  account_name?: string;
  account_number?: string;
  settlement_bank?: string;
}

function paystackCredentials() {
  const config = paystackConfig();
  if (!config.baseUrl || !config.secretKey) {
    throw ApiError.badRequest("Paystack settlement is not configured. Contact the platform administrator.");
  }
  return { baseUrl: config.baseUrl.replace(/\/$/, ""), secretKey: config.secretKey };
}

function platformPercentageCharge() {
  const rawValue = process.env.PAYSTACK_PLATFORM_PERCENTAGE_CHARGE?.trim();
  if (!rawValue) return null;
  const value = Number(rawValue);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

async function paystackRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { baseUrl, secretKey } = paystackCredentials();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw ApiError.badRequest("Could not reach Paystack. Check the provider connection and try again.");
  }

  const payload = (await response.json().catch(() => ({}))) as PaystackEnvelope<T>;
  if (!response.ok || payload.status !== true || payload.data === undefined) {
    throw ApiError.badRequest(String(payload.message ?? "Paystack could not complete the settlement request."));
  }
  return payload.data;
}

export async function listPaystackSettlementBanks() {
  const banks = await paystackRequest<PaystackBank[]>("/bank?country=ghana&type=ghipss&perPage=100");
  return banks
    .filter((bank) => bank.active !== false && bank.code && bank.name)
    .map((bank) => ({ code: String(bank.code), name: String(bank.name) }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function verifyPaystackSettlementAccount(bankCode: string, accountNumber: string) {
  const query = new URLSearchParams({ account_number: accountNumber, bank_code: bankCode });
  const account = await paystackRequest<PaystackAccount>(`/bank/resolve?${query.toString()}`);
  const accountName = account.account_name?.trim();
  if (!accountName) throw ApiError.badRequest("Paystack could not verify the account name. Check the bank and account number.");
  return { accountName };
}

export async function getPaystackSettlementState(storeId: string) {
  const [store, paystackEnabled] = await Promise.all([
    prisma.store.findUnique({
      where: { id: storeId },
      select: {
        paystackSubaccountCode: true,
        paystackSettlementStatus: true,
        paystackSettlementBankCode: true,
        paystackSettlementBankName: true,
        paystackSettlementName: true,
        paystackSettlementLast4: true,
        paystackSettlementVerifiedAt: true,
      },
    }),
    prisma.setting.findUnique({
      where: { storeId_key: { storeId, key: "payments.paystack.enabled" } },
      select: { value: true },
    }),
  ]);
  if (!store) throw ApiError.notFound("Store");

  return {
    status: store.paystackSettlementStatus,
    bankCode: store.paystackSettlementBankCode,
    bankName: store.paystackSettlementBankName,
    accountName: store.paystackSettlementName,
    accountLast4: store.paystackSettlementLast4,
    verifiedAt: store.paystackSettlementVerifiedAt?.toISOString() ?? null,
    paystackEnabled: paystackEnabled ? paystackEnabled.value === true : true,
    platformPercentageCharge: platformPercentageCharge(),
    configured: Boolean(store.paystackSubaccountCode && store.paystackSettlementStatus === "VERIFIED"),
  };
}

export async function getPaystackSettlementRouting(storeId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { paystackSubaccountCode: true, paystackSettlementStatus: true },
  });
  if (!store) throw ApiError.notFound("Store");
  return {
    subaccountCode: store.paystackSettlementStatus === "VERIFIED" ? store.paystackSubaccountCode : null,
  };
}

export async function createPaystackSettlementSubaccount(storeId: string, bankCode: string, accountNumber: string) {
  const percentageCharge = platformPercentageCharge();
  if (percentageCharge === null) {
    throw ApiError.badRequest("The platform must configure PAYSTACK_PLATFORM_PERCENTAGE_CHARGE before shops can connect settlement accounts.");
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      paystackSubaccountCode: true,
      paystackSettlementStatus: true,
    },
  });
  if (!store) throw ApiError.notFound("Store");
  if (store.paystackSubaccountCode && store.paystackSettlementStatus === "VERIFIED") {
    throw ApiError.conflict("A Paystack settlement account is already connected. Contact support to change it.");
  }
  if (store.paystackSettlementStatus === "PENDING") {
    throw ApiError.conflict("A Paystack settlement setup is already in progress. Contact support if it remains pending.");
  }

  const bank = (await listPaystackSettlementBanks()).find((option) => option.code === bankCode);
  if (!bank) throw ApiError.badRequest("Choose a supported Ghanaian bank.");
  const { accountName } = await verifyPaystackSettlementAccount(bankCode, accountNumber);
  const accountLast4 = accountNumber.slice(-4);
  const claim = await prisma.store.updateMany({
    where: {
      id: store.id,
      paystackSubaccountCode: null,
      OR: [{ paystackSettlementStatus: null }, { paystackSettlementStatus: "FAILED" }],
    },
    data: {
      paystackSettlementStatus: "PENDING",
      paystackSettlementBankCode: bankCode,
      paystackSettlementBankName: bank.name,
      paystackSettlementName: accountName,
      paystackSettlementLast4: accountLast4,
      paystackSettlementVerifiedAt: null,
    },
  });
  if (claim.count !== 1) throw ApiError.conflict("Settlement setup changed while you were connecting. Refresh Settings and try again.");

  let subaccount: PaystackSubaccount;
  try {
    subaccount = await paystackRequest<PaystackSubaccount>("/subaccount", {
      method: "POST",
      body: JSON.stringify({
        business_name: store.name,
        settlement_bank: bankCode,
        account_number: accountNumber,
        percentage_charge: percentageCharge,
        description: `VidyPOS store ${store.id}`,
        primary_contact_email: store.email ?? undefined,
        primary_contact_name: store.name,
        primary_contact_phone: store.phone ?? undefined,
        metadata: JSON.stringify({ store_id: store.id }),
      }),
    });
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("Could not reach Paystack"))) {
      await prisma.store.updateMany({
        where: { id: store.id, paystackSettlementStatus: "PENDING", paystackSubaccountCode: null },
        data: { paystackSettlementStatus: "FAILED" },
      });
    }
    throw error;
  }
  const subaccountCode = subaccount.subaccount_code?.trim();
  if (!subaccountCode) {
    await prisma.store.updateMany({
      where: { id: store.id, paystackSettlementStatus: "PENDING", paystackSubaccountCode: null },
      data: { paystackSettlementStatus: "FAILED" },
    });
    throw ApiError.badRequest("Paystack did not return a settlement subaccount code.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.store.update({
      where: { id: store.id },
      data: {
        paystackSubaccountCode: subaccountCode,
        paystackSettlementStatus: "VERIFIED",
        paystackSettlementBankCode: bankCode,
        paystackSettlementBankName: bank.name,
        paystackSettlementName: accountName,
        paystackSettlementLast4: accountLast4,
        paystackSettlementVerifiedAt: new Date(),
      },
    });
    await tx.setting.upsert({
      where: { storeId_key: { storeId: store.id, key: "payments.paystack.enabled" } },
      create: { storeId: store.id, key: "payments.paystack.enabled", value: true },
      update: { value: true },
    });
  });

  return {
    status: "VERIFIED",
    bankName: bank.name,
    accountName,
    accountLast4,
    platformPercentageCharge: percentageCharge,
    paystackEnabled: true,
  };
}
