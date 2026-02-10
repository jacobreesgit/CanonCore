/**
 * Stories for TMDBPosterStep component.
 * Fetches real TMDB poster galleries via Storybook loaders.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { TMDBPosterStep } from "./poster-step";
import type { TMDBWizardData, ArtworkSelection } from "./tmdb-wizard-types";
import { fetchTmdbImages } from "../../../../.storybook/lib/tmdb";

/**
 * Creates mock wizard data for poster step stories.
 */
function createMockData(
  overrides: Partial<TMDBWizardData> = {}
): Partial<TMDBWizardData> {
  return {
    contentType: "movie",
    images: {
      posters: [],
      backdrops: [],
    },
    poster: {
      value: null,
      source: null,
      skipped: false,
    },
    ...overrides,
  };
}

const mockCurrentValues = {
  name: "My Movie",
  description: "My description",
};

const meta: Meta<typeof TMDBPosterStep> = {
  title: "Items/Wizards/TMDB/PosterStep",
  component: TMDBPosterStep,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Poster selection step displaying TMDB posters in a 2:3 aspect ratio grid with skip option.",
      },
    },
    // Disable nested-interactive check - the Dropzone component uses a Button
    // wrapper with a hidden file input, which is a common react-dropzone pattern
    a11y: {
      config: {
        rules: [{ id: "nested-interactive", enabled: false }],
      },
    },
  },
  argTypes: {
    data: { control: false },
    isLoading: { control: "boolean" },
    error: { control: "text" },
    canGoBack: { control: "boolean" },
    showNavigation: { control: "boolean" },
    uploadMode: { control: "boolean" },
    hasDriveConnection: { control: "boolean" },
  },
  args: {
    currentValues: mockCurrentValues,
    isLoading: false,
    error: null,
    canGoBack: true,
    showNavigation: true,
    uploadMode: false,
    hasDriveConnection: true,
    onNext: fn(),
    onBack: fn(),
    onDataChange: fn(),
    onLoadingChange: fn(),
    onError: fn(),
    onSkip: fn(),
  },
  decorators: [
    (Story) => (
      <div className="bg-background w-[600px] rounded-lg border p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Inception (2010) poster gallery from TMDB.
 */
export const Default: Story = {
  args: { data: createMockData() },
  loaders: [
    async () => {
      const images = await fetchTmdbImages(27205, "movie");
      return { images };
    },
  ],
  render: (args, { loaded: { images } }) => (
    <TMDBPosterStep
      {...args}
      data={createMockData({
        images: images ?? { posters: [], backdrops: [] },
      })}
    />
  ),
};

/**
 * The Dark Knight (2008) poster gallery from TMDB.
 */
export const TheDarkKnight: Story = {
  args: { data: createMockData() },
  loaders: [
    async () => {
      const images = await fetchTmdbImages(155, "movie");
      return { images };
    },
  ],
  render: (args, { loaded: { images } }) => (
    <TMDBPosterStep
      {...args}
      data={createMockData({
        images: images ?? { posters: [], backdrops: [] },
      })}
    />
  ),
};

/**
 * Poster already selected.
 */
export const WithSelection: Story = {
  args: { data: createMockData() },
  loaders: [
    async () => {
      const images = await fetchTmdbImages(27205, "movie");
      return { images };
    },
  ],
  render: (args, { loaded: { images } }) => (
    <TMDBPosterStep
      {...args}
      data={createMockData({
        images: images ?? { posters: [], backdrops: [] },
        poster: {
          value: images?.posters?.[0]?.file_path ?? null,
          source: "tmdb",
          skipped: false,
        } as ArtworkSelection,
      })}
    />
  ),
};

/**
 * Poster step skipped.
 */
export const Skipped: Story = {
  args: {
    data: createMockData({
      poster: {
        value: null,
        source: null,
        skipped: true,
      },
    }),
  },
};

/**
 * No posters available from TMDB.
 */
export const NoPosters: Story = {
  args: {
    data: createMockData({
      images: {
        posters: [],
        backdrops: [],
      },
    }),
  },
};

/**
 * Error state when loading fails.
 */
export const WithError: Story = {
  args: {
    data: createMockData(),
    error: "Failed to load poster images. Please try again.",
  },
};

/**
 * Season content type (uses seasonImages).
 */
export const SeasonContent: Story = {
  args: { data: createMockData({ contentType: "season" }) },
  loaders: [
    async () => {
      const images = await fetchTmdbImages(27205, "movie");
      return { images };
    },
  ],
  render: (args, { loaded: { images } }) => (
    <TMDBPosterStep
      {...args}
      data={createMockData({
        contentType: "season",
        images: null,
        seasonImages: {
          posters: (images?.posters ?? []).slice(0, 2),
        },
      })}
    />
  ),
};

/**
 * Upload mode enabled (AddItemDialog).
 * Shows tabs with TMDB images and My Uploads dropzone.
 */
export const UploadMode: Story = {
  args: { data: createMockData(), uploadMode: true },
  loaders: [
    async () => {
      const images = await fetchTmdbImages(27205, "movie");
      return { images };
    },
  ],
  render: (args, { loaded: { images } }) => (
    <TMDBPosterStep
      {...args}
      data={createMockData({
        images: images ?? { posters: [], backdrops: [] },
      })}
      uploadMode
      hasDriveConnection
      queuedFiles={[]}
      onFilesQueue={fn()}
    />
  ),
};

/**
 * Without back navigation.
 */
export const NoBackButton: Story = {
  args: {
    data: createMockData(),
    canGoBack: false,
  },
};

/**
 * Without inline navigation (parent handles footer).
 */
export const NoNavigation: Story = {
  args: {
    data: createMockData(),
    showNavigation: false,
  },
};
