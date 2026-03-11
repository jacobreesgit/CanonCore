/**
 * Storybook stories for the SeasonView component.
 * Demonstrates episode list with listbox accessibility and keyboard navigation.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { SeasonView } from "./season-view";
import type { TMDBSeasonSummary, TMDBEpisode } from "@/lib/tmdb-client";

const mockSeason: TMDBSeasonSummary = {
  id: 3572,
  season_number: 1,
  name: "Season 1",
  overview:
    "Mild-mannered high school chemistry teacher Walter White thinks his life can't get much worse. His salary barely makes ends meet, a situation not made better by the recent news that he has terminal lung cancer.",
  poster_path: "/1BP4xYv9ZG4ZVHkL7ocOziBbSYH.jpg",
  episode_count: 7,
  air_date: "2008-01-20",
};

const mockEpisodes: TMDBEpisode[] = [
  {
    id: 62085,
    episode_number: 1,
    name: "Pilot",
    overview:
      "When an unassuming high school chemistry teacher discovers he has a rare form of lung cancer, he decides to team up with a former student and create a top of the line crystal meth in a used RV.",
    still_path: "/88Z0fMP8a88EpQWMCs1593G0ngu.jpg",
  },
  {
    id: 62086,
    episode_number: 2,
    name: "Cat's in the Bag...",
    overview:
      "Walt and Jesse attempt to tie up loose ends. The desperate situation gets more complicated with the flip of a coin.",
    still_path: "/AbMoecO0ZZio0LcgeLxlzdyGs6X.jpg",
  },
  {
    id: 62087,
    episode_number: 3,
    name: "...And the Bag's in the River",
    overview:
      "Walter fights with Jesse over his drug use, causing him to leave Walter alone with their captive, Krazy-8.",
    still_path: "/2kBeBlxGqBOdWlKwzAxiwkfU5on.jpg",
  },
  {
    id: 62088,
    episode_number: 4,
    name: "Cancer Man",
    overview:
      "Walter finally tells his family that he has been stricken with cancer. Meanwhile, the DEA believes Albuquerque has a new, big time player.",
    still_path: "/2UbRgW6apE4XPzhHPA726wUFyaR.jpg",
  },
  {
    id: 62089,
    episode_number: 5,
    name: "Gray Matter",
    overview:
      "Walter and Skyler attend a former colleague's party. Jesse tries to free himself from the drugs, while Skyler organizes an intervention.",
    still_path: "/82G3wZgEvZLKcte6yoZJahUWBtx.jpg",
  },
  {
    id: 62090,
    episode_number: 6,
    name: "Crazy Handful of Nothin'",
    overview:
      "The side effects of chemo begin to plague Walt. Meanwhile, the DEA rounds up suspected dealers.",
    still_path: "/rCCLuycNPL30W3BtuB8HafxEMYz.jpg",
  },
  {
    id: 62091,
    episode_number: 7,
    name: "A No Rough Stuff Type Deal",
    overview:
      "Walter accepts his new identity as a drug dealer after a PTA meeting. Elsewhere, Jesse decides to put his aunt's house on the market.",
    still_path: "/1dgFAsajUpUT7DLXgAxHb9GyXHH.jpg",
  },
];

const meta = {
  title: "Items/Wizards/TV Picker/SeasonView",
  component: SeasonView,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Season view with episode list implementing listbox accessibility pattern for keyboard navigation.",
      },
    },
  },
  argTypes: {
    selectedSeason: { control: "object" },
    isLoading: { control: "boolean" },
    error: { control: "text" },
    data: { control: "object" },
  },
  args: {
    onEpisodeSelect: fn(),
  },
} satisfies Meta<typeof SeasonView>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Default: Story = {
  args: {
    selectedSeason: mockSeason,
    data: { episodes: mockEpisodes },
    isLoading: false,
    error: null,
  },
};

export const Loading: Story = {
  args: {
    selectedSeason: mockSeason,
    data: { episodes: [] },
    isLoading: true,
    error: null,
  },
};

export const WithError: Story = {
  args: {
    selectedSeason: mockSeason,
    data: { episodes: [] },
    isLoading: false,
    error: "Failed to load episodes. Please try again.",
  },
};

export const Empty: Story = {
  args: {
    selectedSeason: {
      ...mockSeason,
      episode_count: 0,
    },
    data: { episodes: [] },
    isLoading: false,
    error: null,
  },
};

// === DATA VARIANTS ===

export const SingleEpisode: Story = {
  args: {
    selectedSeason: {
      ...mockSeason,
      episode_count: 1,
    },
    data: { episodes: [mockEpisodes[0]] },
    isLoading: false,
    error: null,
  },
};

export const NoSeasonPoster: Story = {
  args: {
    selectedSeason: {
      ...mockSeason,
      poster_path: null,
    },
    data: { episodes: mockEpisodes },
    isLoading: false,
    error: null,
  },
};

export const NoSeasonOverview: Story = {
  args: {
    selectedSeason: {
      ...mockSeason,
      overview: "",
    },
    data: { episodes: mockEpisodes },
    isLoading: false,
    error: null,
  },
};

export const MissingEpisodeImages: Story = {
  args: {
    selectedSeason: mockSeason,
    data: {
      episodes: mockEpisodes.map((ep) => ({
        ...ep,
        still_path: null,
      })),
    },
    isLoading: false,
    error: null,
  },
};

export const LongEpisodeNames: Story = {
  args: {
    selectedSeason: mockSeason,
    data: {
      episodes: [
        {
          id: 1,
          episode_number: 1,
          name: "The One Where Everything Changes Forever and Nothing Is Ever the Same Again",
          overview:
            "A very long episode description that goes on and on with many details about the plot and characters.",
          still_path: "/placeholder.jpg",
        },
        {
          id: 2,
          episode_number: 2,
          name: "Part Two: The Continuing Story of What Happened Next",
          overview: undefined,
          still_path: null,
        },
      ],
    },
    isLoading: false,
    error: null,
  },
};
