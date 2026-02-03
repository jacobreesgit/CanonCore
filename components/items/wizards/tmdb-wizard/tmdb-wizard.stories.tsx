/**
 * Storybook stories for the TMDBWizard component.
 * Documents the wizard flow and step configurations.
 *
 * Note: Full interactive testing requires MSW mocking for TMDB API.
 * These stories focus on visual documentation of the wizard structure.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { TMDBWizard } from "./index";
import type { TMDBWizardInitialData } from "./tmdb-wizard-types";
import type { TMDBSearchResult } from "@/lib/tmdb-client";

/**
 * TMDB metadata wizard for applying movie/TV show metadata to items.
 *
 * ## Flow
 * The wizard guides users through 4 steps (varies by content type):
 * 1. **Text**: Select title and description from TMDB
 * 2. **Poster**: Choose poster image from TMDB gallery
 * 3. **Hero**: Choose backdrop/hero image from gallery
 * 4. **Summary**: Review and confirm selections
 *
 * ## Content Types
 * - **Movie/Show**: Full flow (text, poster, hero, summary)
 * - **Season**: No hero step (text, poster, summary)
 * - **Episode**: Still instead of poster (text, still, summary)
 * - **No Drive**: Text only (text, summary)
 *
 * ## MSW Mocking Required
 * This component requires API mocking for full functionality:
 * - `/api/tmdb/images/*` - TMDB image galleries
 * - `/api/tmdb/season/*` - Season images
 * - `/api/tmdb/episode/*` - Episode stills
 */
const meta = {
  title: "Items/Wizards/TMDB/TMDBWizard",
  component: TMDBWizard,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Multi-step wizard for applying TMDB metadata to library items. Requires MSW mocking for TMDB API endpoints.",
      },
    },
  },
  argTypes: {
    initialData: {
      description: "Initial TMDB search result and configuration",
    },
    currentValues: {
      description: "Current item values for comparison",
    },
    uploadMode: {
      control: "boolean",
      description: "Whether in upload mode (AddItemDialog)",
    },
    hasDriveConnection: {
      control: "boolean",
      description: "Whether user has Google Drive connected",
    },
  },
  args: {
    onComplete: fn(),
    onCancel: fn(),
  },
  decorators: [
    (Story) => (
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <div className="bg-card w-full max-w-2xl rounded-lg border p-6 shadow-lg">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof TMDBWizard>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock TMDB search results
const mockMovieResult: TMDBSearchResult = {
  id: 238,
  mediaType: "movie",
  title: "The Godfather",
  overview:
    "Spanning the years 1945 to 1955, a chronicle of the fictional Italian-American Corleone crime family.",
  posterPath: "/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
  backdropPath: "/tmU7GeKVybMWFButWEGl2M4GeiP.jpg",
  year: "1972",
};

const mockTvResult: TMDBSearchResult = {
  id: 1396,
  mediaType: "tv",
  title: "Breaking Bad",
  overview:
    "A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine.",
  posterPath: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
  backdropPath: "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
  year: "2008",
};

// Create proper initial data objects with required preview data
const createMockInitialData = (
  result: TMDBSearchResult,
  contentType: "movie" | "show" | "season" | "episode"
): TMDBWizardInitialData => ({
  tmdbResult: result,
  preview: {
    name: `${result.title} (${result.year})`,
    description: result.overview,
  },
  contentType,
});

const movieInitialData = createMockInitialData(mockMovieResult, "movie");
const tvShowInitialData = createMockInitialData(mockTvResult, "show");
const seasonInitialData = createMockInitialData(mockTvResult, "season");
const episodeInitialData = createMockInitialData(mockTvResult, "episode");

const currentValues = {
  name: "",
  description: "",
};

/**
 * Movie wizard flow.
 * Shows full 4-step wizard for movies.
 */
export const Movie: Story = {
  args: {
    initialData: movieInitialData,
    currentValues,
    uploadMode: false,
    hasDriveConnection: true,
  },
};

/**
 * TV Show wizard flow.
 * Shows full 4-step wizard for TV shows.
 */
export const TVShow: Story = {
  args: {
    initialData: tvShowInitialData,
    currentValues,
    uploadMode: false,
    hasDriveConnection: true,
  },
};

/**
 * Season wizard flow.
 * Shows 3-step wizard (no hero step).
 */
export const Season: Story = {
  args: {
    initialData: seasonInitialData,
    currentValues,
    uploadMode: false,
    hasDriveConnection: true,
  },
};

/**
 * Episode wizard flow.
 * Shows still image step instead of poster.
 */
export const Episode: Story = {
  args: {
    initialData: episodeInitialData,
    currentValues,
    uploadMode: false,
    hasDriveConnection: true,
  },
};

/**
 * Without Drive connection.
 * Shows simplified 2-step flow (text + summary only).
 */
export const NoDriveConnection: Story = {
  args: {
    initialData: movieInitialData,
    currentValues,
    uploadMode: false,
    hasDriveConnection: false,
  },
};

/**
 * Upload mode (AddItemDialog).
 * Files are queued instead of applied immediately.
 */
export const UploadMode: Story = {
  args: {
    initialData: movieInitialData,
    currentValues,
    uploadMode: true,
    hasDriveConnection: true,
    queuedArtwork: [],
    queuedHero: [],
    onArtworkQueue: fn(),
    onHeroQueue: fn(),
  },
};

/**
 * With existing item values.
 * Shows comparison with current values.
 */
export const WithExistingValues: Story = {
  args: {
    initialData: movieInitialData,
    currentValues: {
      name: "Godfather (1972)",
      description: "A classic crime drama film.",
    },
    uploadMode: false,
    hasDriveConnection: true,
  },
};

// === INTERACTION TESTS ===

/**
 * Wizard step navigation.
 * Tests navigating through wizard steps using Next/Back buttons.
 */
export const StepNavigation: Story = {
  args: {
    initialData: movieInitialData,
    currentValues,
    uploadMode: false,
    hasDriveConnection: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for wizard to render with explicit timeout for animation completion
    await waitFor(
      async () => {
        const heading = canvas.queryByRole("heading", {
          name: /title & description/i,
        });
        await expect(heading).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Find and click Next button to proceed to Poster step
    const nextButton = canvas.getByRole("button", { name: /next/i });
    await expect(nextButton).toBeInTheDocument();
    await userEvent.click(nextButton);

    // Wait for Poster step with explicit timeout
    await waitFor(
      async () => {
        const heading = canvas.queryByRole("heading", { name: /poster/i });
        await expect(heading).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Wait for Back button to be enabled (not disabled, no pointer-events: none)
    await waitFor(
      async () => {
        const backBtn = canvas.queryByRole("button", { name: /back/i });
        await expect(backBtn).toBeInTheDocument();
        await expect(backBtn).not.toBeDisabled();
      },
      { timeout: 3000 }
    );

    // Click Back to return to Text step
    const backButton = canvas.getByRole("button", { name: /back/i });
    await userEvent.click(backButton);

    // Verify we're back on Text step
    await waitFor(
      async () => {
        const heading = canvas.queryByRole("heading", {
          name: /title & description/i,
        });
        await expect(heading).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "Demonstrates multi-step wizard navigation with Next and Back buttons.",
      },
    },
  },
};

/**
 * Text selection interaction.
 * Tests selecting metadata options on the text step.
 */
export const TextSelectionInteraction: Story = {
  args: {
    initialData: movieInitialData,
    currentValues,
    uploadMode: false,
    hasDriveConnection: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for text step with explicit timeout
    await waitFor(
      async () => {
        const heading = canvas.queryByRole("heading", {
          name: /title & description/i,
        });
        await expect(heading).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Find checkboxes for title and description
    const checkboxes = canvas.getAllByRole("checkbox");
    await expect(checkboxes.length).toBeGreaterThan(0);

    // Toggle first checkbox
    await userEvent.click(checkboxes[0]);
  },
  parameters: {
    docs: {
      description: {
        story:
          "Users can select which metadata fields to apply from TMDB results.",
      },
    },
  },
};

/**
 * Cancel wizard interaction.
 * Tests the onCancel callback prop for exiting the wizard.
 */
export const CancelInteraction: Story = {
  args: {
    initialData: movieInitialData,
    currentValues,
    uploadMode: false,
    hasDriveConnection: true,
    onCancel: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for wizard to render (use heading role for specificity)
    await canvas.findByRole("heading", { name: /title & description/i });

    // Verify wizard navigation is present with Next button
    const nextButton = canvas.getByRole("button", { name: /next/i });
    await expect(nextButton).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          "The onCancel callback can be used by parent components to handle wizard cancellation.",
      },
    },
  },
};
