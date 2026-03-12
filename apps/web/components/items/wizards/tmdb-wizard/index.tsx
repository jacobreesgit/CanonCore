/**
 * TMDB metadata wizard for applying movie/TV show metadata to items.
 * Guides users through text, poster, hero selection steps with review.
 */

// Type exports
export type {
  TMDBWizardStep,
  TMDBWizardData,
  TMDBWizardInitialData,
  TMDBWizardProps,
  TMDBWizardResult,
  TMDBWizardHeaderProps,
  TMDBWizardFooterProps,
  TMDBWizardLoadingKey,
  TMDBStepProps,
  TMDBArtworkStepProps,
  TMDBSummaryStepProps,
  ArtworkSelection,
  ExistingArtworkFile,
  CurrentTextValues,
  TextPreviewData,
  TitleDescriptionOptions,
} from "./tmdb-wizard-types";

// Constants exports
export {
  TMDB_WIZARD_STEPS,
  TMDB_WIZARD_STEP_LABELS,
  toExistingArtworkFile,
  createInitialTMDBWizardData,
} from "./tmdb-wizard-types";

// Hook export
export { useTMDBWizard } from "./use-tmdb-wizard";
export type { UseTMDBWizardReturn } from "./use-tmdb-wizard";

// Main wizard component
export { TMDBWizard } from "./tmdb-wizard";

// Step components (for direct use if needed)
export { TMDBTextStep } from "./text-step";
export { TMDBPosterStep } from "./poster-step";
export { TMDBHeroStep } from "./hero-step";
export { TMDBLogoStep } from "./logo-step";
export { TMDBSummaryStep } from "./summary-step";
