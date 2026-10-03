import type { UserRole } from "@prisma/client";

export interface SessionUser {
  id: string;
  fullName: string;
  email: string | null;
  staffCode: string;
  role: UserRole;
  isEmployee: boolean;
  storeId: string | null;
  businessId: string | null;
  storeName: string | null;
  businessType: string | null;
  avatarUrl: string | null;
  mustChangePassword: boolean;
  permissions: string[];
  /** Effective subscription package key, e.g. "STARTER". Drives plan gating in the UI. */
  plan: string;
  /** Whether the active store plan is currently valid and the shop can access protected areas. */
  subscriptionActive: boolean;
  /** Whether camera/hardware scanning may be used on the sales (POS) page. */
  scannerOnPos: boolean;
  /** Whether camera scanning may be used outside the sales page (product forms). */
  scannerOutsidePos: boolean;
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
