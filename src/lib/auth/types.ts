import type { UserRole } from "@prisma/client";

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  staffCode: string;
  role: UserRole;
  storeId: string | null;
  businessId: string | null;
  storeName: string | null;
  businessType: string | null;
  avatarUrl: string | null;
  mustChangePassword: boolean;
  permissions: string[];
}

/** Claims embedded in the signed session cookie. Kept small — it travels on every request. */
export interface SessionTokenClaims {
  sub: string; // user id
  sid: string; // Session row id
  role: UserRole;
  storeId: string | null;
  businessId: string | null;
}

export interface AuthenticatedSession {
  user: SessionUser;
  sessionId: string;
  expiresAt: Date;
}
