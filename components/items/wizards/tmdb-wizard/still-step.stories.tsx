/**
 * Stories for TMDBStillStep component.
 * Fetches real TMDB episode stills via Storybook loaders.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { TMDBStillStep } from "./still-step";
import type { TMDBWizardData, ArtworkSelection } from "./tmdb-wizard-types";
import { fetchEpisodeStills } from "../../../../.storybook/lib/tmdb";

/**
 * Creates mock wizard data for still step stories.
 */
function createMockData(
  overrides: Partial<TMDBWizardData> = {}
): Partial<TMDBWizardData> {
  return {
    contentType: "episode",
    episodeImages: {
      stills: [],
    },
    still: {
      value: null,
      source: null,
      skipped: false,
    },
    ...overrides,
  };
}

const mockCurrentValues = {
  name: "Pilot",
  description: "The first episode of the series.",
};

const meta: Meta<typeof TMDBStillStep> = {
  title: "Items/Wizards/TMDB/StillStep",
  component: TMDBStillStep,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Episode still image selection step displaying TMDB stills in a 16:9 aspect ratio grid.",
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
 * Breaking Bad S01E01 — episode stills from TMDB.
 */
export const Default: Story = {
  args: { data: createMockData() },
  loaders: [
    async () => {
      const episodeImages = await fetchEpisodeStills(1396, 1, 1);
      return { episodeImages };
    },
  ],
  render: (args, { loaded: { episodeImages } }) => (
    <TMDBStillStep
      {...args}
      data={createMockData({ episodeImages: episodeImages ?? { stills: [] } })}
    />
  ),
};

/**
 * Game of Thrones S01E01 — episode stills from TMDB.
 */
export const GameOfThrones: Story = {
  args: { data: createMockData() },
  loaders: [
    async () => {
      const episodeImages = await fetchEpisodeStills(1399, 1, 1);
      return { episodeImages };
    },
  ],
  render: (args, { loaded: { episodeImages } }) => (
    <TMDBStillStep
      {...args}
      data={createMockData({ episodeImages: episodeImages ?? { stills: [] } })}
    />
  ),
};

/**
 * Still image already selected.
 */
export const WithSelection: Story = {
  args: { data: createMockData() },
  loaders: [
    async () => {
      const episodeImages = await fetchEpisodeStills(1396, 1, 1);
      return { episodeImages };
    },
  ],
  render: (args, { loaded: { episodeImages } }) => (
    <TMDBStillStep
      {...args}
      data={createMockData({
        episodeImages: episodeImages ?? { stills: [] },
        still: {
          value: episodeImages?.stills?.[0]?.file_path ?? null,
          source: "tmdb",
          skipped: false,
        } as ArtworkSelection,
      })}
    />
  ),
};

/**
 * Still step skipped.
 */
export const Skipped: Story = {
  args: {
    data: createMockData({
      still: {
        value: null,
        source: null,
        skipped: true,
      },
    }),
  },
};

/**
 * No stills available from TMDB.
 */
export const NoStills: Story = {
  args: {
    data: createMockData({
      episodeImages: {
        stills: [],
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
    error: "Failed to load still images. Please try again.",
  },
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
