/**
 * Colour utility for the cinematic visual pipeline.
 * Generates CSS custom property shades from a single dominant colour.
 *
 * Used by CinematicHero to inject per-item page theming via inline styles.
 * Pure math helpers (hexToRgb, rgbToHex, lerp, createColourShades) have no
 * external dependencies — safe for client components.
 *
 * Server-side image analysis (extractDominantColour) lives in
 * colour-extract.ts to avoid bundling sharp into client code.
 */

/**
 * Parses a hex colour string to RGB components.
 * Supports 3-digit (#abc) and 6-digit (#aabbcc) formats.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/**
 * Converts RGB to a 6-digit hex string.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;
}

/**
 * Linearly interpolates between two values.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Boosts the saturation of a hex colour in HSL space.
 * Ensures extracted dominant colours are vibrant enough for page theming
 * while clamping lightness to stay within a cinematic dark range.
 *
 * @param hex - Input hex colour (e.g., "#3a3a4c")
 * @param minSaturation - Minimum saturation floor (0–1, default 0.4 = 40%)
 * @param boost - Multiplier applied to existing saturation (default 1.5)
 * @param maxLightness - Maximum lightness ceiling (0–1, default 0.25 = 25%)
 * @returns Hex colour with boosted saturation and clamped lightness
 */
export function boostSaturation(
  hex: string,
  minSaturation = 0.4,
  boost = 1.5,
  maxLightness = 0.25
): string {
  const { r, g, b } = hexToRgb(hex);
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;

  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const delta = max - min;

  // Lightness — clamped to maxLightness so bright backdrops stay dark
  const l = Math.min((max + min) / 2, maxLightness);

  // Hue
  let h = 0;
  if (delta !== 0) {
    if (max === rN) h = ((gN - bN) / delta + (gN < bN ? 6 : 0)) / 6;
    else if (max === gN) h = ((bN - rN) / delta + 2) / 6;
    else h = ((rN - gN) / delta + 4) / 6;
  }

  // Saturation
  let s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  // Boost and clamp
  s = Math.min(1, Math.max(minSaturation, s * boost));

  // HSL → RGB
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;

  let rO: number, gO: number, bO: number;
  const sector = Math.floor(h * 6);
  switch (sector % 6) {
    case 0:
      rO = c;
      gO = x;
      bO = 0;
      break;
    case 1:
      rO = x;
      gO = c;
      bO = 0;
      break;
    case 2:
      rO = 0;
      gO = c;
      bO = x;
      break;
    case 3:
      rO = 0;
      gO = x;
      bO = c;
      break;
    case 4:
      rO = x;
      gO = 0;
      bO = c;
      break;
    default:
      rO = c;
      gO = 0;
      bO = x;
      break;
  }

  return rgbToHex((rO + m) * 255, (gO + m) * 255, (bO + m) * 255);
}

/**
 * Generates 10 CSS custom property shades from a single hex colour.
 *
 * Shade 100 = lightest (mixed towards white), shade 1000 = darkest (mixed towards black).
 * Shade 700 ≈ the input colour — used as the primary gradient overlay base.
 *
 * @param hex - Input colour as hex string (e.g., "#1a3a5c" or "#abc")
 * @returns Record mapping CSS custom property names to hex values
 *
 * @example
 * const shades = createColourShades("#1a3a5c");
 * // { "--dark-100": "#c4d0dc", "--dark-200": "#8ea1b9", ..., "--dark-1000": "#050b12" }
 * // Spread into a container's style prop for page-wide theming.
 */
export function createColourShades(hex: string): Record<string, string> {
  const { r, g, b } = hexToRgb(hex);
  const shades: Record<string, string> = {};

  // 10 shades: 100 (lightest) to 1000 (darkest)
  // Map shade index to interpolation factor:
  //   100 → 0.2 (20% of the way from white to the colour)
  //   700 → 1.0 (the colour itself)
  //   1000 → deepest dark
  const steps = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

  for (const step of steps) {
    let shade: string;

    if (step <= 700) {
      // Interpolate from white (255,255,255) towards the input colour
      // step 100 → t=0.2, step 700 → t=1.0
      const t = 0.2 + ((step - 100) / 600) * 0.8;
      shade = rgbToHex(lerp(255, r, t), lerp(255, g, t), lerp(255, b, t));
    } else {
      // Interpolate from the input colour towards black (0,0,0)
      // step 800 → t=0.33, step 1000 → t=1.0
      const t = ((step - 700) / 300) * 1.0;
      shade = rgbToHex(lerp(r, 0, t), lerp(g, 0, t), lerp(b, 0, t));
    }

    shades[`--dark-${step}`] = shade;
  }

  return shades;
}
