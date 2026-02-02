/**
 * Stories for TMDBStillStep component.
 * Episode still image selection step.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { TMDBStillStep } from "./still-step";
import type { TMDBWizardData, ArtworkSelection } from "./tmdb-wizard-types";
import type { TMDBEpisodeImages } from "@/lib/tmdb-client";

/**
 * Mock TMDB episode stills (real Breaking Bad S01E01 stills from TMDB API).
 */
const mockStills: TMDBEpisodeImages["stills"] = [
  {
    file_path: "/88Z0fMP8a88EpQWMCs1593G0ngu.jpg",
    vote_average: 6.6,
    iso_639_1: null,
    width: 1920,
    height: 1080,
  },
  {
    file_path: "/ydlY3iPfeOAvu8gVqrxPoMvzNCn.jpg",
    vote_average: 6.2,
    iso_639_1: null,
    width: 1920,
    height: 1080,
  },
  {
    file_path: "/u90Ryx8OztC5OeVTXHPcZ8fnKoA.jpg",
    vote_average: 5.8,
    iso_639_1: null,
    width: 1920,
    height: 1080,
  },
  {
    file_path: "/kdvMh2q0iexchzBwnaN3o0ZpxrC.jpg",
    vote_average: 2.3,
    iso_639_1: null,
    width: 1920,
    height: 1080,
  },
];

/**
 * Creates mock wizard data for still step stories.
 */
function createMockData(
  overrides: Partial<TMDBWizardData> = {}
): Partial<TMDBWizardData> {
  return {
    contentType: "episode",
    episodeImages: {
      stills: mockStills,
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

const meta = {
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
} satisfies Meta<typeof TMDBStillStep>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default still selection step with available images.
 */
export const Default: Story = {
  args: {
    data: createMockData(),
  },
};

/**
 * Still image already selected.
 */
export const WithSelection: Story = {
  args: {
    data: createMockData({
      still: {
        value: "/1x1D36SzO7IKQCCLc4eWFBTyDJI.jpg",
        source: "tmdb",
        skipped: false,
      } as ArtworkSelection,
    }),
  },
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
