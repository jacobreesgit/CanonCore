/**
 * Stories for GridItem component.
 * Movie poster card with artwork, progress, and drag support.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { GridItem } from "./grid-item";

const meta = {
  title: "Layout/GridItem",
  component: GridItem,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Grid item card with full background artwork, dark overlay, progress tracking, and drag support.",
      },
    },
  },
  argTypes: {
    id: { control: "text" },
    name: { control: "text" },
    description: { control: "text" },
    tmdbPosterPath: { control: "text" },
    artworkId: { control: "text" },
    showArtwork: { control: "boolean" },
    showDescription: { control: "boolean" },
    progressPercentage: { control: { type: "number", min: 0, max: 100 } },
    watchedCount: { control: "number" },
    totalMediaCount: { control: "number" },
    totalItems: { control: "number" },
    isSelected: { control: "boolean" },
    isDragging: { control: "boolean" },
    isOverlay: { control: "boolean" },
    priority: { control: "boolean" },
    syncStatus: {
      control: "select",
      options: ["SYNCED", "PENDING", "SYNCING", "ERROR"],
    },
    ownerLabel: { control: "text" },
    ownerHref: { control: "text" },
  },
  args: {
    id: "item-1",
    name: "Inception",
    description:
      "A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
    tmdbPosterPath: "/ljsZTbVsrQSqZgWeep2B1QiDKuh.jpg",
    onClick: fn(),
    onSelectChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[280px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GridItem>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default grid item with TMDB poster.
 * Uses TMDB CDN image URL.
 */
export const Default: Story = {
  args: {
    progressPercentage: 45,
    watchedCount: 3,
    totalMediaCount: 7,
    totalItems: 10,
  },
};

/**
 * Grid item without artwork (folder placeholder).
 */
export const NoArtwork: Story = {
  args: {
    name: "My Collection",
    description: "A collection of favourite films",
    artworkId: null,
    showArtwork: false,
    progressPercentage: 25,
    watchedCount: 2,
    totalMediaCount: 8,
    totalItems: 12,
  },
};

/**
 * Grid item in edit mode with drag handle and checkbox.
 */
export const EditMode: Story = {
  args: {
    handleProps: {},
    isSelected: false,
  },
};

/**
 * Selected item in edit mode.
 */
export const Selected: Story = {
  args: {
    handleProps: {},
    isSelected: true,
  },
};

/**
 * Item with owner attribution (public profile).
 */
export const WithOwner: Story = {
  args: {
    name: "The Dark Knight",
    description: "Batman raises the stakes in his war on crime.",
    tmdbPosterPath: "/qJ2tW6WMUDux911BTUgME76Nccf.jpg",
    ownerLabel: "@filmfan",
    ownerHref: "/u/filmfan",
    ownerUserId: "user-123",
    ownerName: "Film Fan",
    progressPercentage: 80,
    watchedCount: 8,
    totalMediaCount: 10,
    totalItems: 15,
  },
};

/**
 * Item owned by current user.
 */
export const OwnedByYou: Story = {
  args: {
    name: "Interstellar",
    description: "A team of explorers travel through a wormhole in space.",
    tmdbPosterPath: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    ownerLabel: "You",
    progressPercentage: 60,
    watchedCount: 6,
    totalMediaCount: 10,
    totalItems: 10,
  },
};

/**
 * Fully watched item (100% progress).
 */
export const FullyWatched: Story = {
  args: {
    name: "The Godfather",
    description:
      "The aging patriarch of an organized crime dynasty transfers control to his reluctant son.",
    progressPercentage: 100,
    watchedCount: 5,
    totalMediaCount: 5,
    totalItems: 5,
  },
};

/**
 * Item with no progress yet.
 */
export const NotStarted: Story = {
  args: {
    name: "The Matrix",
    description: "A computer hacker learns about the true nature of reality.",
    tmdbPosterPath: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    progressPercentage: 0,
    watchedCount: 0,
    totalMediaCount: 5,
    totalItems: 8,
  },
};

/**
 * Item with sync pending status.
 */
export const SyncPending: Story = {
  args: {
    name: "Breaking Bad",
    description:
      "A chemistry teacher diagnosed with terminal lung cancer turns to manufacturing methamphetamine.",
    tmdbPosterPath: "/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
    syncStatus: "PENDING",
    progressPercentage: 50,
    watchedCount: 2,
    totalMediaCount: 4,
    totalItems: 6,
  },
};

/**
 * Item with sync error status.
 */
export const SyncError: Story = {
  args: {
    tmdbPosterPath: "/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
    name: "Pulp Fiction",
    description:
      "The lives of two mob hitmen, a boxer, a gangster and his wife intertwine.",
    syncStatus: "ERROR",
  },
};

/**
 * Dragging state (reduced opacity).
 */
export const Dragging: Story = {
  args: {
    isDragging: true,
    handleProps: {},
  },
};

/**
 * Drag overlay state (elevated, scaled up).
 */
export const DragOverlay: Story = {
  args: {
    isOverlay: true,
    handleProps: {},
  },
};

/**
 * Long title that should truncate.
 */
export const LongTitle: Story = {
  args: {
    name: "The Lord of the Rings: The Return of the King Extended Edition",
    description:
      "Gandalf and Aragorn lead the World of Men against Sauron's army to draw his gaze from Frodo and Sam as they approach Mount Doom with the One Ring.",
    tmdbPosterPath: "/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg",
    progressPercentage: 33,
    watchedCount: 1,
    totalMediaCount: 3,
    totalItems: 3,
  },
};

/**
 * Item with no description (short card).
 */
export const NoDescription: Story = {
  args: {
    name: "Quick Item",
    description: null,
    showDescription: false,
    progressPercentage: 75,
    watchedCount: 3,
    totalMediaCount: 4,
    totalItems: 4,
  },
};
