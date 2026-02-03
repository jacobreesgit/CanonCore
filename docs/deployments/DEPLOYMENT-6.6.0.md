# Deployment 6.6.0

**Date**: 2026-02-03
**Type**: Minor (Infrastructure)
**Migration Required**: Yes (new AuditLog table)

## Overview

Introduces comprehensive database audit logging to track all mutations across the application. Every create, update, and delete operation is automatically logged with context about who triggered it, what changed, and when. This provides visibility into data changes for debugging issues like unexpected deletions.

## Motivation

Seeded account items were being deleted unexpectedly with no visibility into the cause. This audit system captures all mutations with their source context, enabling investigation of:

- What deleted the items (seed script, API, sync, E2E tests)
- Who triggered the operation (userId, source identifier)
- When it happened (timestamp, duration)
- What was affected (model, recordId, operation arguments)

## Changes

### Audit Context System

AsyncLocalStorage-based context for threading audit information through the call stack.

**`lib/audit-context.ts`**

```typescript
export interface AuditContext {
  userId?: string;    // User ID from session
  source?: string;    // "api", "seed", "e2e-test", "sync"
  requestId?: string; // Correlation with request logs
}

// Wrap operations with audit context
export function withAuditContext<T>(
  context: AuditContext,
  fn: () => Promise<T>
): Promise<T>;

// Get current context (within withAuditContext scope)
export function getAuditContext(): AuditContext | undefined;
```

**Usage:**

```typescript
await withAuditContext({ userId: session.user.id, source: "api" }, async () => {
  await prisma.item.delete({ where: { id } });
});
```

### Audit Logger Extension

Prisma Client Extension that automatically logs all mutation operations.

**`lib/audit-logger.ts`**

**Features:**

- Automatic logging of all mutations (create, update, delete, upsert, and bulk variants)
- Skips read operations and AuditLog itself (prevents recursion)
- Sensitive field redaction (password, token, secret, apiKey, etc.)
- JSON truncation for payloads exceeding 10KB
- Fire-and-forget logging (non-blocking, errors logged but don't fail the operation)
- Duration tracking in milliseconds

**Audited Operations:**

| Operation | Logged | Record ID Source |
|-----------|--------|------------------|
| `create` | Yes | From result |
| `createMany` | Yes | null (bulk) |
| `update` | Yes | From where clause |
| `updateMany` | Yes | null (bulk) |
| `delete` | Yes | From where clause |
| `deleteMany` | Yes | null (bulk) |
| `upsert` | Yes | From where clause |
| `findMany`, `findUnique`, etc. | No | - |

**Redacted Fields:**

```typescript
const REDACT_FIELDS = new Set([
  "password", "hashedpassword", "passwordhash",
  "token", "accesstoken", "refreshtoken",
  "secret", "apikey", "encryptedtoken",
  "credentials", "authorization", "cookie",
  "session", "bearer", "privatekey", "secretkey",
]);
```

**Query Helper:**

```typescript
export async function getRecentAuditLogs(
  prisma: PrismaClient,
  options?: {
    model?: string;      // Filter by model name
    action?: string;     // Filter by action (contains match)
    userId?: string;     // Filter by user ID
    source?: string;     // Filter by source
    limit?: number;      // Max results (default 50)
  }
);

// Example: Get last 50 delete operations
const logs = await getRecentAuditLogs(prisma, { action: "delete", limit: 50 });
```

### AuditLog Model

New Prisma model for storing audit records.

**`prisma/schema.prisma`**

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  timestamp   DateTime @default(now())

  // Environment identification
  environment String   // "development" | "production" | "test"
  database    String   // Hashed database host identifier

  // What changed
  model       String   // "Item", "User", "ItemFile", etc.
  action      String   // "create", "update", "delete", "deleteMany", etc.
  recordId    String?  // ID of affected record (null for bulk operations)

  // Who triggered it
  userId      String?  // If known (from session context)
  source      String?  // "seed", "e2e-test", "api", "sync", etc.
  requestId   String?  // Request ID for correlation (x-request-id header)

  // Details (sensitive fields redacted, large payloads truncated)
  args        Json?    // Query arguments (sanitized, max 10KB)
  result      Json?    // Result summary (count for bulk, id for single, error if failed)

  // Performance
  durationMs  Int?     // Query duration in milliseconds

  // Indexes for common query patterns
  @@index([timestamp])
  @@index([environment, timestamp])
  @@index([model, action])
  @@index([recordId])
  @@index([userId])
  @@index([source])
  @@index([requestId])
}
```

**Index Strategy:**

- `[timestamp]` - Recent logs queries
- `[environment, timestamp]` - Environment-specific queries
- `[model, action]` - "Show all Item deletes" queries
- `[recordId]` - "What happened to this record" queries
- `[userId]` - "What did this user do" queries
- `[source]` - "What did the seed script do" queries
- `[requestId]` - Request correlation

### Prisma Client Integration

Extended Prisma client with automatic audit logging.

**`lib/prisma.ts`**

```typescript
import { createAuditExtension } from "@/lib/audit-logger";

// Base client for audit log writes (avoids recursion)
const basePrisma = new PrismaClient({ adapter });

// Extended client with audit logging
const extendedPrisma = basePrisma.$extends(createAuditExtension(basePrisma));

export type ExtendedPrismaClient = typeof extendedPrisma;
export const prisma = globalForPrisma.prisma ?? extendedPrisma;
```

The base client is passed to the extension to write audit logs without triggering additional audit log entries.

### Test Coverage

**Unit Tests (`tests/unit/lib/audit-logger.test.ts`):**

- `sanitizeArgs()` - Redacts sensitive fields, handles nested objects/arrays
- `truncateJson()` - Truncates large payloads, provides preview
- `extractRecordId()` - Extracts IDs from different operation types
- `summarizeResult()` - Summarizes results for logging

**Unit Tests (`tests/unit/lib/audit-context.test.ts`):**

- `withAuditContext()` - Context available during execution
- `getAuditContext()` - Returns undefined outside context
- Nested contexts, error propagation

**Integration Tests (`tests/integration/audit/audit-logger.test.ts`):**

- Full audit log creation for create/update/delete operations
- Context propagation through withAuditContext
- Sensitive data redaction in real database
- Query helper filtering

## Retention Strategy

The AuditLog table grows with every mutation. Implement periodic cleanup:

**Production (90 days):**

```sql
DELETE FROM "AuditLog" WHERE timestamp < NOW() - INTERVAL '90 days';
```

**Development (7 days):**

```sql
DELETE FROM "AuditLog" WHERE timestamp < NOW() - INTERVAL '7 days';
```

Consider:

- Running cleanup as a scheduled job (Vercel Cron, pg_cron, external scheduler)
- Archiving to cold storage before deletion for compliance
- Monitoring table size: `SELECT pg_size_pretty(pg_total_relation_size('AuditLog'));`

## Impact

### Debugging Capabilities

- **Deletion Tracking**: See exactly what deleted records, when, and by whom
- **Source Attribution**: Distinguish between API, seed, sync, and test operations
- **Request Correlation**: Link audit entries to specific HTTP requests via requestId
- **Performance Visibility**: Duration tracking identifies slow operations

### Performance

- **Non-blocking**: Fire-and-forget logging doesn't slow down operations
- **Minimal Overhead**: Logging happens after the operation completes
- **Error Isolation**: Audit log failures don't fail the main operation

### Security

- **Sensitive Data Protected**: Passwords, tokens, and secrets are redacted
- **Database Privacy**: Database host is hashed, not stored in plaintext
- **Payload Limits**: Large arguments are truncated to prevent storage abuse

## Deployment Notes

### Prerequisites

- No new environment variables required
- Migration creates AuditLog table with indexes

### Migration

```bash
npx prisma migrate dev --name add_audit_log
```

Or in production:

```bash
npx prisma migrate deploy
```

### Rollback

To rollback:

1. Revert code changes
2. Drop the AuditLog table:

```sql
DROP TABLE IF EXISTS "AuditLog";
```

3. Remove migration from _prisma_migrations table

## Verification

After deployment:

1. **Migration applied**: `npx prisma migrate status`
2. **Unit tests pass**: `pnpm run test`
3. **Integration tests pass**: `pnpm run test:integration`
4. **All checks pass**: `pnpm run check`

**Manual verification:**

```bash
# Create an item via the app
# Check audit log was created
psql $DATABASE_URL -c "SELECT * FROM \"AuditLog\" ORDER BY timestamp DESC LIMIT 5;"
```

Expected output shows model="Item", action="create", with sanitized args and result.

## Conclusion

This release adds comprehensive audit logging infrastructure for tracking all database mutations. The system is designed for debugging and compliance, with automatic sensitive data redaction and non-blocking operation. Future work may include:

- Admin UI for browsing audit logs
- Automated cleanup job
- Alerting on suspicious patterns (bulk deletes, etc.)
- Export to external logging service (Datadog, Splunk)
