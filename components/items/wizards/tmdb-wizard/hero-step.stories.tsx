/**
 * Stories for TMDBHeroStep component.
 * Hero/backdrop selection step with 16:9 aspect ratio images.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { TMDBHeroStep } from "./hero-step";
import type { TMDBWizardData, ArtworkSelection } from "./tmdb-wizard-types";
import type { TMDBImages } from "@/lib/tmdb-client";

/**
 * Mock TMDB backdrop images.
 */
const mockBackdrops: TMDBImages["backdrops"] = [
  {
    file_path: "/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg",
    vote_average: 9.2,
    iso_639_1: null,
    width: 3840,
    height: 2160,
  },
  {
    file_path: "/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
    vote_average: 8.5,
    iso_639_1: null,
    width: 1920,
    height: 1080,
  },
  {
    file_path: "/ii8QGacT3MXESqBckQlyrATY0lT.jpg",
    vote_average: 7.8,
    iso_639_1: "en",
    width: 1920,
    height: 1080,
  },
  {
    file_path: "/xJHokMbljvjADYdit5fK5VQsXEG.jpg",
    vote_average: 7.2,
    iso_639_1: null,
    width: 1920,
    height: 1080,
  },
];

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
      backdrops: mockBackdrops,
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

const meta = {
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
} satisfies Meta<typeof TMDBHeroStep>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default hero selection step with available backdrops.
 */
export const Default: Story = {
  args: {
    data: createMockData(),
  },
};

/**
 * Hero/backdrop already selected.
 */
export const WithSelection: Story = {
  args: {
    data: createMockData({
      backdrop: {
        value: "/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg",
        source: "tmdb",
        skipped: false,
      } as ArtworkSelection,
    }),
  },
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
