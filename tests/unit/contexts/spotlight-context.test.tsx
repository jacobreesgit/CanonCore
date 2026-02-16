/**
 * Unit tests for SpotlightContext.
 * Tests dialog state management and keyboard shortcut handling.
 */

import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import {
  SpotlightProvider,
  useSpotlight,
  useSpotlightOptional,
} from "@/contexts/spotlight-context";

// Test component to access context
function TestConsumer() {
  const { isOpen, openSpotlight, closeSpotlight } = useSpotlight();
  return (
    <div>
      <span>{isOpen ? "spotlight-open" : "spotlight-closed"}</span>
      <button onClick={openSpotlight}>Open</button>
      <button onClick={closeSpotlight}>Close</button>
    </div>
  );
}

describe("SpotlightContext", () => {
  describe("useSpotlight", () => {
    it("throws when used outside provider", () => {
      // Suppress console.error for this test
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow("useSpotlight must be used within SpotlightProvider");

      consoleSpy.mockRestore();
    });

    it("provides initial closed state", () => {
      render(
        <SpotlightProvider>
          <TestConsumer />
        </SpotlightProvider>
      );

      expect(screen.getByText("spotlight-closed")).toBeInTheDocument();
    });

    it("opens spotlight via openSpotlight", async () => {
      const user = userEvent.setup();
      render(
        <SpotlightProvider>
          <TestConsumer />
        </SpotlightProvider>
      );

      await user.click(screen.getByRole("button", { name: "Open" }));
      expect(screen.getByText("spotlight-open")).toBeInTheDocument();
    });

    it("closes spotlight via closeSpotlight", async () => {
      const user = userEvent.setup();
      render(
        <SpotlightProvider>
          <TestConsumer />
        </SpotlightProvider>
      );

      await user.click(screen.getByRole("button", { name: "Open" }));
      await user.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.getByText("spotlight-closed")).toBeInTheDocument();
    });
  });

  describe("useSpotlightOptional", () => {
    function OptionalConsumer() {
      const context = useSpotlightOptional();
      return <span>{context ? "context-yes" : "context-no"}</span>;
    }

    it("returns null outside provider", () => {
      render(<OptionalConsumer />);
      expect(screen.getByText("context-no")).toBeInTheDocument();
    });

    it("returns context inside provider", () => {
      render(
        <SpotlightProvider>
          <OptionalConsumer />
        </SpotlightProvider>
      );
      expect(screen.getByText("context-yes")).toBeInTheDocument();
    });
  });

  describe("keyboard shortcuts", () => {
    it("opens spotlight on / key press", async () => {
      render(
        <SpotlightProvider>
          <TestConsumer />
        </SpotlightProvider>
      );

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "/" }));
      });

      expect(screen.getByText("spotlight-open")).toBeInTheDocument();
    });

    it("does not open spotlight when typing in input", async () => {
      render(
        <SpotlightProvider>
          <TestConsumer />
          <input aria-label="text input" />
        </SpotlightProvider>
      );

      const input = screen.getByRole("textbox", { name: "text input" });
      input.focus();

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "/" }));
      });

      // Should remain closed when focus is in an input
      expect(screen.getByText("spotlight-closed")).toBeInTheDocument();
    });

    it("toggles spotlight when already open", async () => {
      render(
        <SpotlightProvider>
          <TestConsumer />
        </SpotlightProvider>
      );

      // Open
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "/" }));
      });
      expect(screen.getByText("spotlight-open")).toBeInTheDocument();

      // Toggle closed
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "/" }));
      });
      expect(screen.getByText("spotlight-closed")).toBeInTheDocument();
    });
  });
});
