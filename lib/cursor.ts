export const PAGE_SIZE = 24;

/**
 * Encode a compound cursor from updatedAt + id.
 * Used for lists sorted by updatedAt DESC, id DESC.
 */
export function encodeCursor(updatedAt: Date, id: string): string {
  return Buffer.from(`${updatedAt.toISOString()}|${id}`).toString("base64url");
}

/**
 * Decode an updatedAt|id cursor string.
 * Returns null if cursor is missing or malformed.
 */
export function decodeCursor(
  cursor: string | null | undefined
): { updatedAt: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const separatorIndex = decoded.lastIndexOf("|");
    if (separatorIndex === -1) return null;
    const dateStr = decoded.slice(0, separatorIndex);
    const id = decoded.slice(separatorIndex + 1);
    if (!id) return null;
    const updatedAt = new Date(dateStr);
    if (isNaN(updatedAt.getTime())) return null;
    return { updatedAt, id };
  } catch {
    return null;
  }
}

/**
 * Encode a cursor for descendant lists sorted by depth ASC, order ASC.
 */
export function encodeDescendantCursor(
  depth: number,
  order: number,
  id: string
): string {
  return Buffer.from(`${depth}|${order}|${id}`).toString("base64url");
}

/**
 * Decode a depth|order|id cursor string.
 */
export function decodeDescendantCursor(
  cursor: string | null | undefined
): { depth: number; order: number; id: string } | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const parts = decoded.split("|");
    if (parts.length !== 3) return null;
    const depth = parseInt(parts[0], 10);
    const order = parseInt(parts[1], 10);
    const id = parts[2];
    if (isNaN(depth) || isNaN(order) || !id) return null;
    return { depth, order, id };
  } catch {
    return null;
  }
}

/**
 * Encode a cursor for lists sorted by order ASC, id ASC.
 */
export function encodeOrderCursor(order: number, id: string): string {
  return Buffer.from(`${order}|${id}`).toString("base64url");
}

/**
 * Decode an order|id cursor string.
 * Returns null if cursor is missing or malformed.
 */
export function decodeOrderCursor(
  cursor: string | null | undefined
): { order: number; id: string } | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const separatorIndex = decoded.indexOf("|");
    if (separatorIndex === -1) return null;
    const order = parseInt(decoded.slice(0, separatorIndex), 10);
    const id = decoded.slice(separatorIndex + 1);
    if (isNaN(order) || !id) return null;
    return { order, id };
  } catch {
    return null;
  }
}

/**
 * Escape special ILIKE characters (%, _, \) in search terms.
 */
export function escapeILike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
