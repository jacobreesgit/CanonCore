/**
 * Storybook stories for the WizardStepIndicator component.
 * Covers different step counts, states, and label lengths.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { WizardStepIndicator } from "./wizard-step-indicator";

const meta = {
  title: "Utilities/WizardStepIndicator",
  component: WizardStepIndicator,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Visual step indicator for multi-step wizards. Shows completed, current, and upcoming steps with accessible labels.",
      },
    },
  },
  argTypes: {
    steps: {
      description: "Array of step identifiers in order",
      table: { category: "Content" },
    },
    currentStep: {
      description: "Currently active step identifier",
      table: { category: "State" },
    },
    stepLabels: {
      description: "Human-readable labels for each step",
      table: { category: "Content" },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[500px] overflow-visible p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    steps: ["text", "poster", "hero", "summary"] as const,
    currentStep: "text",
    stepLabels: {
      text: "Title & Description",
      poster: "Poster",
      hero: "Hero Image",
      summary: "Review",
    },
  },
} satisfies Meta<typeof WizardStepIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * First step active in a 4-step wizard.
 */
export const FirstStep: Story = {
  args: {
    steps: ["text", "poster", "hero", "summary"] as const,
    currentStep: "text",
    stepLabels: {
      text: "Title & Description",
      poster: "Poster",
      hero: "Hero Image",
      summary: "Review",
    },
  },
};

/**
 * Middle step active showing completed and upcoming states.
 */
export const MiddleStep: Story = {
  args: {
    steps: ["text", "poster", "hero", "summary"] as const,
    currentStep: "poster",
    stepLabels: {
      text: "Title & Description",
      poster: "Poster",
      hero: "Hero Image",
      summary: "Review",
    },
  },
};

/**
 * Last step active with all previous steps completed.
 */
export const LastStep: Story = {
  args: {
    steps: ["text", "poster", "hero", "summary"] as const,
    currentStep: "summary",
    stepLabels: {
      text: "Title & Description",
      poster: "Poster",
      hero: "Hero Image",
      summary: "Review",
    },
  },
};

/**
 * Three-step wizard for simpler flows.
 */
export const ThreeSteps: Story = {
  args: {
    steps: ["select", "configure", "confirm"] as const,
    currentStep: "configure",
    stepLabels: {
      select: "Select",
      configure: "Configure",
      confirm: "Confirm",
    },
  },
};

/**
 * Five-step wizard for complex flows.
 */
export const FiveSteps: Story = {
  decorators: [
    (Story) => (
      <div className="w-[600px] overflow-visible p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    steps: ["info", "media", "metadata", "review", "publish"] as const,
    currentStep: "metadata",
    stepLabels: {
      info: "Basic Info",
      media: "Media",
      metadata: "Metadata",
      review: "Review",
      publish: "Publish",
    },
  },
};

/**
 * All steps completed (wizard finished).
 */
export const AllCompleted: Story = {
  args: {
    steps: ["text", "poster", "hero", "summary"] as const,
    currentStep: "summary",
    stepLabels: {
      text: "Title & Description",
      poster: "Poster",
      hero: "Hero Image",
      summary: "Review",
    },
  },
};
