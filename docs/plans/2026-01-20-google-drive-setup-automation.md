# Google Drive Setup Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automate Google Drive setup for both seed and E2E accounts, including automatic folder creation, validation, and cleanup.

**Architecture:** Enhance the existing `generate-refresh-token.ts` to auto-create root folders and save folder IDs. Add a new `verify-drive-setup.ts` script for validation. Update E2E global setup to wipe/clean Drive before tests using the existing `batchDelete` utility (like seed does). All changes maintain backward compatibility with existing env vars.

**Tech Stack:** TypeScript, googleapis, Node.js HTTP server, Playwright fixtures

---

## Background

### Current Problem
- Root folders must be manually created in Google Drive web UI
- If folders are deleted, tests fail with confusing "File not found" errors
- E2E doesn't wipe Drive before setup (seed does)
- No validation that setup is correct
- Token script saves to BOTH accounts (confusing)

### Two Accounts
| Purpose | Token Var | Folder Var | Email Var |
|---------|-----------|------------|-----------|
| Seed | `GOOGLE_SEED_REFRESH_TOKEN` | `GOOGLE_SEED_ROOT_FOLDER_ID` | `GOOGLE_SEED_EMAIL` |
| E2E | `GOOGLE_E2E_REFRESH_TOKEN` | `GOOGLE_E2E_ROOT_FOLDER_ID` | `GOOGLE_E2E_EMAIL` |

---

## Task 0: Rename Environment Variables Across Codebase

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `e2e/fixtures/google-drive.fixture.ts`
- Modify: `e2e/journeys/global.setup.ts`
- Modify: `scripts/setup-e2e-drive.ts`
- Modify: `CLAUDE.md`
- Modify: `.env.local` (manual)

**Renames:**
| Old | New |
|-----|-----|
| `GOOGLE_TEST_REFRESH_TOKEN` | `GOOGLE_SEED_REFRESH_TOKEN` |
| `GOOGLE_TEST_ROOT_FOLDER_ID` | `GOOGLE_SEED_ROOT_FOLDER_ID` |
| `GOOGLE_TEST_EMAIL` | `GOOGLE_SEED_EMAIL` |
| `E2E_GOOGLE_REFRESH_TOKEN` | `GOOGLE_E2E_REFRESH_TOKEN` |
| `E2E_GOOGLE_ROOT_FOLDER_ID` | `GOOGLE_E2E_ROOT_FOLDER_ID` |
| `E2E_GOOGLE_EMAIL` | `GOOGLE_E2E_EMAIL` |

**Step 1: Update prisma/seed.ts**

Search and replace:
- `GOOGLE_TEST_REFRESH_TOKEN` → `GOOGLE_SEED_REFRESH_TOKEN`
- `GOOGLE_TEST_ROOT_FOLDER_ID` → `GOOGLE_SEED_ROOT_FOLDER_ID`
- `GOOGLE_TEST_EMAIL` → `GOOGLE_SEED_EMAIL`

**Step 2: Update e2e/fixtures/google-drive.fixture.ts**

Search and replace:
- `E2E_GOOGLE_REFRESH_TOKEN` → `GOOGLE_E2E_REFRESH_TOKEN`
- `E2E_GOOGLE_ROOT_FOLDER_ID` → `GOOGLE_E2E_ROOT_FOLDER_ID`

**Step 3: Update e2e/journeys/global.setup.ts**

Search and replace:
- `E2E_GOOGLE_REFRESH_TOKEN` → `GOOGLE_E2E_REFRESH_TOKEN`
- `E2E_GOOGLE_ROOT_FOLDER_ID` → `GOOGLE_E2E_ROOT_FOLDER_ID`

**Step 4: Update scripts/setup-e2e-drive.ts**

Search and replace:
- `E2E_GOOGLE_REFRESH_TOKEN` → `GOOGLE_E2E_REFRESH_TOKEN`
- `E2E_GOOGLE_ROOT_FOLDER_ID` → `GOOGLE_E2E_ROOT_FOLDER_ID`

**Step 5: Update CLAUDE.md environment variables section**

Update the Google Drive and E2E Testing sections to use new names.

**Step 6: Update .env.local (manual reminder)**

User must manually rename in `.env.local`:
```bash
# Old → New
GOOGLE_TEST_REFRESH_TOKEN → GOOGLE_SEED_REFRESH_TOKEN
GOOGLE_TEST_ROOT_FOLDER_ID → GOOGLE_SEED_ROOT_FOLDER_ID
GOOGLE_TEST_EMAIL → GOOGLE_SEED_EMAIL
E2E_GOOGLE_REFRESH_TOKEN → GOOGLE_E2E_REFRESH_TOKEN
E2E_GOOGLE_ROOT_FOLDER_ID → GOOGLE_E2E_ROOT_FOLDER_ID
E2E_GOOGLE_EMAIL → GOOGLE_E2E_EMAIL
```

**Step 7: Run type-check to verify no missed references**

Run: `pnpm run type-check`
Expected: No errors related to undefined env vars

**Step 8: Commit**

```bash
git add prisma/seed.ts e2e/fixtures/google-drive.fixture.ts e2e/journeys/global.setup.ts scripts/setup-e2e-drive.ts CLAUDE.md
git commit -m "refactor: rename Google Drive env vars for consistency

- GOOGLE_TEST_* → GOOGLE_SEED_*
- E2E_GOOGLE_* → GOOGLE_E2E_*

All Google-related vars now use GOOGLE_ prefix with purpose suffix."
```

---

## Task 1: Add Purpose Flag and Folder Auto-Creation to Token Script

**Files:**
- Modify: `scripts/generate-refresh-token.ts`
- Create: `tests/unit/scripts/generate-refresh-token.test.ts`

**Step 1: Add command-line argument parsing for --purpose flag**

Add at the top of the file after imports:

```typescript
// Parse command line arguments
const args = process.argv.slice(2);
const purposeArg = args.find((arg) => arg.startsWith("--purpose="));
const purpose = purposeArg?.split("=")[1] as "e2e" | "seed" | undefined;

// Configuration based on purpose
const CONFIG = {
  e2e: {
    tokenVar: "GOOGLE_E2E_REFRESH_TOKEN",
    folderVar: "GOOGLE_E2E_ROOT_FOLDER_ID",
    folderName: "CanonCore E2E",
    emailVar: "GOOGLE_E2E_EMAIL",
  },
  seed: {
    tokenVar: "GOOGLE_SEED_REFRESH_TOKEN",
    folderVar: "GOOGLE_SEED_ROOT_FOLDER_ID",
    folderName: "CanonCore Seed",
    emailVar: "GOOGLE_SEED_EMAIL",
  },
};
```

**Step 2: Add fetchWithTimeout helper for resilient API calls**

Add after the CONFIG:

```typescript
/**
 * Fetch with timeout to prevent hanging on unresponsive APIs.
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Fetch response
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
```

**Step 3: Add function to search for existing folder**

Add after `validateToken` function:

```typescript
/**
 * Searches for an existing folder by name in Drive root.
 *
 * @param accessToken - Google OAuth access token
 * @param folderName - Name of the folder to find
 * @returns Folder ID if found, null otherwise
 */
async function findExistingFolder(
  accessToken: string,
  folderName: string
): Promise<string | null> {
  const params = new URLSearchParams({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`,
    fields: "files(id,name)",
  });

  const response = await fetchWithTimeout(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to search for folder: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  if (!data.files || data.files.length === 0) {
    return null;
  }

  if (data.files.length > 1) {
    console.warn(`\n⚠️  Found ${data.files.length} folders named "${folderName}" - using first one`);
  }

  return data.files[0].id;
}
```

**Step 4: Add function to create new folder**

```typescript
/**
 * Creates a new folder in Drive root.
 *
 * @param accessToken - Google OAuth access token
 * @param folderName - Name of the folder to create
 * @returns Created folder ID
 */
async function createFolder(
  accessToken: string,
  folderName: string
): Promise<string> {
  const response = await fetchWithTimeout(
    "https://www.googleapis.com/drive/v3/files",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create folder: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.id;
}
```

**Step 5: Add function to find or create root folder**

```typescript
/**
 * Finds existing folder by name or creates a new one.
 *
 * @param accessToken - Google OAuth access token
 * @param folderName - Name of the folder to find/create
 * @returns Folder ID
 */
async function findOrCreateRootFolder(
  accessToken: string,
  folderName: string
): Promise<string> {
  // Search for existing folder
  const existingId = await findExistingFolder(accessToken, folderName);

  if (existingId) {
    console.log(`📁 Found existing folder "${folderName}" (${existingId})`);
    return existingId;
  }

  // Create new folder
  console.log(`📁 Creating folder "${folderName}"...`);
  const newId = await createFolder(accessToken, folderName);
  console.log(`✅ Created folder "${folderName}" (${newId})`);
  return newId;
}
```

**Step 6: Add function to get access token from refresh token**

```typescript
/**
 * Gets access token from refresh token.
 *
 * @param refreshToken - Google OAuth refresh token
 * @param clientId - Google OAuth client ID
 * @param clientSecret - Google OAuth client secret
 * @returns Access token
 */
async function getAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const response = await fetchWithTimeout(
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

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Token refresh failed:", errorText);
    throw new Error(`Failed to get access token: ${response.status}`);
  }

  const { access_token } = await response.json();
  return access_token;
}
```

**Step 7: Add function to get user email**

```typescript
/**
 * Gets the email of the authenticated user.
 *
 * @param accessToken - Google OAuth access token
 * @returns User email or fallback
 */
async function getUserEmail(accessToken: string): Promise<string> {
  try {
    const response = await fetchWithTimeout(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      return "unknown@example.com";
    }

    const data = await response.json();
    return data.email || "unknown@example.com";
  } catch {
    return "unknown@example.com";
  }
}
```

**Step 8: Add HTML escape helper for XSS prevention**

```typescript
/**
 * Escapes HTML special characters to prevent XSS.
 *
 * @param str - String to escape
 * @returns Escaped string
 */
function escapeHtml(str: string): string {
  return str.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
```

**Step 9: Update main() to require purpose flag**

Replace the start of `main()`:

```typescript
async function main() {
  // Kill any process on port 3000 first
  killProcessOnPort(PORT);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("❌ GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required");
    console.error("   Make sure they are set in .env.local");
    process.exit(1);
  }

  // Require purpose flag
  if (!purpose || (purpose !== "e2e" && purpose !== "seed")) {
    console.log("\n🔑 Google OAuth Refresh Token Generator\n");
    console.log("Usage: npx tsx scripts/generate-refresh-token.ts --purpose=<e2e|seed>\n");
    console.log("  --purpose=e2e   Setup for E2E testing");
    console.log("  --purpose=seed  Setup for database seeding\n");
    console.error("❌ Please specify --purpose=e2e or --purpose=seed");
    process.exit(1);
  }

  const config = CONFIG[purpose];
  console.log(`\n🔑 Google OAuth Setup for ${purpose.toUpperCase()}\n`);
  console.log(`   Token var:   ${config.tokenVar}`);
  console.log(`   Folder var:  ${config.folderVar}`);
  console.log(`   Folder name: ${config.folderName}\n`);
```

**Step 10: Update the success handler to create folder and save all values**

Replace the try block inside the server callback (after validating token):

```typescript
      // Validate the token
      console.log("🔍 Validating token...");
      const isValid = await validateToken(refreshToken, clientId, clientSecret);

      if (!isValid) {
        throw new Error("Token validation failed");
      }
      console.log("✅ Token validated successfully!\n");

      // Get access token for folder operations
      console.log("📁 Setting up root folder...");
      const accessToken = await getAccessToken(refreshToken, clientId, clientSecret);

      // Find or create root folder
      const folderId = await findOrCreateRootFolder(accessToken, config.folderName);

      // Get user email
      const userEmail = await getUserEmail(accessToken);
      console.log(`📧 Account: ${userEmail}\n`);

      // Save to .env.local
      console.log("💾 Saving to .env.local...");
      updateEnvFile(config.tokenVar, refreshToken);
      updateEnvFile(config.folderVar, folderId);
      updateEnvFile(config.emailVar, userEmail);
      console.log("✅ Saved to .env.local!\n");

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>✅ Success!</h1>
            <p>Setup complete for ${escapeHtml(purpose.toUpperCase())}. You can close this window.</p>
            <p style="color: #666; margin-top: 20px;">
              Folder: ${escapeHtml(config.folderName)}<br/>
              Account: ${escapeHtml(userEmail)}
            </p>
          </body>
        </html>
      `);

      console.log("─".repeat(60));
      console.log(`✅ Setup complete for ${purpose.toUpperCase()}!\n`);
      console.log(`   ${config.tokenVar}=<saved>`);
      console.log(`   ${config.folderVar}=${folderId}`);
      console.log(`   ${config.emailVar}=${userEmail}`);
      console.log("─".repeat(60));
```

**Step 11: Run the script to verify it works**

Run: `npx tsx scripts/generate-refresh-token.ts`
Expected: Shows usage message asking for --purpose flag

Run: `npx tsx scripts/generate-refresh-token.ts --purpose=e2e`
Expected: Starts OAuth flow, shows correct config for E2E

**Step 12: Commit**

```bash
git add scripts/generate-refresh-token.ts
git commit -m "feat(scripts): add --purpose flag and auto folder creation to token generator"
```

---

## Task 2: Create verify-drive-setup.ts Validation Script

**Files:**
- Create: `scripts/verify-drive-setup.ts`

**Step 1: Create the verification script with parallel account checking**

```typescript
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
 */
async function verifyAccount(config: AccountConfig): Promise<VerificationResult> {
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
      result.error = err instanceof Error ? err.message : "Unknown error occurred";
    }
  }

  return result;
}

/**
 * Prints verification result for an account.
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
  console.log(`   GOOGLE_CLIENT_SECRET: ${clientSecret ? "✅ Set" : "❌ Not set"}`);

  if (!clientId || !clientSecret) {
    console.log("\n❌ Cannot verify accounts without client credentials\n");
    process.exit(1);
  }

  // Determine which accounts to check
  const accountsToCheck = purpose && ACCOUNTS[purpose]
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
    console.log("   npx tsx scripts/generate-refresh-token.ts --purpose=seed\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
```

**Step 2: Run the verification script**

Run: `npx tsx scripts/verify-drive-setup.ts`
Expected: Shows status of both accounts in parallel, E2E folder should show "Not found"

**Step 3: Commit**

```bash
git add scripts/verify-drive-setup.ts
git commit -m "feat(scripts): add verify-drive-setup.ts for Drive configuration validation"
```

---

## Task 3: Add Wipe/Cleanup to E2E Global Setup

**Files:**
- Modify: `e2e/journeys/global.setup.ts`

**Step 1: Add imports for batch delete utility**

Add to the imports at the top:

```typescript
import {
  getDriveClientFromRefreshToken,
  batchDelete,
  emptyTrash,
} from "@/lib/google-drive-client";
```

**Step 2: Add getAccessTokenFromRefreshToken helper**

Add after the imports:

```typescript
/**
 * Gets an access token from a refresh token for batch API operations.
 */
async function getAccessTokenFromRefreshToken(
  refreshToken: string
): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
  }

  const { access_token } = await response.json();
  return access_token;
}
```

**Step 3: Add cleanupE2EDrive function using batchDelete**

Add before `setupE2EDrive`:

```typescript
/**
 * Cleans all content from E2E Google Drive folder.
 * Uses batch delete for efficiency (like seed.ts does).
 */
async function cleanupE2EDrive(): Promise<void> {
  const refreshToken = process.env.GOOGLE_E2E_REFRESH_TOKEN;
  const rootFolderId = process.env.GOOGLE_E2E_ROOT_FOLDER_ID;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!refreshToken || !rootFolderId || !clientId || !clientSecret) {
    console.log("[E2E Setup] Skipping Drive cleanup - missing credentials");
    return;
  }

  console.log("[E2E Setup] Cleaning Google Drive...");

  const drive = await getDriveClientFromRefreshToken(refreshToken);

  // List all items in root folder with pagination
  const allItems: Array<{ id: string; name: string }> = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${rootFolderId}' in parents and trashed = false`,
      fields: "files(id, name), nextPageToken",
      pageSize: 1000,
      pageToken,
    });

    const items = response.data.files || [];
    for (const item of items) {
      if (item.id && item.name) {
        allItems.push({ id: item.id, name: item.name });
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  console.log(`[E2E Setup] Found ${allItems.length} items to delete`);

  // Batch delete items (like seed.ts does)
  if (allItems.length > 0) {
    const fileIds = allItems.map((item) => item.id);
    const accessToken = await getAccessTokenFromRefreshToken(refreshToken);

    const result = await batchDelete(accessToken, fileIds);

    if (result.failed.length > 0) {
      console.warn(
        `[E2E Setup] Failed to delete ${result.failed.length} items:`,
        result.failed.slice(0, 3).map((f) => f.error)
      );
    }

    console.log(`[E2E Setup] Deleted ${result.succeeded.length} items`);
  }

  // Empty trash
  console.log("[E2E Setup] Emptying trash...");
  try {
    await emptyTrash(drive);
  } catch (err) {
    console.warn(
      "[E2E Setup] Failed to empty trash:",
      err instanceof Error ? err.message : err
    );
  }

  console.log("[E2E Setup] Drive cleanup complete");
}
```

**Step 4: Update setupE2EDrive to validate folder exists first**

Add at the beginning of `setupE2EDrive` after setting up the drive client:

```typescript
  // Validate root folder exists
  try {
    const folderCheck = await drive.files.get({
      fileId: rootFolderId,
      fields: "name,trashed",
    });

    if (folderCheck.data.trashed) {
      throw new Error(
        "GOOGLE_E2E_ROOT_FOLDER_ID folder is in trash.\n" +
        "Restore it or run: npx tsx scripts/generate-refresh-token.ts --purpose=e2e"
      );
    }

    console.log(`[E2E Setup] Using root folder: ${folderCheck.data.name}`);
  } catch (err: unknown) {
    const error = err as { code?: number; message?: string };
    if (error.code === 404) {
      throw new Error(
        "GOOGLE_E2E_ROOT_FOLDER_ID folder not found (deleted?).\n" +
        "Run: npx tsx scripts/generate-refresh-token.ts --purpose=e2e"
      );
    }
    throw err;
  }
```

**Step 5: Update the setup call to cleanup first and properly handle errors**

Update the setup function:

```typescript
setup("global setup", async () => {
  try {
    await cleanupE2EDrive();
    await setupE2EDrive();
  } catch (err) {
    // Log the error clearly
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[E2E Setup] ❌ Drive setup failed: ${message}`);

    // Always re-throw to signal setup failure
    throw err;
  }
  console.log("E2E test setup complete");
});
```

**Step 6: Run E2E tests to verify setup works**

Run: `pnpm run test:e2e --project=chromium e2e/journeys/google-drive/drive-sync.spec.ts`
Expected: Tests should fail with clear error about missing folder (since E2E folder is deleted)

**Step 7: Commit**

```bash
git add e2e/journeys/global.setup.ts
git commit -m "feat(e2e): add Drive cleanup before E2E setup using batchDelete, improve error messages"
```

---

## Task 4: Add npm Scripts for Easy Setup

**Files:**
- Modify: `package.json`

**Step 1: Add setup scripts to package.json**

Add to the "scripts" section:

```json
{
  "scripts": {
    "setup:drive:e2e": "tsx scripts/generate-refresh-token.ts --purpose=e2e",
    "setup:drive:seed": "tsx scripts/generate-refresh-token.ts --purpose=seed",
    "setup:drive:verify": "tsx scripts/verify-drive-setup.ts",
    "setup:e2e-structure": "tsx scripts/setup-e2e-drive.ts"
  }
}
```

**Step 2: Verify scripts work**

Run: `pnpm run setup:drive:verify`
Expected: Shows verification results for both accounts

**Step 3: Commit**

```bash
git add package.json
git commit -m "feat(scripts): add npm scripts for Drive setup commands"
```

---

## Task 5: Update CLAUDE.md Documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add Google Drive Setup section**

Add after the "Environment Variables" section:

```markdown
## Google Drive Setup

### Quick Setup

```bash
# For E2E testing
pnpm run setup:drive:e2e

# For database seeding
pnpm run setup:drive:seed

# Verify setup is correct
pnpm run setup:drive:verify
```

### Setup Process

The setup scripts automatically:
1. Start OAuth flow in browser
2. Create root folder in Google Drive (if missing)
3. Save token and folder ID to `.env.local`
4. Validate everything works

### Two Separate Accounts

| Purpose | Account | Variables |
|---------|---------|-----------|
| E2E Tests | jacobreesmedia@gmail.com | `GOOGLE_E2E_REFRESH_TOKEN`, `GOOGLE_E2E_ROOT_FOLDER_ID` |
| Seeding | seed@canoncore.com | `GOOGLE_SEED_REFRESH_TOKEN`, `GOOGLE_SEED_ROOT_FOLDER_ID` |

### Troubleshooting

**"File not found" errors:**
```bash
pnpm run setup:drive:verify  # Check what's wrong
pnpm run setup:drive:e2e     # Re-run setup for E2E
pnpm run setup:drive:seed    # Re-run setup for seed
```

**E2E media tests skipped:**
- Ensure `seed-media/The.Office.UK.S01E01.*.mp4` exists locally
- Run `pnpm run setup:e2e-structure` to upload test video

**Multiple folders with same name:**
- If setup warns about multiple folders, delete duplicates in Google Drive
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Google Drive setup documentation"
```

---

## Task 6: Final Integration Test

**Step 1: Run full verification**

```bash
pnpm run setup:drive:verify
```

Expected: Shows status of both accounts

**Step 2: Run E2E tests with Google Drive**

```bash
pnpm run test:e2e --project=chromium e2e/journeys/google-drive/
```

Expected: Tests run (may fail if E2E account not set up, but with clear error messages)

**Step 3: Final commit with all changes**

```bash
git add -A
git commit -m "feat: complete Google Drive setup automation

- Add --purpose flag to token generator (e2e|seed)
- Auto-create root folder during OAuth flow
- Add verify-drive-setup.ts validation script
- Add Drive cleanup before E2E tests using batchDelete
- Add npm scripts for easy setup
- Update documentation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 0 | Rename env vars for consistency | `prisma/seed.ts`, `e2e/fixtures/*`, `e2e/journeys/*`, `scripts/*`, `CLAUDE.md` |
| 1 | Add purpose flag + folder auto-creation + timeout handling | `scripts/generate-refresh-token.ts` |
| 2 | Create verification script with parallel checking | `scripts/verify-drive-setup.ts` |
| 3 | Add cleanup to E2E setup using batchDelete | `e2e/journeys/global.setup.ts` |
| 4 | Add npm scripts | `package.json` |
| 5 | Update documentation | `CLAUDE.md` |
| 6 | Integration testing | - |

## Key Improvements from Review

- ✅ Consistent env var naming: `GOOGLE_SEED_*` and `GOOGLE_E2E_*`
- ✅ Uses existing `batchDelete` utility instead of sequential deletion
- ✅ Parallel account verification with `Promise.all`
- ✅ Proper URL encoding with `URLSearchParams`
- ✅ Fetch timeout handling with `AbortController`
- ✅ HTML escaping for XSS prevention
- ✅ Warning when multiple folders with same name exist
- ✅ Proper error propagation (always re-throw)
- ✅ More granular steps (2-5 minutes each)
