/**
 * Unit tests for PreferencesTab component.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PreferencesTab } from "@/components/profile/preferences-tab";

// Mock server actions
vi.mock("@/lib/user-actions", () => ({
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
}));

import { getPreferences, updatePreferences } from "@/lib/user-actions";

describe("PreferencesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPreferences).mockResolvedValue({
      success: true,
      data: { viewMode: "grid", sortBy: "custom" },
    });
    vi.mocked(updatePreferences).mockResolvedValue({ success: true });
  });

  it("renders loading state initially", () => {
    render(<PreferencesTab />);

    // During loading, View Mode label should not be visible yet
    expect(screen.queryByText("View Mode")).not.toBeInTheDocument();
  });

  it("loads and displays current preferences", async () => {
    render(<PreferencesTab />);

    await waitFor(() => {
      expect(screen.getByText("View Mode")).toBeInTheDocument();
    });

    expect(screen.getByText("Default Sort")).toBeInTheDocument();
  });

  it("displays view mode options", async () => {
    render(<PreferencesTab />);

    await waitFor(() => {
      expect(screen.getByLabelText(/grid/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/tree/i)).toBeInTheDocument();
    });
  });

  it("displays sort options dropdown", async () => {
    render(<PreferencesTab />);

    await waitFor(() => {
      expect(screen.getByText("Default Sort")).toBeInTheDocument();
    });

    // Should have a combobox or select for sort
    const sortSelect = screen.getByRole("combobox");
    expect(sortSelect).toBeInTheDocument();
  });

  it("updates view mode preference on selection", async () => {
    const user = userEvent.setup();
    render(<PreferencesTab />);

    await waitFor(() => {
      expect(screen.getByLabelText(/tree/i)).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText(/tree/i));

    await waitFor(() => {
      expect(updatePreferences).toHaveBeenCalledWith({ viewMode: "tree" });
    });
  });

  it("updates sort preference on selection", async () => {
    const user = userEvent.setup();
    render(<PreferencesTab />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    // Open select and choose a different sort option
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Name A-Z"));

    await waitFor(() => {
      expect(updatePreferences).toHaveBeenCalledWith({ sortBy: "name-asc" });
    });
  });

  it("shows error state when loading fails", async () => {
    vi.mocked(getPreferences).mockResolvedValue({
      success: false,
      error: "Something went wrong",
    });

    render(<PreferencesTab />);

    await waitFor(() => {
      // Check for the main error heading
      expect(
        screen.getByText("Failed to load preferences")
      ).toBeInTheDocument();
      // Check for the specific error message
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });

  it("shows current selection based on loaded preferences", async () => {
    vi.mocked(getPreferences).mockResolvedValue({
      success: true,
      data: { viewMode: "tree", sortBy: "name-desc" },
    });

    render(<PreferencesTab />);

    await waitFor(() => {
      const treeRadio = screen.getByLabelText(/tree/i);
      expect(treeRadio).toBeChecked();
    });
  });

  it("reverts view mode on save failure", async () => {
    vi.mocked(updatePreferences).mockResolvedValue({
      success: false,
      error: "Server error",
    });

    const user = userEvent.setup();
    render(<PreferencesTab />);

    await waitFor(() => {
      expect(screen.getByLabelText(/grid/i)).toBeInTheDocument();
    });

    // Initially grid is selected
    const gridRadio = screen.getByLabelText(/grid/i);
    expect(gridRadio).toBeChecked();

    // Click tree
    await user.click(screen.getByLabelText(/tree/i));

    // Wait for the revert
    await waitFor(() => {
      // Should revert back to grid after failure
      expect(gridRadio).toBeChecked();
    });
  });

  it("reverts sort preference on save failure", async () => {
    vi.mocked(updatePreferences).mockResolvedValue({
      success: false,
      error: "Server error",
    });

    const user = userEvent.setup();
    render(<PreferencesTab />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    // Open select and choose a different sort option
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Name A-Z"));

    // Wait for the revert - combobox should show original value
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveTextContent("Custom Order");
    });
  });
});
