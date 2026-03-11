/**
 * Error handling utilities for server actions.
 * Provides user-friendly error messages for common database errors.
 */

import { Prisma } from "@prisma/client";

/**
 * Error message shown when user's account no longer exists.
 * This happens when a user is deleted but their session remains active.
 */
const ACCOUNT_NOT_FOUND_ERROR =
  "Your account no longer exists. Please sign out and sign in again.";

/**
 * Prisma error code for foreign key constraint violations.
 * @see https://www.prisma.io/docs/reference/api-reference/error-reference#p2003
 */
const FOREIGN_KEY_ERROR_CODE = "P2003";

/**
 * Checks if an error is a Prisma foreign key constraint violation.
 * Uses Prisma's typed error class and stable error codes for reliability.
 *
 * @param error - The error to check
 * @returns True if this is a foreign key constraint error
 */
export function isForeignKeyError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === FOREIGN_KEY_ERROR_CODE
  );
}

/**
 * Checks if an error is specifically a user foreign key violation.
 * This indicates the user's account was deleted while they were signed in.
 * Uses Prisma's error metadata to check the specific field.
 *
 * @param error - The error to check
 * @returns True if this is a user-related foreign key error
 */
export function isUserNotFoundError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code !== FOREIGN_KEY_ERROR_CODE) {
    return false;
  }
  // Check if the constraint violation is on the userId field
  const meta = error.meta as { field_name?: string } | undefined;
  return meta?.field_name?.includes("userId") ?? false;
}

/**
 * Handles Prisma errors and returns user-friendly error results.
 * Use this to wrap database operations that might fail due to constraint violations.
 *
 * @param error - The caught error
 * @returns Error object with user-friendly message, or null to re-throw
 *
 * @example
 * try {
 *   await prisma.item.create({ data: { userId: session.user.id, ... } });
 * } catch (error) {
 *   const result = handlePrismaError(error);
 *   if (result) return result;
 *   throw error;
 * }
 */
export function handlePrismaError(error: unknown): { error: string } | null {
  // User's account was deleted while signed in
  if (isForeignKeyError(error)) {
    return { error: ACCOUNT_NOT_FOUND_ERROR };
  }

  // Let other errors propagate
  return null;
}
