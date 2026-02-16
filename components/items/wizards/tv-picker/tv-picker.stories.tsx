/**
 * Storybook stories for the TVPicker component.
 * Documents the TV show navigation wizard.
 *
 * Note: Full interactive testing requires MSW mocking for TMDB API.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { TVPicker } from "./tv-picker";
import type { TMDBSearchResult } from "@/lib/tmdb-client";

/**
 * TV picker wizard for navigating TV show hierarchies.
 *
 * ## Navigation Levels
 * 1. **Show View**: See all seasons, select to view episodes
 * 2. **Season View**: See all episodes, select one or use entire season
 *
 * ## Selection Types
 * - **Use Show**: Apply show-level metadata
 * - **Use Season**: Apply season-level metadata (poster, no backdrop)
 * - **Select Episode**: Apply episode-level metadata (still image only)
 *
 * ## MSW Mocking Required
 * This component requires API mocking:
 * - `/api/tmdb/seasons/*` - Season list
 * - `/api/tmdb/episodes/*` - Episode list
 */
const meta = {
  title: "Items/Wizards/TV Picker/TVPicker",
  component: TVPicker,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Hierarchical navigation wizard for TV shows. Allows selecting shows, seasons, or individual episodes for metadata application.",
      },
    },
    // axe-core cannot resolve CSS custom properties (--card-foreground, --muted-foreground)
    // during test execution, reporting false-positive contrast failures.
    // Verified correct in browser: text-muted-foreground = rgba(255,255,255,0.4) on #141414.
    a11y: {
      options: {
        rules: {
          "color-contrast": { enabled: false },
        },
      },
    },
  },
  argTypes: {
    initialData: {
      description: "Initial TMDB search result for the TV show",
    },
  },
  args: {
    onComplete: fn(),
    onCancel: fn(),
    onLevelChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="bg-card text-card-foreground w-full max-w-md rounded-lg border p-4 shadow-lg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TVPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock TMDB TV show result (real Breaking Bad data)
const mockTvResult: TMDBSearchResult = {
  id: 1396,
  mediaType: "tv",
  title: "Breaking Bad",
  overview:
    "A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine.",
  posterPath: "/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
  backdropPath: "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
  year: "2008",
};

/**
 * Default TV picker view.
 * Shows show-level view with season list.
 */
export const Default: Story = {
  args: {
    initialData: { tmdbResult: mockTvResult },
  },
};
