import { mockPrisma } from "./mock-db";

// Decide which backend to use.
// If DATABASE_URL is missing/empty/placeholder, use file-based mock (zero-config demo).
// Otherwise use real PrismaClient (Neon/Postgres). Falls back to mock if Prisma fails to init.

const useMock =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.trim() === "" ||
  process.env.DATABASE_URL.includes("placeholder") ||
  process.env.DATABASE_URL.includes("YOUR_");

// We expose a `prisma` object with same shape as PrismaClient for app code.
// Using `any` keeps both backends compatible without heavy conditional types.
type PrismaLike = typeof mockPrisma;

let prismaImpl: PrismaLike;

if (useMock) {
  console.log("[db] Using mock JSON store (no DATABASE_URL) — data in data/mock-db.json");
  prismaImpl = mockPrisma as unknown as PrismaLike;
} else {
  try {
    // Lazy require so we don't crash when @prisma/client not installed yet (e.g. before npm install)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
    const globalForPrisma = globalThis as unknown as { prisma?: InstanceType<typeof PrismaClient> };
    const client =
      globalForPrisma.prisma ??
      new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      });
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
    prismaImpl = client as unknown as PrismaLike;
    console.log("[db] Using real PrismaClient (DATABASE_URL present)");
  } catch (e) {
    console.warn("[db] Prisma init failed, falling back to mock", e);
    prismaImpl = mockPrisma as unknown as PrismaLike;
  }
}

export const prisma = prismaImpl as unknown as import("@prisma/client").PrismaClient & {
  _store?: any;
  _save?: () => void;
  _reload?: () => void;
};
