/**
 * Script to generate a Google OAuth refresh token for E2E testing.
 *
 * Usage:
 *   npx tsx scripts/generate-refresh-token.ts
 *
 * This will:
 * 1. Start a local server to receive the OAuth callback
 * 2. Open your browser to authorize with Google
 * 3. Exchange the code for a refresh token
 * 4. Print the refresh token for you to add to .env.local
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import http from "http";
import { URL } from "url";
// @ts-expect-error - Script uses require for dynamic import
import { OAuth2Client } from "google-auth-library";

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/api/auth/callback/google-drive`;

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("❌ GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required");
    console.error("   Make sure they are set in .env.local");
    process.exit(1);
  }

  const oauth2Client = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);

  // Generate the authorization URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force consent to get refresh token
  });

  console.log("\n🔑 Google OAuth Refresh Token Generator\n");
  console.log(
    "⚠️  Make sure your Next.js dev server is STOPPED (port 3000 must be free)\n"
  );
  console.log("─".repeat(60));
  console.log("\n1. Open this URL in your browser:\n");
  console.log(`   ${authUrl}\n`);
  console.log(
    "2. Sign in with the Google account you want to use for E2E tests"
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

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>✅ Success!</h1>
            <p>You can close this window and check your terminal.</p>
          </body>
        </html>
      `);

      console.log("✅ Successfully obtained tokens!\n");
      console.log("Add these to your .env.local:\n");
      console.log("─".repeat(60));
      console.log(`E2E_GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log("─".repeat(60));
      console.log(
        "\nAlso create a folder in Google Drive for E2E tests and set:"
      );
      console.log("E2E_GOOGLE_ROOT_FOLDER_ID=<folder-id>");
      console.log("E2E_GOOGLE_EMAIL=jacobreesmedia@gmail.com");
      console.log("─".repeat(60));

      server.close();
      process.exit(0);
    } catch (err) {
      res.writeHead(500);
      res.end("Failed to exchange code for tokens");
      console.error("❌ Failed to exchange code:", err);
      server.close();
      process.exit(1);
    }
  });

  server.listen(PORT);
}

main().catch(console.error);
