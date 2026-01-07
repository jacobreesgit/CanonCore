/**
 * Prisma client singleton for database access.
 * Uses PostgreSQL adapter with connection pooling via Neon.
 *
 * Neon pooling configuration:
 * - Use the "-pooler" hostname variant for production
 *   (e.g., ep-xxx-pooler.region.aws.neon.tech)
 * - Or add ?pgbouncer=true to the connection string
 * - Connection pooling is handled by Neon's built-in PgBouncer
 * - No additional Prisma client configuration needed
 *
 * @see https://neon.tech/docs/guides/prisma#connect-pooling
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env";

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton Prisma client instance.
 * Reuses existing client in development to prevent connection exhaustion.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
