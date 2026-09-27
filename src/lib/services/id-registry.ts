import "server-only";

const STORE_TOKEN_LENGTH = 8;
const BUSINESS_TOKEN_LENGTH = 12;

function randomToken(length: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const raw = crypto.randomUUID().replace(/-/g, "").toUpperCase();
  return raw.slice(0, length).padEnd(length, alphabet[0]);
}

function normalizeStoreId(storeId: string) {
  const trimmed = (storeId ?? "").trim();
  if (!trimmed) {
    throw new Error("A storeId is required to generate a store-scoped identifier");
  }
  return trimmed;
}

export function generateBusinessId() {
  return `BUS-${randomToken(BUSINESS_TOKEN_LENGTH)}`;
}

export function generateBranchCode() {
  return `SHOP-${randomToken(STORE_TOKEN_LENGTH)}`;
}

export function generateExternalReference(prefix: string) {
  const cleanPrefix = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "REF";
  return `${cleanPrefix}-${randomToken(16)}`;
}

export function generateAuthorizationCode() {
  return String((Number.parseInt(randomToken(8), 16) % 900000) + 100000);
}

export function generateRetrievalReference() {
  return randomToken(12);
}

export function generateStoreScopedReference(storeId: string, prefix: string, suffixLength = 6) {
  const safeStoreId = normalizeStoreId(storeId);
  const token = randomToken(suffixLength);
  return `${prefix}-${safeStoreId.slice(0, 8).toUpperCase()}-${token}`;
}

export function generateShortCode(storeId: string, prefix: string, sequence: number, width = 4) {
  const safeStoreId = normalizeStoreId(storeId);
  const cleanPrefix = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "REF";
  return `${cleanPrefix}-${safeStoreId.slice(0, 6).toUpperCase()}-${String(sequence).padStart(width, "0")}`;
}

export function formatScopeKey(scope: string) {
  const normalized = scope.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  return normalized || "GENERIC";
}

export function validateStoreScopedNumber(value: string, scope: string) {
  if (!value || typeof value !== "string") {
    throw new Error(`Invalid ${scope} identifier: value is empty`);
  }
  const isValid = /^[A-Z0-9-]+$/.test(value);
  if (!isValid) {
    throw new Error(`Invalid ${scope} identifier: ${value}`);
  }
}
