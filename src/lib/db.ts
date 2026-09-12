import { PrismaClient } from "@prisma/client";

declare global {
  var moonPrisma: PrismaClient | undefined;
}

export const db = globalThis.moonPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.moonPrisma = db;
}
