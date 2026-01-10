/**
 * OAuth callback handler for Google Drive authorization.
 * Validates CSRF state, exchanges code for tokens, and creates connection.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptCredential } from "@/lib/crypto";
import {
  exchangeCodeForTokens,
  getUserEmail,
  createRootFolder,
  verifyOAuthState,
} from "@/lib/google-drive-client";
import { google } from "googleapis";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL("/sign-in?error=unauthorized", request.url)
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    logger.error({ error }, "[GoogleDrive] OAuth error from provider");
    return NextResponse.redirect(
      new URL(`/my-items?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  // Validate required parameters
  if (!code) {
    return NextResponse.redirect(
      new URL("/my-items?error=no_code", request.url)
    );
  }

  if (!state) {
    return NextResponse.redirect(
      new URL("/my-items?error=no_state", request.url)
    );
  }

  // Verify CSRF state
  const stateData = verifyOAuthState(state);
  if (!stateData) {
    logger.warn("[GoogleDrive] Invalid or expired OAuth state");
    return NextResponse.redirect(
      new URL("/my-items?error=invalid_state", request.url)
    );
  }

  // Verify state matches current user
  if (stateData.userId !== session.user.id) {
    logger.warn(
      { stateUserId: stateData.userId, sessionUserId: session.user.id },
      "[GoogleDrive] OAuth state userId mismatch"
    );
    return NextResponse.redirect(
      new URL("/my-items?error=state_mismatch", request.url)
    );
  }

  try {
    // Exchange code for tokens
    const { accessToken, refreshToken, expiresIn } =
      await exchangeCodeForTokens(code);

    // Get user's Google email
    const email = await getUserEmail(accessToken);

    // Create Drive client and root folder
    const tempAuth = new google.auth.OAuth2();
    tempAuth.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: "v3", auth: tempAuth });

    const rootFolder = await createRootFolder(drive);

    // Upsert connection (single per user)
    await prisma.googleDriveConnection.upsert({
      where: {
        userId: session.user.id,
      },
      create: {
        userId: session.user.id,
        name: "Google Drive",
        email,
        encryptedRefreshToken: encryptCredential(refreshToken),
        encryptedAccessToken: encryptCredential(accessToken),
        accessTokenExpiry: new Date(Date.now() + expiresIn * 1000),
        rootFolderId: rootFolder.id,
        isActive: true,
        needsReauth: false,
      },
      update: {
        email,
        encryptedRefreshToken: encryptCredential(refreshToken),
        encryptedAccessToken: encryptCredential(accessToken),
        accessTokenExpiry: new Date(Date.now() + expiresIn * 1000),
        rootFolderId: rootFolder.id,
        needsReauth: false,
        lastError: null,
      },
    });

    // Redirect with existing flag so client can auto-sync existing content
    const redirectUrl = new URL("/my-items", request.url);
    redirectUrl.searchParams.set("drive", "connected");
    if (rootFolder.wasExisting) {
      redirectUrl.searchParams.set("existing", "true");
    }

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "[GoogleDrive] OAuth callback error");

    return NextResponse.redirect(
      new URL(`/my-items?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
