/**
 * Prisma client singleton for database access.
 * Uses PostgreSQL adapter with connection pooling via Neon.
 * Includes audit logging extension for tracking all mutations.
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
import { createAuditExtension } from "@/lib/audit-logger";

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

/**
 * Base Prisma client without extensions.
 * Used internally for audit log writes to avoid recursion.
 */
const basePrisma = new PrismaClient({
  adapter,
});

/**
 * Extended Prisma client with audit logging.
 * All mutations are automatically logged to the AuditLog table.
 */
const extendedPrisma = basePrisma.$extends(createAuditExtension(basePrisma));

/** Type for the extended Prisma client */
export type ExtendedPrismaClient = typeof extendedPrisma;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

/**
 * Singleton Prisma client instance with audit logging.
 * Reuses existing client in development to prevent connection exhaustion.
 */
export const prisma = globalForPrisma.prisma ?? extendedPrisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
