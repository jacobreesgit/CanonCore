/**
 * Server-only colour extraction using sharp.
 *
 * Separated from colour-utils.ts to avoid bundling the sharp native module
 * into client components. Import this only in server actions / API routes.
 */

import sharp from "sharp";

import { rgbToHex, boostSaturation } from "@/lib/colour-utils";

/**
 * Extracts the dominant colour from an image.
 * Accepts either a Buffer (for uploaded images) or a URL string (for TMDB images).
 *
 * Uses sharp's `stats()` API which returns the dominant colour via proper
 * colour frequency analysis (more accurate than averaging via 1x1 resize).
 *
 * @param input - Image buffer or URL string
 * @returns Hex colour string (e.g., "#1a3a5c") or null on failure
 */
export async function extractDominantColour(
  input: Buffer | string
): Promise<string | null> {
  try {
    let buffer: Buffer;

    if (typeof input === "string") {
      const response = await fetch(input);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      buffer = input;
    }

    const { dominant } = await sharp(buffer).stats();
    const raw = rgbToHex(dominant.r, dominant.g, dominant.b);

    return boostSaturation(raw);
  } catch {
    return null;
  }
}
