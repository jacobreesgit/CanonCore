/**
 * Unit tests for StorageBar component.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StorageBar } from "@/components/google-drive/storage-bar";

describe("StorageBar", () => {
  it("renders storage usage text", () => {
    render(
      <StorageBar
        bytesUsed={BigInt("1073741824")} // 1 GB
        bytesTotal={BigInt("16106127360")} // 15 GB
      />
    );

    expect(screen.getByText(/1\.0 GB/)).toBeInTheDocument();
    expect(screen.getByText(/15\.0 GB/)).toBeInTheDocument();
  });

  it("renders progress bar with correct percentage", () => {
    render(
      <StorageBar
        bytesUsed={BigInt("8053063680")} // 7.5 GB
        bytesTotal={BigInt("16106127360")} // 15 GB
      />
    );

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "50");
  });

  it("has accessible aria-label", () => {
    render(
      <StorageBar
        bytesUsed={BigInt("8053063680")} // 7.5 GB (50%)
        bytesTotal={BigInt("16106127360")} // 15 GB
      />
    );

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Storage")
    );
  });

  it("shows warning when usage > 80%", () => {
    render(
      <StorageBar
        bytesUsed={BigInt("13684808550")} // 12.75 GB (85%)
        bytesTotal={BigInt("16106127360")} // 15 GB
      />
    );

    expect(screen.getByText(/Storage almost full/i)).toBeInTheDocument();
  });

  it("shows critical warning when usage > 95%", () => {
    render(
      <StorageBar
        bytesUsed={BigInt("15300820992")} // 14.25 GB (95%)
        bytesTotal={BigInt("16106127360")} // 15 GB
      />
    );

    expect(screen.getByText(/Storage critical/i)).toBeInTheDocument();
  });

  it("renders compact variant without text", () => {
    render(
      <StorageBar
        bytesUsed={BigInt("1073741824")}
        bytesTotal={BigInt("16106127360")}
        variant="compact"
      />
    );

    expect(screen.queryByText(/GB/)).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows disabled state when bytesTotal is null", () => {
    render(<StorageBar bytesUsed={null} bytesTotal={null} />);

    expect(screen.getByText(/Sync to see storage usage/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0"
    );
  });

  it("shows disabled state when bytesTotal is zero", () => {
    render(<StorageBar bytesUsed={BigInt(0)} bytesTotal={BigInt(0)} />);

    expect(screen.getByText(/Sync to see storage usage/i)).toBeInTheDocument();
  });

  it("has reduced opacity in disabled state", () => {
    render(<StorageBar bytesUsed={null} bytesTotal={null} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveClass("opacity-40");
  });

  it("has correct aria-label in disabled state", () => {
    render(<StorageBar bytesUsed={null} bytesTotal={null} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute(
      "aria-label",
      "Storage usage: not available"
    );
  });
});
