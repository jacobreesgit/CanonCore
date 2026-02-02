/**
 * Mock for lib/prisma.ts
 * Prevents database and env imports in Storybook's browser build.
 */

import { fn } from "storybook/test";

/**
 * Mock Prisma client with common model operations.
 */
export const prisma = {
  user: {
    findUnique: fn(async () => null),
    findFirst: fn(async () => null),
    findMany: fn(async () => []),
    create: fn(async () => ({})),
    update: fn(async () => ({})),
    delete: fn(async () => ({})),
    upsert: fn(async () => ({})),
    count: fn(async () => 0),
  },
  item: {
    findUnique: fn(async () => null),
    findFirst: fn(async () => null),
    findMany: fn(async () => []),
    create: fn(async () => ({})),
    update: fn(async () => ({})),
    updateMany: fn(async () => ({ count: 0 })),
    delete: fn(async () => ({})),
    deleteMany: fn(async () => ({ count: 0 })),
    count: fn(async () => 0),
  },
  itemFile: {
    findUnique: fn(async () => null),
    findFirst: fn(async () => null),
    findMany: fn(async () => []),
    create: fn(async () => ({})),
    update: fn(async () => ({})),
    delete: fn(async () => ({})),
    count: fn(async () => 0),
  },
  googleDriveConnection: {
    findUnique: fn(async () => null),
    findFirst: fn(async () => null),
    create: fn(async () => ({})),
    update: fn(async () => ({})),
    delete: fn(async () => ({})),
  },
  fork: {
    findUnique: fn(async () => null),
    findFirst: fn(async () => null),
    findMany: fn(async () => []),
    create: fn(async () => ({})),
    delete: fn(async () => ({})),
    count: fn(async () => 0),
  },
  syncLog: {
    findMany: fn(async () => []),
    create: fn(async () => ({})),
  },
  $transaction: fn(async (operations: unknown[]) => operations),
  $queryRaw: fn(async () => []),
  $executeRaw: fn(async () => 0),
};
