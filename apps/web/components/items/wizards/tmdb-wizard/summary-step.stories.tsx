/**
 * Stories for TMDBSummaryStep component.
 * Review step showing all selections before applying.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { TMDBSummaryStep } from "./summary-step";
import type { TMDBWizardData } from "./tmdb-wizard-types";

/**
 * Creates mock wizard data for summary step stories.
 */
function createMockData(
  overrides: Partial<TMDBWizardData> = {}
): Partial<TMDBWizardData> {
  return {
    preview: {
      name: "Inception (2010)",
      description:
        "A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
    },
    textOptions: {
      updateName: true,
      updateDescription: true,
    },
    poster: {
      value: "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg", // Real Inception poster
      source: "tmdb",
      skipped: false,
    },
    backdrop: {
      value: "/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg",
      source: "tmdb",
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
  title: "Items/Wizards/TMDB/SummaryStep",
  component: TMDBSummaryStep,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Summary/review step showing all selections with options to go back and edit.",
      },
    },
  },
  argTypes: {
    data: { control: false },
    isLoading: { control: "boolean" },
    error: { control: "text" },
    canGoBack: { control: "boolean" },
    showNavigation: { control: "boolean" },
  },
  args: {
    currentValues: mockCurrentValues,
    isLoading: false,
    error: null,
    canGoBack: true,
    showNavigation: true,
    onNext: fn(),
    onBack: fn(),
    onDataChange: fn(),
    onLoadingChange: fn(),
    onError: fn(),
    onEditStep: fn(),
    onApply: fn(),
  },
  decorators: [
    (Story) => (
      <div className="bg-background w-[500px] rounded-lg border p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TMDBSummaryStep>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default summary with all selections.
 */
export const Default: Story = {
  args: {
    data: createMockData(),
  },
};

/**
 * Summary with poster skipped.
 */
export const PosterSkipped: Story = {
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
 * Summary with hero skipped.
 */
export const HeroSkipped: Story = {
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
 * Summary with both artwork skipped.
 */
export const AllArtworkSkipped: Story = {
  args: {
    data: createMockData({
      poster: {
        value: null,
        source: null,
        skipped: true,
      },
      backdrop: {
        value: null,
        source: null,
        skipped: true,
      },
    }),
  },
};

/**
 * Summary with only name update.
 */
export const OnlyNameUpdate: Story = {
  args: {
    data: createMockData({
      textOptions: {
        updateName: true,
        updateDescription: false,
      },
    }),
  },
};

/**
 * Summary with no text updates.
 */
export const NoTextUpdates: Story = {
  args: {
    data: createMockData({
      textOptions: {
        updateName: false,
        updateDescription: false,
      },
    }),
  },
};

/**
 * Summary with no artwork selected.
 */
export const NoArtworkSelected: Story = {
  args: {
    data: createMockData({
      poster: {
        value: null,
        source: null,
        skipped: false,
      },
      backdrop: {
        value: null,
        source: null,
        skipped: false,
      },
    }),
  },
};

/**
 * Error state when apply fails.
 */
export const WithError: Story = {
  args: {
    data: createMockData(),
    error: "Failed to apply metadata. Please try again.",
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
