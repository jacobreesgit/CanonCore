/**
 * Unit tests for Dropzone component.
 * Tests rendering, file handling, and error states.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "@/components/ui/dropzone";

// Mock react-dropzone
vi.mock("react-dropzone", () => ({
  useDropzone: vi.fn(({ onDrop, disabled }) => ({
    getRootProps: () => ({
      onClick: vi.fn(),
      onDragOver: vi.fn(),
      onDrop: vi.fn(),
    }),
    getInputProps: () => ({
      type: "file",
      disabled,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          onDrop?.(Array.from(files), [], {} as DragEvent);
        }
      },
    }),
    isDragActive: false,
  })),
}));

describe("Dropzone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render children", () => {
      render(
        <Dropzone>
          <span>Drop files here</span>
        </Dropzone>
      );

      expect(screen.getByText("Drop files here")).toBeInTheDocument();
    });

    it("should render as a button", () => {
      render(
        <Dropzone>
          <span>Upload</span>
        </Dropzone>
      );

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      render(
        <Dropzone className="custom-class" data-testid="dropzone">
          <span>Upload</span>
        </Dropzone>
      );

      expect(screen.getByTestId("dropzone")).toHaveClass("custom-class");
    });

    it("should be disabled when disabled prop is true", () => {
      render(
        <Dropzone disabled>
          <span>Upload</span>
        </Dropzone>
      );

      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  describe("file input", () => {
    it("should render hidden file input", () => {
      render(
        <Dropzone>
          <span>Upload</span>
        </Dropzone>
      );

      const input = document.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
    });
  });
});

describe("DropzoneEmptyState", () => {
  it("should render default empty state when no src", () => {
    render(
      <Dropzone>
        <DropzoneEmptyState />
      </Dropzone>
    );

    expect(screen.getByText("Upload a file")).toBeInTheDocument();
    expect(
      screen.getByText("Drag and drop or click to upload")
    ).toBeInTheDocument();
  });

  it("should render custom children when provided", () => {
    render(
      <Dropzone>
        <DropzoneEmptyState>
          <span>Custom empty state</span>
        </DropzoneEmptyState>
      </Dropzone>
    );

    expect(screen.getByText("Custom empty state")).toBeInTheDocument();
    expect(screen.queryByText("Upload a file")).not.toBeInTheDocument();
  });

  it("should show file type constraints when accept is provided", () => {
    render(
      <Dropzone accept={{ "image/jpeg": [], "image/png": [] }}>
        <DropzoneEmptyState />
      </Dropzone>
    );

    expect(
      screen.getByText(/Accepts image\/jpeg and image\/png/i)
    ).toBeInTheDocument();
  });

  it("should show max size constraint", () => {
    render(
      <Dropzone maxSize={1024 * 1024}>
        <DropzoneEmptyState />
      </Dropzone>
    );

    expect(screen.getByText(/less than 1MB/i)).toBeInTheDocument();
  });
});

describe("DropzoneContent", () => {
  it("should not render content when no src is provided", () => {
    render(
      <Dropzone>
        <DropzoneContent />
      </Dropzone>
    );

    // DropzoneContent should not render file list text when no src
    expect(
      screen.queryByText("Drag and drop or click to replace")
    ).not.toBeInTheDocument();
  });

  it("should render custom children when provided with src", () => {
    const testFile = new File(["test"], "test.jpg", { type: "image/jpeg" });

    render(
      <Dropzone src={[testFile]}>
        <DropzoneContent>
          <span>Custom content</span>
        </DropzoneContent>
      </Dropzone>
    );

    expect(screen.getByText("Custom content")).toBeInTheDocument();
  });

  it("should render file names when src is provided without children", () => {
    const testFile = new File(["test"], "test-image.jpg", {
      type: "image/jpeg",
    });

    render(
      <Dropzone src={[testFile]}>
        <DropzoneContent />
      </Dropzone>
    );

    expect(screen.getByText("test-image.jpg")).toBeInTheDocument();
  });
});
