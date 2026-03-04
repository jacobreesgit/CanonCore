/**
 * Configuration mapping screenshots to LS Graphics mockup scenes.
 *
 * Two use cases:
 * A. Feature Accordion — 5 laptop screenshots → unique MacBook scenes → public/images/*.webp
 * B. Portfolio Website  — 16 screenshots (laptop + mobile) → 2 scenes each → public/portfolio/*.webp
 *
 * Media-stack images (03-item-detail, 07-explore-page) are converted inline
 * during screenshot capture (no mockup needed) — see screenshot.utils.ts.
 */
import path from "node:path";

const SCREENSHOTS_DIR = path.resolve("e2e/output/screenshots");
const IMAGES_DIR = path.resolve("public/images");
const PORTFOLIO_DIR = path.resolve("public/portfolio");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SceneConfig {
  /** LS Graphics scene slug (used in URL path: /assets/{slug}) */
  slug: string;
  /** Human-readable label for test output */
  label: string;
}

export interface MockupEntry {
  /** Unique identifier for the mockup */
  id: string;
  /** Path to the source screenshot PNG */
  screenshotPath: string;
  /** LS Graphics scene to use */
  scene: SceneConfig;
  /** Where to save the final webp */
  outputPath: string;
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

const SCENES = {
  // Accordion scenes (various MacBook angles)
  "ab-scene-11": { slug: "ab-mockups-scene-11", label: "AB Mockup Scene 11" },
  "ab-scene-14": { slug: "ab-mockups-scene-14", label: "AB Mockup Scene 14" },
  "ab-scene-05": { slug: "ab-mockups-scene-05", label: "AB Mockup Scene 05" },
  "ab-scene-10": { slug: "ab-mockups-scene-10", label: "AB Mockup Scene 10" },
  "ab-scene-03": { slug: "ab-mockups-scene-03", label: "AB Mockup Scene 03" },
  // Portfolio scenes
  "macbook-pro-3": {
    slug: "macbook-pro-scene-3",
    label: "MacBook Pro Scene 3",
  },
  "iphone-16e-22": {
    slug: "iphone-16e-mockup-scene-22",
    label: "iPhone 16e Scene 22",
  },
} as const satisfies Record<string, SceneConfig>;

// ---------------------------------------------------------------------------
// Feature Accordion Mockups (5 entries → public/images/)
// ---------------------------------------------------------------------------

export const ACCORDION_MOCKUPS: MockupEntry[] = [
  {
    id: "02-tree-view-accordion",
    screenshotPath: path.join(SCREENSHOTS_DIR, "02-tree-view-laptop.png"),
    scene: SCENES["ab-scene-11"],
    outputPath: path.join(IMAGES_DIR, "02-tree-view.webp"),
  },
  {
    id: "04-tmdb-wizard-accordion",
    screenshotPath: path.join(SCREENSHOTS_DIR, "04-tmdb-wizard-laptop.png"),
    scene: SCENES["ab-scene-14"],
    outputPath: path.join(IMAGES_DIR, "04-tmdb-wizard.webp"),
  },
  {
    id: "09-playlist-detail-accordion",
    screenshotPath: path.join(SCREENSHOTS_DIR, "09-playlist-detail-laptop.png"),
    scene: SCENES["ab-scene-05"],
    outputPath: path.join(IMAGES_DIR, "09-playlist-detail.webp"),
  },
  {
    id: "08-spotlight-search-accordion",
    screenshotPath: path.join(
      SCREENSHOTS_DIR,
      "08-spotlight-search-laptop.png"
    ),
    scene: SCENES["ab-scene-10"],
    outputPath: path.join(IMAGES_DIR, "08-spotlight-search.webp"),
  },
  {
    id: "32-fork-dialog-accordion",
    screenshotPath: path.join(SCREENSHOTS_DIR, "32-fork-dialog-laptop.png"),
    scene: SCENES["ab-scene-03"],
    outputPath: path.join(IMAGES_DIR, "32-fork-dialog.webp"),
  },
];

// ---------------------------------------------------------------------------
// Portfolio Mockups (16 entries — 8 features × 2 devices → public/portfolio/)
// ---------------------------------------------------------------------------

const PORTFOLIO_FEATURES = [
  "01-library-grid",
  "02-tree-view",
  "04-tmdb-wizard",
  "06-google-drive-sync",
  "07-explore-page",
  "08-spotlight-search",
  "32-fork-dialog",
  "36-docs",
] as const;

export const PORTFOLIO_MOCKUPS: MockupEntry[] = PORTFOLIO_FEATURES.flatMap(
  (feature) => [
    {
      id: `${feature}-macbook`,
      screenshotPath: path.join(SCREENSHOTS_DIR, `${feature}-laptop.png`),
      scene: SCENES["macbook-pro-3"],
      outputPath: path.join(PORTFOLIO_DIR, `${feature}-macbook.webp`),
    },
    {
      id: `${feature}-iphone`,
      screenshotPath: path.join(SCREENSHOTS_DIR, `${feature}-mobile.png`),
      scene: SCENES["iphone-16e-22"],
      outputPath: path.join(PORTFOLIO_DIR, `${feature}-iphone.webp`),
    },
  ]
);

// ---------------------------------------------------------------------------
// Combined
// ---------------------------------------------------------------------------

export const ALL_MOCKUPS: MockupEntry[] = [
  ...ACCORDION_MOCKUPS,
  ...PORTFOLIO_MOCKUPS,
];
