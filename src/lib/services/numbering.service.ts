import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type TxClient = Prisma.TransactionClient | typeof prisma;

const PREFIXES: Record<string, string> = {
  RECEIPT: "RCP",
  PO: "PO",
  RETURN: "RTN",
  SHIFT: "SHF",
  CUSTOMER: "CUS",
  SUPPLIER: "SUP",
  STAFF: "STF",
  EMPLOYEE: "EMP",
};

export const STAFF_ROLE_PREFIXES: Record<string, string> = {
  ADMIN: "ADM",
  MANAGER: "MGR",
  SUPERVISOR: "SUP",
  CASHIER: "CSH",
  STOCK_KEEPER: "STK",
  ACCOUNTANT: "ACC",
};

/**
 * Allocates the next number for a scope. The atomic `update` on a unique row
 * keeps concurrent tills from ever sharing a receipt number.
 */
export async function nextNumber(client: TxClient, storeId: string, scope: keyof typeof PREFIXES | string) {
  const now = new Date();
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const prefix = PREFIXES[scope] ?? scope.slice(0, 3).toUpperCase();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const sequence = await client.numberSequence.upsert({
        where: { storeId_scope_period: { storeId, scope, period } },
        create: { storeId, scope, period, prefix, current: 1 },
        update: { current: { increment: 1 } },
        select: { current: true },
      });

      return `${prefix}-${period.replace("-", "")}-${String(sequence.current).padStart(5, "0")}`;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) continue;
      throw error;
    }
  }

  throw new Error(`Could not allocate a unique ${scope} number for store ${storeId}`);
}

export async function nextShortNumber(client: TxClient, storeId: string, scope: string, prefix: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const sequence = await client.numberSequence.upsert({
        where: { storeId_scope_period: { storeId, scope, period: "ALL" } },
        create: { storeId, scope, period: "ALL", prefix, current: 1 },
        update: { current: { increment: 1 } },
        select: { current: true },
      });

      if (sequence.current > 9999) throw new Error(`The ${scope} sequence has reached its four-digit limit`);
      return `${prefix}${String(sequence.current).padStart(4, "0")}`;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) continue;
      throw error;
    }
  }

  throw new Error(`Could not allocate a unique short code for ${scope} in store ${storeId}`);
}

export async function peekShortNumber(storeId: string, scope: string, prefix: string) {
  const sequence = await prisma.numberSequence.findUnique({
    where: { storeId_scope_period: { storeId, scope, period: "ALL" } },
    select: { current: true },
  });
  const next = (sequence?.current ?? 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}
