import { SignJWT, jwtVerify } from "jose";
import type { SessionTokenClaims } from "@/lib/auth/types";

const ISSUER = "mypos";
const AUDIENCE = "mypos-app";

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is missing or too short (min 32 chars)");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(claims: SessionTokenClaims, expiresAt: Date): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
    return {
      sub: payload.sub,
      sid: payload.sid,
      role: payload.role as SessionTokenClaims["role"],
      storeId: (payload.storeId as string | null) ?? null,
      businessId: (payload.businessId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** Edge- and Node-compatible SHA-256; only the digest of a session token is persisted. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
