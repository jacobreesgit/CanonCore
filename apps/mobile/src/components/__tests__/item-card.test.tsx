import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ItemCard } from "@/components/item-card";

// Mock expo-router Link — use require inside factory to avoid out-of-scope variable error
jest.mock("expo-router", () => {
  const React = require("react");
  return {
    Link: ({ children, ...props }: { children: React.ReactNode; href: string }) =>
      React.cloneElement(children as React.ReactElement, props),
  };
});

// Mock @/tw styled components — pass through to RN
jest.mock("@/tw", () => {
  const { View, Text, Pressable } = require("react-native");
  return { View, Text, Pressable };
});

// Mock @/tw/image
jest.mock("@/tw/image", () => {
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) =>
      require("react").createElement(View, { testID: "image", ...props }),
  };
});

// Mock media badges
jest.mock("@/components/media-badges", () => ({
  DurationBadge: () => null,
  ResolutionBadge: () => null,
}));

// Mock image URL helpers
jest.mock("@/lib/image-url", () => ({
  getArtworkUrl: (id: string) => `https://example.com/artwork/${id}`,
  getTmdbPosterUrl: (path: string) => `https://tmdb.example.com${path}`,
}));

const mockItem = {
  id: "item-1",
  name: "Test Movie",
  primaryFileId: null,
  tmdbPosterPath: null,
  dominantColour: "#1a1a2e",
  primaryDurationMs: null,
  primaryHeight: null,
  ownerUsername: "testuser",
};

describe("ItemCard", () => {
  it("renders the item name", () => {
    render(<ItemCard {...mockItem} />);
    expect(screen.getByText("Test Movie")).toBeTruthy();
  });

  it("renders initial letter placeholder when no artwork", () => {
    render(<ItemCard {...mockItem} />);
    expect(screen.getByText("T")).toBeTruthy();
  });

  it("calls onLongPress when long-pressed", () => {
    const onLongPress = jest.fn();
    render(<ItemCard {...mockItem} onLongPress={onLongPress} />);
    fireEvent(screen.getByText("Test Movie"), "onLongPress");
    expect(onLongPress).toHaveBeenCalled();
  });
});
