/**
 * AsyncLocalStorage context for audit logging.
 * Allows server actions to pass userId and source through the call stack
 * without explicit parameter threading.
 */

import { AsyncLocalStorage } from "async_hooks";

/**
 * Context data passed through the async call stack for audit logging.
 */
export interface AuditContext {
  /** User ID from session, if authenticated */
  userId?: string;
  /** Source identifier: "api", "seed", "e2e-test", "sync" */
  source?: string;
  /** Request ID for correlation with request logs (x-request-id header) */
  requestId?: string;
}

/** AsyncLocalStorage instance for audit context */
export const auditStorage = new AsyncLocalStorage<AuditContext>();

/**
 * Wraps an async operation with audit context.
 * The context will be available to all Prisma operations within the callback.
 *
 * @param context - The audit context (userId, source)
 * @param fn - The async function to execute with context
 * @returns The result of the wrapped function
 *
 * @example
 * await withAuditContext({ userId: session.user.id, source: "api" }, async () => {
 *   await prisma.item.delete({ where: { id } });
 * });
 */
export function withAuditContext<T>(
  context: AuditContext,
  fn: () => Promise<T>
): Promise<T> {
  return auditStorage.run(context, fn);
}

/**
 * Gets the current audit context from AsyncLocalStorage.
 * Returns undefined if called outside of withAuditContext.
 *
 * @returns The current audit context, or undefined if not in a context
 */
export function getAuditContext(): AuditContext | undefined {
  return auditStorage.getStore();
}
