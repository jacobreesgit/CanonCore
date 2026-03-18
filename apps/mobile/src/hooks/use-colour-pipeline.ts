import { useMemo } from "react";
import { createColourShades } from "@canoncore/utils/colour";

/**
 * Shade step -> hex colour mapping.
 * Steps match the web's --dark-100 through --dark-1000 pipeline.
 */
export type ColourShades = Record<number, string>;

/**
 * Generate 10 colour shades from a dominant hex colour.
 *
 * Returns a Record<number, string> keyed by step (100-1000):
 *   { 100: "#c4d0dc", 200: "#8ea1b9", ..., 1000: "#050b12" }
 *
 * On React Native, CSS custom properties can't be injected via inline styles.
 * Components use the returned shade values directly for backgroundColor,
 * LinearGradient colors, etc. The NativeWind @theme defaults in global.css
 * provide neutral fallbacks when no colour is provided.
 *
 * Falls back to null when no colour provided.
 */
export function useColourPipeline(
  dominantColour: string | null,
): ColourShades | null {
  return useMemo(() => {
    if (!dominantColour) return null;

    const rawShades = createColourShades(dominantColour);
    // rawShades is { "--dark-100": "#...", "--dark-200": "#...", ..., "--dark-1000": "#..." }

    // Remap from CSS variable keys to numeric step keys for direct use
    const shades: ColourShades = {};
    for (const [key, value] of Object.entries(rawShades)) {
      const step = parseInt(key.replace("--dark-", ""), 10);
      shades[step] = value;
    }

    return shades;
  }, [dominantColour]);
}
