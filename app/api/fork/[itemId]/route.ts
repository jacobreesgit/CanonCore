/**
 * API route for forking public items.
 * Provides REST endpoint for fork operations.
 */

import { NextRequest, NextResponse } from "next/server";
import { forkItem, getForkStatus, getForkInfo } from "@/lib/fork-actions";

interface RouteContext {
  params: Promise<{ itemId: string }>;
}

/**
 * Gets fork status and info for an item.
 *
 * @returns Fork status (hasForked, forkedItemId) and fork info (source, forkCount)
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { itemId } = await context.params;

  if (!itemId) {
    return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
  }

  // Get both status and info in parallel
  const [statusResult, infoResult] = await Promise.all([
    getForkStatus(itemId),
    getForkInfo(itemId),
  ]);

  if ("error" in statusResult) {
    return NextResponse.json({ error: statusResult.error }, { status: 400 });
  }

  if ("error" in infoResult) {
    return NextResponse.json({ error: infoResult.error }, { status: 400 });
  }

  return NextResponse.json({
    status: statusResult.data,
    info: infoResult.data,
  });
}

/**
 * Forks a public item into the authenticated user's library.
 *
 * Request body:
 * - parentId (optional): Parent item ID for placement in user's library
 *
 * @returns Fork result with new item ID or error
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { itemId } = await context.params;

  if (!itemId) {
    return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
  }

  // Parse optional parentId from body
  let parentId: string | null = null;
  try {
    const body = await request.json();
    parentId = body.parentId ?? null;
  } catch {
    // No body or invalid JSON - use root level
  }

  const result = await forkItem(itemId, parentId);

  if ("error" in result) {
    // Determine appropriate status code
    const status =
      result.error === "Not authenticated"
        ? 401
        : result.error === "Item not found"
          ? 404
          : 400;

    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result.data, { status: 201 });
}
