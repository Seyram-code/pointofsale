import type { AuthenticatedSession } from "@/lib/auth/types";

export function canAccessNotification(
  session: Pick<AuthenticatedSession, "user">,
  notification: { userId?: string | null; storeId?: string | null },
): boolean {
  const sameStore = Boolean(session.user.storeId && notification.storeId && session.user.storeId === notification.storeId);

  if (notification.userId) {
    return notification.userId === session.user.id && (!notification.storeId || sameStore);
  }

  return Boolean(notification.storeId && sameStore);
}
