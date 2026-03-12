/**
 * Shared Drive verification utilities for E2E tests and seeding.
 * Validates that required Google Drive credentials are configured and valid.
 *
 * Drive is REQUIRED for both E2E tests and seeding - this module provides
 * consistent validation and clear error messages across both contexts.
 */

const TIMEOUT_MS = 30000;

/** Drive purpose determines which environment variables to check. */
export type DrivePurpose = "e2e" | "seed";

/** Configuration for each Drive account type. */
interface DriveAccountConfig {
  name: string;
  tokenVar: string;
  folderVar: string;
  emailVar: string;
  setupCommand: string;
}

const DRIVE_CONFIGS: Record<DrivePurpose, DriveAccountConfig> = {
  e2e: {
    name: "E2E Testing",
    tokenVar: "GOOGLE_E2E_REFRESH_TOKEN",
    folderVar: "GOOGLE_E2E_ROOT_FOLDER_ID",
    emailVar: "GOOGLE_E2E_EMAIL",
    setupCommand: "pnpm run setup:e2e",
  },
  seed: {
    name: "Database Seeding",
    tokenVar: "GOOGLE_SEED_REFRESH_TOKEN",
    folderVar: "GOOGLE_SEED_ROOT_FOLDER_ID",
    emailVar: "GOOGLE_SEED_EMAIL",
    setupCommand: "pnpm run setup:seed",
  },
};

/** Result of Drive verification. */
export interface DriveVerificationResult {
  valid: boolean;
  tokenValid: boolean;
  folderExists: boolean;
  folderTrashed: boolean;
  email: string | null;
  errors: string[];
}

/**
 * Fetch with timeout to prevent hanging on network issues.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Verifies that Drive is properly configured for the given purpose.
 * Returns detailed verification result with any errors.
 *
 * @param purpose - "e2e" or "seed" to determine which env vars to check
 * @returns Verification result with validity status and any errors
 */
export async function verifyDriveSetup(
  purpose: DrivePurpose
): Promise<DriveVerificationResult> {
  const config = DRIVE_CONFIGS[purpose];
  const result: DriveVerificationResult = {
    valid: false,
    tokenValid: false,
    folderExists: false,
    folderTrashed: false,
    email: process.env[config.emailVar] || null,
    errors: [],
  };

  const refreshToken = process.env[config.tokenVar];
  const folderId = process.env[config.folderVar];
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  // Check shared credentials
  if (!clientId) {
    result.errors.push("GOOGLE_CLIENT_ID not set");
  }
  if (!clientSecret) {
    result.errors.push("GOOGLE_CLIENT_SECRET not set");
  }

  // Check purpose-specific credentials
  if (!refreshToken) {
    result.errors.push(`${config.tokenVar} not set`);
  }
  if (!folderId) {
    result.errors.push(`${config.folderVar} not set`);
  }

  // Cannot proceed without all credentials
  if (!clientId || !clientSecret || !refreshToken || !folderId) {
    return result;
  }

  // Validate token by refreshing it
  try {
    const tokenResponse = await fetchWithTimeout(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      result.errors.push(
        `Token refresh failed (${tokenResponse.status}): ${errorText.slice(0, 100)}`
      );
      return result;
    }

    const { access_token } = await tokenResponse.json();
    result.tokenValid = true;

    // Check folder exists and is not trashed
    const folderResponse = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=name,trashed`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    if (folderResponse.ok) {
      const folderData = await folderResponse.json();
      result.folderExists = true;
      result.folderTrashed = folderData.trashed === true;

      if (result.folderTrashed) {
        result.errors.push(
          `Root folder is in trash. Restore it or run: ${config.setupCommand}`
        );
      }
    } else if (folderResponse.status === 404) {
      result.errors.push(`Root folder not found. Run: ${config.setupCommand}`);
    } else {
      result.errors.push(
        `Folder check failed: ${folderResponse.status} ${folderResponse.statusText}`
      );
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      result.errors.push("Request timed out - check network connection");
    } else {
      result.errors.push(
        err instanceof Error ? err.message : "Unknown error occurred"
      );
    }
  }

  // Valid only if everything checks out
  result.valid =
    result.tokenValid && result.folderExists && !result.folderTrashed;

  return result;
}

/**
 * Asserts that Drive is properly configured, throwing an error if not.
 * Use this as a pre-flight check before running E2E tests or seeding.
 *
 * @param purpose - "e2e" or "seed" to determine which env vars to check
 * @throws Error with clear instructions if Drive is not configured
 */
export async function assertDriveConfigured(
  purpose: DrivePurpose
): Promise<void> {
  const config = DRIVE_CONFIGS[purpose];
  const result = await verifyDriveSetup(purpose);

  if (!result.valid) {
    const errorLines = [
      ``,
      `${"═".repeat(60)}`,
      `❌ Google Drive not configured for ${config.name}`,
      `${"═".repeat(60)}`,
      ``,
      `Drive is REQUIRED. Please run the setup script:`,
      ``,
      `  ${config.setupCommand}`,
      ``,
    ];

    if (result.errors.length > 0) {
      errorLines.push(`Issues found:`);
      result.errors.forEach((err) => {
        errorLines.push(`  • ${err}`);
      });
      errorLines.push(``);
    }

    errorLines.push(`${"═".repeat(60)}`);
    errorLines.push(``);

    throw new Error(errorLines.join("\n"));
  }
}

/**
 * Gets the Drive configuration for a specific purpose.
 * Useful for getting setup commands and variable names.
 */
export function getDriveConfig(purpose: DrivePurpose): DriveAccountConfig {
  return DRIVE_CONFIGS[purpose];
}
