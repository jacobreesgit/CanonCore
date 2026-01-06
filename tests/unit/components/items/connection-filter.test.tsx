/**
 * Unit tests for ConnectionFilter component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ConnectionFilter } from "@/components/items/connection-filter";

describe("ConnectionFilter", () => {
  const mockConnections = [
    { id: "conn-1", name: "Media Server" },
    { id: "conn-2", name: "Backup Server" },
  ];

  it("renders 'All Items' option by default", () => {
    render(
      <ConnectionFilter
        connections={mockConnections}
        selectedConnectionId={null}
        onConnectionChange={vi.fn()}
      />
    );

    // shadcn Select trigger uses combobox role
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("All Items");
  });

  it("shows selected connection name", () => {
    render(
      <ConnectionFilter
        connections={mockConnections}
        selectedConnectionId="conn-1"
        onConnectionChange={vi.fn()}
      />
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Media Server");
  });

  it("calls onConnectionChange when selection changes", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onChange = vi.fn();

    render(
      <ConnectionFilter
        connections={mockConnections}
        selectedConnectionId={null}
        onConnectionChange={onChange}
      />
    );

    // Open select dropdown
    await user.click(screen.getByRole("combobox"));

    // Wait for dropdown to render (Radix uses portals)
    const option = await screen.findByRole("option", { name: "Media Server" });
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith("conn-1");
  });

  it("is disabled when connections array is empty", () => {
    render(
      <ConnectionFilter
        connections={[]}
        selectedConnectionId={null}
        onConnectionChange={vi.fn()}
      />
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();
  });

  it("calls onConnectionChange with null when All Items is selected", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onChange = vi.fn();

    render(
      <ConnectionFilter
        connections={mockConnections}
        selectedConnectionId="conn-1"
        onConnectionChange={onChange}
      />
    );

    // Open select dropdown
    await user.click(screen.getByRole("combobox"));

    // Wait for dropdown to render and click "All Items" option
    const option = await screen.findByRole("option", { name: "All Items" });
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith(null);
  });

  describe("single connection behavior", () => {
    const singleConnection = [{ id: "conn-1", name: "Media Server" }];

    it("shows connection name when only one connection exists", () => {
      render(
        <ConnectionFilter
          connections={singleConnection}
          selectedConnectionId={null}
          onConnectionChange={vi.fn()}
        />
      );

      const trigger = screen.getByRole("combobox");
      expect(trigger).toHaveTextContent("Media Server");
    });

    it("is disabled when only one connection exists", () => {
      render(
        <ConnectionFilter
          connections={singleConnection}
          selectedConnectionId={null}
          onConnectionChange={vi.fn()}
        />
      );

      const trigger = screen.getByRole("combobox");
      expect(trigger).toBeDisabled();
    });

    it("does not show 'All Items' option when only one connection exists", async () => {
      render(
        <ConnectionFilter
          connections={singleConnection}
          selectedConnectionId={null}
          onConnectionChange={vi.fn()}
        />
      );

      // Try to open the dropdown (it's disabled, but let's check content)
      // Since it's disabled, we can't open it, so the "All Items" won't be visible
      const trigger = screen.getByRole("combobox");
      expect(trigger).toBeDisabled();
      expect(trigger).not.toHaveTextContent("All Items");
    });
  });
});
