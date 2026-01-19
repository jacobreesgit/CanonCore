/**
 * API route for checking username availability.
 * Used by the username validation hook for real-time feedback.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateUsername, RESERVED_USERNAMES } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import type { UsernameCheckResult } from "@/lib/types";

/**
 * Checks if a username is available.
 * Validates format and checks database for existing users.
 *
 * Query parameters:
 * - username: Username to check (required)
 *
 * @returns JSON with availability status and optional error
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<UsernameCheckResult>> {
  // Rate limit username checks (high limit since used for real-time validation)
  const rateLimitResult = await checkRateLimit("usernameCheck");
  if (rateLimitResult) {
    return NextResponse.json(
      { available: false, error: rateLimitResult.error },
      { status: 429 }
    );
  }

  const session = await auth();

  const searchParams = request.nextUrl.searchParams;
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json(
      { available: false, error: "Username is required" },
      { status: 400 }
    );
  }

  // Normalize to lowercase
  const normalizedUsername = username.toLowerCase().trim();

  // Validate format
  const formatResult = validateUsername(normalizedUsername);
  if (!formatResult.success) {
    return NextResponse.json({
      available: false,
      error: formatResult.error,
    });
  }

  // Check reserved list (redundant since validateUsername checks, but explicit)
  if (RESERVED_USERNAMES.has(normalizedUsername)) {
    return NextResponse.json({
      available: false,
      error: "This username is reserved",
    });
  }

  try {
    // Check if username exists (case-insensitive via database collation)
    const existingUser = await prisma.user.findFirst({
      where: {
        username: {
          equals: normalizedUsername,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    // If authenticated user owns this username, it's "available" to them
    if (existingUser && session?.user?.id === existingUser.id) {
      return NextResponse.json({ available: true });
    }

    return NextResponse.json({
      available: existingUser === null,
    });
  } catch {
    return NextResponse.json(
      { available: false, error: "Failed to check username" },
      { status: 500 }
    );
  }
}
