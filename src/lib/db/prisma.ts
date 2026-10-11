import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const fallbackDatabaseUrl = "mysql://root@localhost:3306/mypos";
const databaseUrl = process.env.DATABASE_URL || fallbackDatabaseUrl;

if (
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.startsWith("prisma://") ||
  process.env.DATABASE_URL.startsWith("prisma+postgres://")
) {
  process.env.DATABASE_URL = databaseUrl;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
