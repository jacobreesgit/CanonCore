/**
 * Stories for TMDBHeroStep component.
 * Fetches real TMDB backdrop galleries via Storybook loaders.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { TMDBHeroStep } from "./hero-step";
import type { TMDBWizardData, ArtworkSelection } from "./tmdb-wizard-types";
import { fetchTmdbImages } from "../../../../.storybook/lib/tmdb";

/**
 * Creates mock wizard data for hero step stories.
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
    backdrop: {
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

const meta: Meta<typeof TMDBHeroStep> = {
  title: "Items/Wizards/TMDB/HeroStep",
  component: TMDBHeroStep,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Hero/backdrop selection step displaying TMDB backdrops in a 16:9 aspect ratio grid with skip option.",
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
 * Inception (2010) backdrop gallery from TMDB.
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
    <TMDBHeroStep
      {...args}
      data={createMockData({
        images: images ?? { posters: [], backdrops: [] },
      })}
    />
  ),
};

/**
 * Interstellar (2014) backdrop gallery from TMDB.
 */
export const Interstellar: Story = {
  args: { data: createMockData() },
  loaders: [
    async () => {
      const images = await fetchTmdbImages(157336, "movie");
      return { images };
    },
  ],
  render: (args, { loaded: { images } }) => (
    <TMDBHeroStep
      {...args}
      data={createMockData({
        images: images ?? { posters: [], backdrops: [] },
      })}
    />
  ),
};

/**
 * Hero/backdrop already selected.
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
    <TMDBHeroStep
      {...args}
      data={createMockData({
        images: images ?? { posters: [], backdrops: [] },
        backdrop: {
          value: images?.backdrops?.[0]?.file_path ?? null,
          source: "tmdb",
          skipped: false,
        } as ArtworkSelection,
      })}
    />
  ),
};

/**
 * Hero step skipped.
 */
export const Skipped: Story = {
  args: {
    data: createMockData({
      backdrop: {
        value: null,
        source: null,
        skipped: true,
      },
    }),
  },
};

/**
 * No backdrops available from TMDB.
 */
export const NoBackdrops: Story = {
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
    error: "Failed to load hero images. Please try again.",
  },
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
    <TMDBHeroStep
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
