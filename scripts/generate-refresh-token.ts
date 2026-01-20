/**
 * Google OAuth refresh token generator with automatic folder creation.
 *
 * Usage:
 *   npx tsx scripts/generate-refresh-token.ts --purpose=e2e
 *   npx tsx scripts/generate-refresh-token.ts --purpose=seed
 *
 * This will:
 * 1. Start a local server to receive the OAuth callback
 * 2. Open your browser to authorize with Google
 * 3. Exchange the code for a refresh token
 * 4. Create or find the root folder in Google Drive
 * 5. Save the token, folder ID, and email to .env.local
 */

import dotenv from "dotenv";
import path from "path";
import fs from "fs";

const ENV_FILE_PATH = path.resolve(__dirname, "../.env.local");
dotenv.config({ path: ENV_FILE_PATH });

import http from "http";
import { URL } from "url";
import { execSync } from "child_process";
// @ts-expect-error - Script uses require for dynamic import
import { OAuth2Client } from "google-auth-library";

const PORT = 3000;
const TIMEOUT_MS = 30000;

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
 * Kills any process currently using the specified port.
 */
function killProcessOnPort(port: number): void {
  try {
    const pids = execSync(`lsof -ti:${port}`, { encoding: "utf-8" }).trim();
    if (pids) {
      console.log(`🔪 Killing process(es) on port ${port}...`);
      execSync(`kill -9 ${pids.split("\n").join(" ")}`);
      console.log(`✅ Port ${port} is now free\n`);
    }
  } catch {
    // No process on port, which is fine
  }
}

const REDIRECT_URI = `http://localhost:${PORT}/api/auth/callback/google-drive`;

const SCOPES = [
  "https://www.googleapis.com/auth/drive", // Full drive access for emptyTrash
  "https://www.googleapis.com/auth/userinfo.email",
];

/**
 * Updates or adds an environment variable in .env.local file.
 *
 * @param key - Environment variable name
 * @param value - Environment variable value
 */
function updateEnvFile(key: string, value: string): void {
  let content = "";
  if (fs.existsSync(ENV_FILE_PATH)) {
    content = fs.readFileSync(ENV_FILE_PATH, "utf-8");
  }

  const regex = new RegExp(`^${key}=.*$`, "m");
  const newLine = `${key}=${value}`;

  if (regex.test(content)) {
    // Update existing key
    content = content.replace(regex, newLine);
  } else {
    // Add new key at the end
    content = content.trimEnd() + "\n" + newLine + "\n";
  }

  fs.writeFileSync(ENV_FILE_PATH, content);
}

/**
 * Validates the refresh token by making a test API call.
 *
 * @param refreshToken - Google OAuth refresh token
 * @param clientId - Google OAuth client ID
 * @param clientSecret - Google OAuth client secret
 * @returns True if token is valid
 */
async function validateToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<boolean> {
  try {
    // Get access token from refresh token
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
      return false;
    }

    const { access_token } = await response.json();

    // Test the access token by listing files
    const driveResponse = await fetchWithTimeout(
      "https://www.googleapis.com/drive/v3/about?fields=user",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    return driveResponse.ok;
  } catch {
    return false;
  }
}

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
    throw new Error(
      `Failed to search for folder: ${response.status} ${errorText}`
    );
  }

  const data = await response.json();

  if (!data.files || data.files.length === 0) {
    return null;
  }

  if (data.files.length > 1) {
    console.warn(
      `\n⚠️  Found ${data.files.length} folders named "${folderName}" - using first one`
    );
  }

  return data.files[0].id;
}

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
  const response = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Token refresh failed:", errorText);
    throw new Error(`Failed to get access token: ${response.status}`);
  }

  const { access_token } = await response.json();
  return access_token;
}

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

/**
 * Escapes HTML special characters to prevent XSS.
 *
 * @param str - String to escape
 * @returns Escaped string
 */
function escapeHtml(str: string): string {
  return str.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

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
    console.log(
      "Usage: npx tsx scripts/generate-refresh-token.ts --purpose=<e2e|seed>\n"
    );
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

  const oauth2Client = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);

  // Generate the authorization URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force consent to get refresh token
  });

  console.log("─".repeat(60));
  console.log("\n1. Open this URL in your browser:\n");
  console.log(`   ${authUrl}\n`);
  console.log(
    "2. Sign in with the Google account you want to use for " +
      purpose.toUpperCase()
  );
  console.log("3. Grant the requested permissions\n");
  console.log(`⏳ Waiting for callback on http://localhost:${PORT}...\n`);

  // Start a simple server to receive the callback
  const server = http.createServer(async (req, res) => {
    if (!req.url?.startsWith("/api/auth/callback/google-drive")) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      res.writeHead(400);
      res.end(`Error: ${error}`);
      console.error(`❌ OAuth error: ${error}`);
      server.close();
      process.exit(1);
    }

    if (!code) {
      res.writeHead(400);
      res.end("No authorization code received");
      return;
    }

    try {
      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      const refreshToken = tokens.refresh_token;

      if (!refreshToken) {
        throw new Error("No refresh token received");
      }

      // Validate the token
      console.log("🔍 Validating token...");
      const isValid = await validateToken(refreshToken, clientId, clientSecret);

      if (!isValid) {
        throw new Error("Token validation failed");
      }
      console.log("✅ Token validated successfully!\n");

      // Get access token for folder operations
      console.log("📁 Setting up root folder...");
      const accessToken = await getAccessToken(
        refreshToken,
        clientId,
        clientSecret
      );

      // Find or create root folder
      const folderId = await findOrCreateRootFolder(
        accessToken,
        config.folderName
      );

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

      server.close();
      process.exit(0);
    } catch (err) {
      res.writeHead(500);
      res.end("Failed to exchange code for tokens");
      console.error("❌ Failed:", err);
      server.close();
      process.exit(1);
    }
  });

  server.listen(PORT);
}

main().catch(console.error);
