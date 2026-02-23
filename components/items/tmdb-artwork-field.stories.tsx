/**
 * Storybook stories for the TmdbArtworkField component.
 * Demonstrates artwork display, change trigger, clear action, and note slot.
 * Mirrors FileTypeCombobox story structure for consistency.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import {
  faImage,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";

import { Badge } from "@/components/ui/badge";
import { TmdbArtworkField } from "./tmdb-artwork-field";

const meta: Meta<typeof TmdbArtworkField> = {
  title: "Items/TMDB/TmdbArtworkField",
  component: TmdbArtworkField,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "TMDB artwork field with thumbnail preview, change trigger, and clear action. Mirrors FileTypeCombobox DOM structure for visual consistency across the Files and TMDB tabs.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[400px] p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TmdbArtworkField>;

// === WITH IMAGE VARIANTS ===

export const PosterWithImage: Story = {
  render: () => (
    <TmdbArtworkField
      label="Poster"
      description="The poster image from TMDB used as the thumbnail."
      icon={faImage}
      imagePath="/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg"
      imageUrl="https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg"
      onChange={fn()}
      onClear={fn()}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Poster field with a TMDB image set. Shows thumbnail and path in the trigger.",
      },
    },
  },
};

export const BackdropWithImage: Story = {
  render: () => (
    <TmdbArtworkField
      label="Backdrop"
      description="The backdrop image from TMDB used as the banner background."
      icon={faWandMagicSparkles}
      imagePath="/s3TBrRGB1iav7gFOCNx3H31MoES.jpg"
      imageUrl="https://image.tmdb.org/t/p/w780/s3TBrRGB1iav7gFOCNx3H31MoES.jpg"
      onChange={fn()}
      onClear={fn()}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "Backdrop field with a TMDB image set.",
      },
    },
  },
};

// === EMPTY VARIANTS ===

export const EmptyPoster: Story = {
  render: () => (
    <TmdbArtworkField
      label="Poster"
      description="The poster image from TMDB used as the thumbnail."
      icon={faImage}
      imagePath={null}
      imageUrl={null}
      onChange={fn()}
      onClear={fn()}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'No poster set. Trigger shows placeholder text "Change poster..." and Clear button is hidden.',
      },
    },
  },
};

export const EmptyBackdrop: Story = {
  render: () => (
    <TmdbArtworkField
      label="Backdrop"
      description="The backdrop image from TMDB used as the banner background."
      icon={faWandMagicSparkles}
      imagePath={null}
      imageUrl={null}
      onChange={fn()}
      onClear={fn()}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "No backdrop set. Shows empty state.",
      },
    },
  },
};

// === STATE VARIANTS ===

export const Loading: Story = {
  render: () => (
    <TmdbArtworkField
      label="Poster"
      description="The poster image from TMDB used as the thumbnail."
      icon={faImage}
      imagePath="/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg"
      imageUrl="https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg"
      onChange={fn()}
      onClear={fn()}
      isLoading
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "Loading state. All buttons are disabled.",
      },
    },
  },
};

export const WithOverrideNote: Story = {
  render: () => (
    <TmdbArtworkField
      label="Poster"
      description="The poster image from TMDB used as the thumbnail."
      icon={faImage}
      imagePath="/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg"
      imageUrl="https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg"
      onChange={fn()}
      onClear={fn()}
      note={<Badge variant="destructive">Overridden by uploaded artwork</Badge>}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Shows a destructive badge when uploaded artwork overrides this TMDB image.",
      },
    },
  },
};

export const EmptyWithOverrideNote: Story = {
  render: () => (
    <TmdbArtworkField
      label="Poster"
      description="The poster image from TMDB used as the thumbnail."
      icon={faImage}
      imagePath={null}
      imageUrl={null}
      onChange={fn()}
      onClear={fn()}
      note={<Badge variant="destructive">Overridden by uploaded artwork</Badge>}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "Empty state with override note.",
      },
    },
  },
};
