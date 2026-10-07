import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";

function accessCodeEncryptionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be configured to protect staff access codes");
  return createHash("sha256").update("mypos-staff-access-code:").update(secret).digest();
}

export function getStoreAccessCodePrefix(storeName: string) {
  const words = storeName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  if (words.length >= 3) return words.slice(0, 3).map((word) => word[0]).join("");
  if (words.length === 2) return `${words[0].slice(0, 2)}${words[1][0]}`.slice(0, 3).padEnd(3, "X");
  return (words[0] ?? "SHP").slice(0, 3).padEnd(3, "X");
}

export function createStaffAccessCode(storeName: string) {
  const accessCode = `${getStoreAccessCodePrefix(storeName)}${randomInt(0, 1000).toString().padStart(3, "0")}`;
  return { accessCode, hash: hashStaffAccessCode(accessCode) };
}

export function createUniqueStaffAccessCode(
  storeName: string,
  existingHashes: Iterable<string | null | undefined> = [],
) {
  const used = new Set<string>();
  for (const hash of existingHashes) {
    if (hash) used.add(hash.toLowerCase());
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = createStaffAccessCode(storeName);
    if (!used.has(candidate.hash)) return candidate;
  }

  throw new Error("Could not generate a unique staff access code. Try again.");
}

export function hashStaffAccessCode(accessCode: string) {
  return createHash("sha256").update(accessCode).digest("hex");
}

export function encryptStaffAccessCode(accessCode: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", accessCodeEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(accessCode, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptStaffAccessCode(encryptedValue: string) {
  const [ivValue, tagValue, ciphertextValue] = encryptedValue.split(".");
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error("Invalid encrypted staff access code");
  const decipher = createDecipheriv("aes-256-gcm", accessCodeEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}