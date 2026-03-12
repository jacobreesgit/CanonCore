/**
 * Stories for ShowView component.
 * Initial TV picker level showing show info and season grid.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { ShowView } from "./show-view";
import type { TMDBSearchResult, TMDBSeasonSummary } from "@/lib/tmdb-client";
import type { TVPickerData } from "./tv-picker-types";

/**
 * Mock TMDB search result for a TV show.
 */
const mockTmdbResult: TMDBSearchResult = {
  id: 1396,
  mediaType: "tv",
  title: "Breaking Bad",
  overview:
    "A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine with a former student to secure his family's future.",
  posterPath: "/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
  backdropPath: "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
  year: "2008",
};

/**
 * Mock seasons for the TV show.
 */
const mockSeasons: TMDBSeasonSummary[] = [
  {
    id: 3572,
    season_number: 1,
    name: "Season 1",
    overview:
      "High school chemistry teacher Walter White's life is suddenly transformed by a dire medical diagnosis.",
    poster_path: "/1BP4xYv9ZG4ZVHkL7ocOziBbSYH.jpg",
    episode_count: 7,
    air_date: "2008-01-20",
  },
  {
    id: 3573,
    season_number: 2,
    name: "Season 2",
    overview:
      "Walt and Jesse realise how dire their situation has become as the consequences of their actions catch up with them.",
    poster_path: "/e3oGYpoTUhOFK0BJfloru5ZmGV.jpg",
    episode_count: 13,
    air_date: "2009-03-08",
  },
  {
    id: 3574,
    season_number: 3,
    name: "Season 3",
    overview:
      "Walt continues to spiral out of control as his actions have deadly consequences for those around him.",
    poster_path: "/ffP8Q8ew048YofHRnFVM18B2fPG.jpg",
    episode_count: 13,
    air_date: "2010-03-21",
  },
  {
    id: 3575,
    season_number: 4,
    name: "Season 4",
    overview:
      "As Walt and Jesse get closer to their breaking point, Gus takes things to a whole new level.",
    poster_path: "/5ewrnKp4TboU4hTLT5cWO350mHj.jpg",
    episode_count: 13,
    air_date: "2011-07-17",
  },
  {
    id: 3576,
    season_number: 5,
    name: "Season 5",
    overview:
      "Walt is faced with the consequences of his actions as everything comes to a head in the series finale.",
    poster_path: "/r3z70vunihrAkjILQKWHX0G2xzO.jpg",
    episode_count: 16,
    air_date: "2012-07-15",
  },
];

/**
 * Creates mock picker data for stories.
 */
function createMockData(
  overrides: Partial<TVPickerData> = {}
): Partial<TVPickerData> {
  return {
    tmdbResult: mockTmdbResult,
    seasons: mockSeasons,
    selectedSeason: null,
    episodes: [],
    previouslyFocusedSeasonIndex: null,
    ...overrides,
  };
}

const meta = {
  title: "Items/Wizards/TV Picker/ShowView",
  component: ShowView,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Show view displaying TV show info with a scrollable grid of seasons. Implements roving tabindex keyboard navigation.",
      },
    },
  },
  argTypes: {
    data: {
      description: "Current picker data containing seasons",
      control: false,
    },
    isLoading: {
      description: "Whether seasons are loading",
      control: "boolean",
    },
    error: {
      description: "Error message if loading failed",
      control: "text",
    },
    focusedIndex: {
      description: "Currently focused season index",
      control: { type: "number", min: 0, max: 4 },
    },
    onSeasonSelect: {
      description: "Handler when a season card is selected",
      action: "seasonSelected",
    },
    onFocusChange: {
      description: "Handler when focus changes",
      action: "focusChanged",
    },
  },
  args: {
    onSeasonSelect: fn(),
    onFocusChange: fn(),
    focusedIndex: 0,
  },
  decorators: [
    (Story) => (
      <div className="bg-background w-[400px] rounded-lg border p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ShowView>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default show view with all seasons.
 */
export const Default: Story = {
  args: {
    data: createMockData(),
    isLoading: false,
    error: null,
  },
};

/**
 * Loading state while fetching seasons.
 */
export const Loading: Story = {
  args: {
    data: createMockData({ seasons: [] }),
    isLoading: true,
    error: null,
  },
};

/**
 * Error state when loading fails.
 */
export const Error: Story = {
  args: {
    data: createMockData({ seasons: [] }),
    isLoading: false,
    error: "Failed to load seasons. Please try again.",
  },
};

/**
 * Empty state when no seasons available.
 */
export const Empty: Story = {
  args: {
    data: createMockData({ seasons: [] }),
    isLoading: false,
    error: null,
  },
};

/**
 * Show with single season.
 */
export const SingleSeason: Story = {
  args: {
    data: createMockData({
      seasons: [mockSeasons[0]],
    }),
    isLoading: false,
    error: null,
  },
};

/**
 * Show without poster image.
 */
export const NoPoster: Story = {
  args: {
    data: createMockData({
      tmdbResult: {
        ...mockTmdbResult,
        posterPath: null,
      },
    }),
    isLoading: false,
    error: null,
  },
};

/**
 * Show without overview.
 */
export const NoOverview: Story = {
  args: {
    data: createMockData({
      tmdbResult: {
        ...mockTmdbResult,
        overview: "",
      },
    }),
    isLoading: false,
    error: null,
  },
};

/**
 * Focus on third season.
 */
export const FocusedOnThirdSeason: Story = {
  args: {
    data: createMockData(),
    isLoading: false,
    error: null,
    focusedIndex: 2,
  },
};
