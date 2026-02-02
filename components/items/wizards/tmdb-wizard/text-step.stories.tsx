/**
 * Stories for TMDBTextStep component.
 * Text selection step with title/description checkboxes and preview.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { TMDBTextStep } from "./text-step";
import type { TMDBWizardData } from "./tmdb-wizard-types";

/**
 * Creates mock wizard data for text step stories.
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
    ...overrides,
  };
}

const mockCurrentValues = {
  name: "My Movie",
  description: "My description",
};

const meta = {
  title: "Items/Wizards/TMDB/TextStep",
  component: TMDBTextStep,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Text selection step for the TMDB wizard with checkboxes for title and description updates.",
      },
    },
  },
  argTypes: {
    data: { control: false },
    currentValues: { control: false },
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
  },
  decorators: [
    (Story) => (
      <div className="bg-background w-[500px] rounded-lg border p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TMDBTextStep>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default text step with both options enabled.
 */
export const Default: Story = {
  args: {
    data: createMockData(),
  },
};

/**
 * Only updating name (description unchecked).
 */
export const OnlyName: Story = {
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
 * Only updating description (name unchecked).
 */
export const OnlyDescription: Story = {
  args: {
    data: createMockData({
      textOptions: {
        updateName: false,
        updateDescription: true,
      },
    }),
  },
};

/**
 * Both options unchecked.
 */
export const NothingSelected: Story = {
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
 * Error state with message.
 */
export const WithError: Story = {
  args: {
    data: createMockData(),
    error: "Failed to load metadata preview. Please try again.",
  },
};

/**
 * Without back navigation (first step).
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

/**
 * Long description text.
 */
export const LongDescription: Story = {
  args: {
    data: createMockData({
      preview: {
        name: "The Lord of the Rings: The Return of the King",
        description:
          "Gandalf and Aragorn lead the World of Men against Sauron's army to draw his gaze from Frodo and Sam as they approach Mount Doom with the One Ring. As Gandalf leads the last defense against Sauron's armies, Frodo and Sam approach Mount Doom to destroy the One Ring. The battle for Middle-earth has begun.",
      },
    }),
  },
};
