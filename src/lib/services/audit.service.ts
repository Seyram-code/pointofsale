import "server-only";
import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export interface AuditEntry {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  summary: string;
  userId?: string | null;
  storeId?: string | null;
  changes?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Audit writes must never break the operation they describe, so failures are swallowed and logged. */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        summary: entry.summary,
        userId: entry.userId ?? null,
        storeId: entry.storeId ?? null,
        changes: entry.changes,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record entry", entry.action, entry.entity, error);
  }
}

/** Produces a `{ field: { from, to } }` diff limited to the fields that actually changed. */
export function diffChanges<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  ignore: string[] = ["updatedAt", "createdAt"],
): Prisma.InputJsonValue {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, next] of Object.entries(after)) {
    if (ignore.includes(key)) continue;
    const prev = before[key];
    if (String(prev) !== String(next)) {
      changes[key] = { from: prev ?? null, to: next ?? null };
    }
  }
  return changes as Prisma.InputJsonValue;
}

export function requestContext(request: Request) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null,
    userAgent: request.headers.get("user-agent"),
  };
}
