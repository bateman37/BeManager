import { PrismaClient } from "@prisma/client";

/**
 * Singleton de PrismaClient. En desarrollo, Next.js recarga módulos en
 * caliente y crearía una nueva conexión en cada recarga si no se reutiliza
 * la instancia a través de `globalThis`.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
