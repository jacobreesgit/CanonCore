/**
 * Stories for TMDBPosterStep component.
 * Poster selection step with TMDB images grid and skip option.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { TMDBPosterStep } from "./poster-step";
import type { TMDBWizardData, ArtworkSelection } from "./tmdb-wizard-types";
import type { TMDBImages } from "@/lib/tmdb-client";

/**
 * Mock TMDB poster images (real Inception posters from TMDB API).
 */
const mockPosters: TMDBImages["posters"] = [
  {
    file_path: "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
    vote_average: 8.0,
    iso_639_1: "mk",
    width: 2000,
    height: 3000,
  },
  {
    file_path: "/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg",
    vote_average: 7.5,
    iso_639_1: "en",
    width: 2000,
    height: 3000,
  },
  {
    file_path: "/ljsZTbVsrQSqZgWeep2B1QiDKuh.jpg",
    vote_average: 7.0,
    iso_639_1: "en",
    width: 1000,
    height: 1500,
  },
  {
    file_path: "/tXQvtRWfkUUnWJAn2tN3jERIUG.jpg",
    vote_average: 8.3,
    iso_639_1: "es",
    width: 2000,
    height: 3000,
  },
];

/**
 * Creates mock wizard data for poster step stories.
 */
function createMockData(
  overrides: Partial<TMDBWizardData> = {}
): Partial<TMDBWizardData> {
  return {
    contentType: "movie",
    images: {
      posters: mockPosters,
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

const meta = {
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
} satisfies Meta<typeof TMDBPosterStep>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default poster selection step with available images.
 */
export const Default: Story = {
  args: {
    data: createMockData(),
  },
};

/**
 * Poster already selected.
 */
export const WithSelection: Story = {
  args: {
    data: createMockData({
      poster: {
        value: "/9gk7adHYeDvHkCSEqAvQNLV5Ber.jpg",
        source: "tmdb",
        skipped: false,
      } as ArtworkSelection,
    }),
  },
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
  args: {
    data: createMockData({
      contentType: "season",
      images: null,
      seasonImages: {
        posters: mockPosters.slice(0, 2),
      },
    }),
  },
};

/**
 * Upload mode enabled (AddItemDialog).
 * Shows tabs with TMDB images and My Uploads dropzone.
 */
export const UploadMode: Story = {
  args: {
    data: createMockData(),
    uploadMode: true,
    hasDriveConnection: true,
    queuedFiles: [],
    onFilesQueue: fn(),
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
