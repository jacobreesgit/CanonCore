/**
 * Server actions for item CRUD operations.
 * Handles folder hierarchy with ownership verification.
 */

"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { itemNameSchema } from "@/lib/validations";
import type { Item, ItemResult, BreadcrumbItem } from "@/lib/types";

const MAX_DEPTH = 10;

/**
 * Fetches items for a given parent.
 * Returns root items if parentId is null.
 *
 * @param parentId - Parent item ID or null for root
 * @returns Items array or error
 */
export async function getItems(
  parentId: string | null
): Promise<ItemResult<Item[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const items = await prisma.item.findMany({
    where: {
      userId: session.user.id,
      parentId: parentId,
    },
    orderBy: { order: "asc" },
  });

  return { success: true, data: items as Item[] };
}

/**
 * Fetches a single item with its ancestors for breadcrumbs.
 *
 * @param id - Item ID
 * @returns Item with ancestors or error
 */
export async function getItem(
  id: string
): Promise<ItemResult<{ item: Item; ancestors: BreadcrumbItem[] }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const item = await prisma.item.findUnique({
    where: { id },
  });

  if (!item) {
    return { error: "Item not found" };
  }

  if (item.userId !== session.user.id) {
    return { error: "Unauthorized" };
  }

  // Build ancestors chain using recursive CTE (single query instead of N+1)
  const ancestors = item.parentId
    ? await prisma.$queryRaw<BreadcrumbItem[]>`
        WITH RECURSIVE ancestors AS (
          -- Base case: start with the direct parent
          SELECT id, name, "parentId", 1 as depth
          FROM "Item"
          WHERE id = ${item.parentId}

          UNION ALL

          -- Recursive case: get each parent's parent
          SELECT i.id, i.name, i."parentId", a.depth + 1
          FROM "Item" i
          INNER JOIN ancestors a ON i.id = a."parentId"
        )
        SELECT id, name FROM ancestors
        ORDER BY depth DESC
      `
    : [];

  return { success: true, data: { item: item as Item, ancestors } };
}

/**
 * Creates a new item.
 * Enforces max depth of 10 levels.
 *
 * @param parentId - Parent item ID or null for root
 * @param name - Item name
 * @returns Created item or error
 */
export async function createItem(
  parentId: string | null,
  name: string
): Promise<ItemResult<Item>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  // Validate name
  const validation = itemNameSchema.safeParse(name);
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  let depth = 0;

  // Check parent exists and user owns it
  if (parentId) {
    const parent = await prisma.item.findUnique({
      where: { id: parentId },
      select: { depth: true, userId: true },
    });

    if (!parent || parent.userId !== session.user.id) {
      return { error: "Parent not found" };
    }

    if (parent.depth >= MAX_DEPTH - 1) {
      return { error: "Maximum nesting depth reached" };
    }

    depth = parent.depth + 1;
  }

  // Get max order for siblings
  const maxOrderResult = await prisma.item.aggregate({
    where: {
      userId: session.user.id,
      parentId: parentId,
    },
    _max: { order: true },
  });

  const order = (maxOrderResult._max.order ?? -1) + 1;

  const item = await prisma.item.create({
    data: {
      name: validation.data,
      parentId,
      order,
      depth,
      userId: session.user.id,
    },
  });

  return { success: true, data: item as Item };
}

/**
 * Updates an item's properties.
 * Verifies ownership before update.
 *
 * @param id - Item ID
 * @param data - Partial item data to update
 * @returns Success or error
 */
export async function updateItem(
  id: string,
  data: { name?: string }
): Promise<ItemResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const item = await prisma.item.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!item) {
    return { error: "Item not found" };
  }

  if (item.userId !== session.user.id) {
    return { error: "Unauthorized" };
  }

  // Validate name if provided
  const updateData: { name?: string } = {};
  if (data.name !== undefined) {
    const validation = itemNameSchema.safeParse(data.name);
    if (!validation.success) {
      return { error: validation.error.issues[0].message };
    }
    updateData.name = validation.data;
  }

  await prisma.item.update({
    where: { id },
    data: updateData,
  });

  return { success: true };
}

/**
 * Deletes an item and all descendants.
 * Verifies ownership before delete.
 *
 * @param id - Item ID
 * @returns Success or error
 */
export async function deleteItem(id: string): Promise<ItemResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const item = await prisma.item.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!item) {
    return { error: "Item not found" };
  }

  if (item.userId !== session.user.id) {
    return { error: "Unauthorized" };
  }

  // Cascade delete handled by Prisma relation
  await prisma.item.delete({
    where: { id },
  });

  return { success: true };
}

/**
 * Batch reorders items. Used after drag operations.
 * Verifies ownership of ALL items before update.
 *
 * @param updates - Array of item updates with new order/parentId
 * @returns Success or error
 */
export async function reorderItems(
  updates: {
    id: string;
    order: number;
    parentId?: string | null;
    depth?: number;
  }[]
): Promise<ItemResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  if (updates.length === 0) {
    return { success: true };
  }

  // Verify ownership of ALL items in batch
  const itemIds = updates.map((u) => u.id);
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, userId: true, depth: true },
  });

  // Check all items exist
  if (items.length !== itemIds.length) {
    return { error: "Some items not found" };
  }

  // Check all items belong to user
  const userId = session.user.id;
  const unauthorized = items.some((item) => item.userId !== userId);
  if (unauthorized) {
    return { error: "Unauthorized" };
  }

  // Check depth constraints for any parentId changes
  for (const update of updates) {
    if (update.depth !== undefined && update.depth >= MAX_DEPTH) {
      return { error: "Maximum nesting depth reached" };
    }
  }

  // Perform batch update in transaction
  await prisma.$transaction(
    updates.map((update) =>
      prisma.item.update({
        where: { id: update.id },
        data: {
          order: update.order,
          ...(update.parentId !== undefined && { parentId: update.parentId }),
          ...(update.depth !== undefined && { depth: update.depth }),
        },
      })
    )
  );

  return { success: true };
}
