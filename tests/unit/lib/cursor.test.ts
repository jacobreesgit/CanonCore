import { describe, it, expect } from "vitest";
import {
  encodeCursor,
  decodeCursor,
  encodeDescendantCursor,
  decodeDescendantCursor,
  encodeOrderCursor,
  decodeOrderCursor,
  escapeILike,
  PAGE_SIZE,
} from "@/lib/cursor";

describe("cursor utilities", () => {
  it("encodes and decodes an updatedAt|id cursor roundtrip", () => {
    const date = new Date("2026-01-15T10:30:00.000Z");
    const encoded = encodeCursor(date, "item-123");
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual({ updatedAt: date, id: "item-123" });
  });

  it("returns null for null cursor", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });

  it("returns null for malformed cursor", () => {
    expect(decodeCursor("not-valid")).toBeNull();
    expect(decodeCursor("foobar|")).toBeNull();
  });

  it("exports PAGE_SIZE as 24", () => {
    expect(PAGE_SIZE).toBe(24);
  });
});

describe("descendant cursor utilities", () => {
  it("encodes and decodes a depth|order|id cursor roundtrip", () => {
    const encoded = encodeDescendantCursor(2, 5, "child-456");
    const decoded = decodeDescendantCursor(encoded);
    expect(decoded).toEqual({ depth: 2, order: 5, id: "child-456" });
  });

  it("returns null for malformed descendant cursor", () => {
    expect(decodeDescendantCursor("garbage")).toBeNull();
    expect(decodeDescendantCursor(null)).toBeNull();
  });
});

describe("order cursor utilities", () => {
  it("encodes and decodes an order|id cursor roundtrip", () => {
    const encoded = encodeOrderCursor(3, "playlist-789");
    const decoded = decodeOrderCursor(encoded);
    expect(decoded).toEqual({ order: 3, id: "playlist-789" });
  });

  it("returns null for null or malformed cursor", () => {
    expect(decodeOrderCursor(null)).toBeNull();
    expect(decodeOrderCursor(undefined)).toBeNull();
    expect(decodeOrderCursor("garbage")).toBeNull();
  });
});

describe("escapeILike", () => {
  it("escapes % and _ characters", () => {
    expect(escapeILike("100%")).toBe("100\\%");
    expect(escapeILike("foo_bar")).toBe("foo\\_bar");
    expect(escapeILike("normal")).toBe("normal");
  });

  it("escapes backslashes", () => {
    expect(escapeILike("back\\slash")).toBe("back\\\\slash");
  });
});
