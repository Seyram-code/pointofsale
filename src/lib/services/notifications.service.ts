import "server-only";
import { prisma } from "@/lib/db/prisma";

export type NotificationInput = {
  userId?: string | null;
  storeId?: string | null;
  type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  title: string;
  body: string;
};

export async function createNotification(input: NotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId ?? null,
      storeId: input.storeId ?? null,
      type: input.type ?? "INFO",
      title: input.title,
      body: input.body,
    },
  });
}

export async function getNotificationsForUser(userId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getStoreNotifications(storeId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function markNotificationRead(id: string) {
  return prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
}
