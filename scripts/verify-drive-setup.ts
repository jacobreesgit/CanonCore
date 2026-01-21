/**
 * Verifies Google Drive setup for both seed and E2E accounts.
 *
 * Usage:
 *   npx tsx scripts/verify-drive-setup.ts
 *   npx tsx scripts/verify-drive-setup.ts --purpose=e2e
 *   npx tsx scripts/verify-drive-setup.ts --purpose=seed
 */

import dotenv from "dotenv";
import path from "path";

const ENV_FILE_PATH = path.resolve(__dirname, "../.env.local");
dotenv.config({ path: ENV_FILE_PATH });

const TIMEOUT_MS = 30000;

interface AccountConfig {
  name: string;
  tokenVar: string;
  folderVar: string;
  emailVar: string;
}

const ACCOUNTS: Record<string, AccountConfig> = {
  e2e: {
    name: "E2E Testing",
    tokenVar: "GOOGLE_E2E_REFRESH_TOKEN",
    folderVar: "GOOGLE_E2E_ROOT_FOLDER_ID",
    emailVar: "GOOGLE_E2E_EMAIL",
  },
  seed: {
    name: "Database Seeding",
    tokenVar: "GOOGLE_SEED_REFRESH_TOKEN",
    folderVar: "GOOGLE_SEED_ROOT_FOLDER_ID",
    emailVar: "GOOGLE_SEED_EMAIL",
  },
};

interface VerificationResult {
  account: string;
  tokenSet: boolean;
  tokenValid: boolean;
  folderSet: boolean;
  folderExists: boolean;
  folderTrashed: boolean;
  email: string | null;
  error: string | null;
}

/**
 * Fetch with timeout to prevent hanging.
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds
 * @returns Fetch response
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
 * Verifies a single account's Drive configuration.
 *
 * @param config - Account configuration to verify
 * @returns Verification result
 */
async function verifyAccount(
  config: AccountConfig
): Promise<VerificationResult> {
  const result: VerificationResult = {
    account: config.name,
    tokenSet: false,
    tokenValid: false,
    folderSet: false,
    folderExists: false,
    folderTrashed: false,
    email: process.env[config.emailVar] || null,
    error: null,
  };

  const refreshToken = process.env[config.tokenVar];
  const folderId = process.env[config.folderVar];
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  result.tokenSet = !!refreshToken;
  result.folderSet = !!folderId;

  if (!clientId || !clientSecret) {
    result.error = "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set";
    return result;
  }

  if (!refreshToken) {
    result.error = `${config.tokenVar} not set`;
    return result;
  }

  // Validate token
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
      result.error = "Token refresh failed - token may be revoked";
      return result;
    }

    const { access_token } = await tokenResponse.json();
    result.tokenValid = true;

    // Check folder if set
    if (folderId) {
      const folderResponse = await fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=name,trashed`,
        { headers: { Authorization: `Bearer ${access_token}` } }
      );

      if (folderResponse.ok) {
        const folderData = await folderResponse.json();
        result.folderExists = true;
        result.folderTrashed = folderData.trashed === true;
      } else if (folderResponse.status === 404) {
        result.error = `Folder not found (deleted?) - ID: ${folderId}`;
      } else {
        result.error = `Folder check failed: ${folderResponse.status} ${folderResponse.statusText}`;
      }
    } else {
      result.error = `${config.folderVar} not set`;
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      result.error = "Request timed out";
    } else {
      result.error =
        err instanceof Error ? err.message : "Unknown error occurred";
    }
  }

  return result;
}

/**
 * Prints verification result for an account.
 *
 * @param result - Verification result to print
 */
function printResult(result: VerificationResult): void {
  console.log(`\n📋 ${result.account}`);
  console.log("─".repeat(40));

  const tokenStatus = !result.tokenSet
    ? "❌ Not set"
    : result.tokenValid
      ? "✅ Valid"
      : "❌ Invalid";
  console.log(`   Token:  ${tokenStatus}`);

  const folderStatus = !result.folderSet
    ? "❌ Not set"
    : !result.folderExists
      ? "❌ Not found (deleted?)"
      : result.folderTrashed
        ? "⚠️  In trash"
        : "✅ Exists";
  console.log(`   Folder: ${folderStatus}`);

  if (result.email) {
    console.log(`   Email:  ${result.email}`);
  }

  if (result.error) {
    console.log(`   Error:  ${result.error}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const purposeArg = args.find((arg) => arg.startsWith("--purpose="));
  const purpose = purposeArg?.split("=")[1];

  console.log("\n🔍 Google Drive Setup Verification\n");
  console.log("═".repeat(50));

  // Check shared credentials first
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  console.log("\n🔐 Shared Credentials");
  console.log("─".repeat(40));
  console.log(`   GOOGLE_CLIENT_ID:     ${clientId ? "✅ Set" : "❌ Not set"}`);
  console.log(
    `   GOOGLE_CLIENT_SECRET: ${clientSecret ? "✅ Set" : "❌ Not set"}`
  );

  if (!clientId || !clientSecret) {
    console.log("\n❌ Cannot verify accounts without client credentials\n");
    process.exit(1);
  }

  // Determine which accounts to check
  const accountsToCheck =
    purpose && ACCOUNTS[purpose]
      ? [ACCOUNTS[purpose]]
      : Object.values(ACCOUNTS);

  // Verify accounts in parallel
  const results = await Promise.all(
    accountsToCheck.map((account) => verifyAccount(account))
  );

  // Print results
  results.forEach(printResult);

  console.log("\n" + "═".repeat(50));

  const allPassed = results.every(
    (r) => r.tokenValid && r.folderExists && !r.folderTrashed
  );

  if (allPassed) {
    console.log("✅ All checks passed!\n");
  } else {
    console.log("❌ Some checks failed. Run setup to fix:\n");
    console.log("   npx tsx scripts/generate-refresh-token.ts --purpose=e2e");
    console.log(
      "   npx tsx scripts/generate-refresh-token.ts --purpose=seed\n"
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
