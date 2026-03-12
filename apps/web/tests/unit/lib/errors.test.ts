/**
 * Unit tests for error handling utilities.
 * Tests Prisma error detection and user-friendly error message generation.
 */

import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  isForeignKeyError,
  isUserNotFoundError,
  handlePrismaError,
} from "@/lib/errors";

describe("errors", () => {
  describe("isForeignKeyError", () => {
    it("returns true for P2003 foreign key error", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        {
          code: "P2003",
          clientVersion: "5.0.0",
        }
      );
      expect(isForeignKeyError(error)).toBe(true);
    });

    it("returns false for other Prisma error codes", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        {
          code: "P2002",
          clientVersion: "5.0.0",
        }
      );
      expect(isForeignKeyError(error)).toBe(false);
    });

    it("returns false for P2001 (record not found)", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Record not found",
        {
          code: "P2001",
          clientVersion: "5.0.0",
        }
      );
      expect(isForeignKeyError(error)).toBe(false);
    });

    it("returns false for P2025 (dependent record not found)", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Dependent record not found",
        {
          code: "P2025",
          clientVersion: "5.0.0",
        }
      );
      expect(isForeignKeyError(error)).toBe(false);
    });

    it("returns false for non-Prisma errors", () => {
      expect(isForeignKeyError(new Error("Generic error"))).toBe(false);
      expect(isForeignKeyError(new TypeError("Type error"))).toBe(false);
    });

    it("returns false for string errors", () => {
      expect(isForeignKeyError("string error")).toBe(false);
    });

    it("returns false for null", () => {
      expect(isForeignKeyError(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isForeignKeyError(undefined)).toBe(false);
    });

    it("returns false for plain objects", () => {
      expect(isForeignKeyError({ code: "P2003" })).toBe(false);
    });

    it("returns false for numbers", () => {
      expect(isForeignKeyError(123)).toBe(false);
    });
  });

  describe("isUserNotFoundError", () => {
    it("returns true when field_name includes userId", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        {
          code: "P2003",
          clientVersion: "5.0.0",
          meta: { field_name: "Item_userId_fkey" },
        }
      );
      expect(isUserNotFoundError(error)).toBe(true);
    });

    it("returns true for GoogleDriveConnection_userId_fkey", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        {
          code: "P2003",
          clientVersion: "5.0.0",
          meta: { field_name: "GoogleDriveConnection_userId_fkey" },
        }
      );
      expect(isUserNotFoundError(error)).toBe(true);
    });

    it("returns false when field_name does not include userId", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        {
          code: "P2003",
          clientVersion: "5.0.0",
          meta: { field_name: "Item_parentId_fkey" },
        }
      );
      expect(isUserNotFoundError(error)).toBe(false);
    });

    it("returns false for ItemFile_itemId_fkey", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        {
          code: "P2003",
          clientVersion: "5.0.0",
          meta: { field_name: "ItemFile_itemId_fkey" },
        }
      );
      expect(isUserNotFoundError(error)).toBe(false);
    });

    it("returns false when meta is undefined", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        {
          code: "P2003",
          clientVersion: "5.0.0",
        }
      );
      expect(isUserNotFoundError(error)).toBe(false);
    });

    it("returns false when meta.field_name is undefined", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        {
          code: "P2003",
          clientVersion: "5.0.0",
          meta: {},
        }
      );
      expect(isUserNotFoundError(error)).toBe(false);
    });

    it("returns false for non-P2003 errors even with userId in meta", () => {
      const error = new Prisma.PrismaClientKnownRequestError("Other error", {
        code: "P2002",
        clientVersion: "5.0.0",
        meta: { field_name: "Item_userId_fkey" },
      });
      expect(isUserNotFoundError(error)).toBe(false);
    });

    it("returns false for non-Prisma errors", () => {
      expect(isUserNotFoundError(new Error("Generic error"))).toBe(false);
    });

    it("returns false for null", () => {
      expect(isUserNotFoundError(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isUserNotFoundError(undefined)).toBe(false);
    });
  });

  describe("handlePrismaError", () => {
    it("returns account not found message for foreign key errors", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        {
          code: "P2003",
          clientVersion: "5.0.0",
        }
      );
      const result = handlePrismaError(error);
      expect(result).toEqual({
        error:
          "Your account no longer exists. Please sign out and sign in again.",
      });
    });

    it("returns null for non-foreign-key Prisma errors", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        {
          code: "P2002",
          clientVersion: "5.0.0",
        }
      );
      expect(handlePrismaError(error)).toBeNull();
    });

    it("returns null for generic errors", () => {
      expect(handlePrismaError(new Error("Generic error"))).toBeNull();
    });

    it("returns null for null input", () => {
      expect(handlePrismaError(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(handlePrismaError(undefined)).toBeNull();
    });

    it("returns null for string errors", () => {
      expect(handlePrismaError("string error")).toBeNull();
    });

    it("returns null for PrismaClientInitializationError", () => {
      const error = new Prisma.PrismaClientInitializationError(
        "Connection failed",
        "5.0.0"
      );
      expect(handlePrismaError(error)).toBeNull();
    });

    it("returns null for PrismaClientValidationError", () => {
      const error = new Prisma.PrismaClientValidationError("Invalid input", {
        clientVersion: "5.0.0",
      });
      expect(handlePrismaError(error)).toBeNull();
    });
  });
});
