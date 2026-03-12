import type { PrismaClient } from "@prisma/client";

/**
 * Checks if an item is fully public by walking up the inheritance chain.
 * Uses a recursive CTE to resolve effective visibility through all ancestors.
 *
 * An item is "fully public" when:
 * 1. It has isPublic=true and inheritVisibility=false, OR
 * 2. It inherits from a parent that is fully public (recursive)
 *
 * @param prisma - Prisma client instance
 * @param itemId - Item ID to check
 * @returns True if item is fully public
 */
export async function isItemFullyPublic(
  prisma: PrismaClient,
  itemId: string
): Promise<boolean> {
  const result = await prisma.$queryRaw<Array<{ is_fully_public: boolean }>>`
    WITH RECURSIVE visibility_chain AS (
      SELECT
        id,
        "parentId",
        "isPublic",
        "inheritVisibility",
        CASE
          WHEN "inheritVisibility" = false THEN "isPublic"
          ELSE NULL
        END as resolved_visibility
      FROM "Item"
      WHERE id = ${itemId}

      UNION ALL

      SELECT
        i.id,
        i."parentId",
        i."isPublic",
        i."inheritVisibility",
        CASE
          WHEN i."inheritVisibility" = false THEN i."isPublic"
          ELSE NULL
        END as resolved_visibility
      FROM "Item" i
      INNER JOIN visibility_chain vc ON i.id = vc."parentId"
      WHERE vc.resolved_visibility IS NULL
    )
    SELECT COALESCE(
      (SELECT resolved_visibility FROM visibility_chain WHERE resolved_visibility IS NOT NULL LIMIT 1),
      false
    ) as is_fully_public
  `;

  return result[0]?.is_fully_public ?? false;
}
