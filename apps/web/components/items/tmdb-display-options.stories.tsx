/**
 * Stories for TmdbDisplayOptionsEditor component.
 * Checkbox toggles for controlling which TMDB sections appear on item detail pages.
 */

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { TmdbDisplayOptionsEditor } from "./tmdb-display-options";
import { DEFAULT_TMDB_DISPLAY, type TmdbDisplayOptions } from "@/lib/types";

/** Stateful wrapper so checkboxes are interactive in Storybook. */
function Wrapper({ initialOptions }: { initialOptions: TmdbDisplayOptions }) {
  const [options, setOptions] = useState(initialOptions);
  return (
    <TmdbDisplayOptionsEditor displayOptions={options} onChange={setOptions} />
  );
}

const meta = {
  title: "Items/TMDB/TmdbDisplayOptionsEditor",
  component: Wrapper,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Checkbox grid for toggling which TMDB data sections appear on an item's detail page. Used in the TMDB wizard summary step and the Item Settings dialog TMDB tab.",
      },
    },
  },
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllEnabled: Story = {
  args: {
    initialOptions: { ...DEFAULT_TMDB_DISPLAY },
  },
  parameters: {
    docs: {
      description: {
        story: "Default state with all display options enabled.",
      },
    },
  },
};

export const SomeDisabled: Story = {
  args: {
    initialOptions: {
      ...DEFAULT_TMDB_DISPLAY,
      showCast: false,
      showVideos: false,
      showRecommendations: false,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Some sections disabled — Cast, Videos, and More Like This are hidden.",
      },
    },
  },
};

export const AllDisabled: Story = {
  args: {
    initialOptions: {
      showTagline: false,
      showMetadata: false,
      showGenres: false,
      showCast: false,
      showProviders: false,
      showVideos: false,
      showRecommendations: false,
    },
  },
  parameters: {
    docs: {
      description: {
        story: "All display options disabled.",
      },
    },
  },
};
