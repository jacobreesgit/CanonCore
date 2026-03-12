/**
 * Unit tests for the TMDB wizard text step component.
 * Tests rendering, checkbox interactions, and navigation.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TMDBTextStep } from "@/components/items/wizards/tmdb-wizard/text-step";
import type { TMDBWizardData } from "@/components/items/wizards/tmdb-wizard";

const mockCurrentValues = {
  name: "Old Name",
  description: "Old description",
};

const mockData: Partial<TMDBWizardData> = {
  preview: {
    name: "New Name (2024)",
    description: "New description from TMDB",
  },
  textOptions: {
    updateName: true,
    updateDescription: true,
  },
};

describe("TMDBTextStep", () => {
  describe("rendering", () => {
    it("renders step title", () => {
      render(
        <TMDBTextStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
        />
      );

      expect(screen.getByText("Title & Description")).toBeInTheDocument();
    });

    it("renders name checkbox checked by default", () => {
      render(
        <TMDBTextStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
        />
      );

      const nameCheckbox = screen.getByRole("checkbox", { name: /name/i });
      expect(nameCheckbox).toBeChecked();
    });

    it("renders description checkbox checked by default", () => {
      render(
        <TMDBTextStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
        />
      );

      const descCheckbox = screen.getByRole("checkbox", {
        name: /description/i,
      });
      expect(descCheckbox).toBeChecked();
    });

    it("displays before/after values", () => {
      render(
        <TMDBTextStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
        />
      );

      expect(screen.getByText("Old Name")).toBeInTheDocument();
      expect(screen.getByText("New Name (2024)")).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("renders Next button", () => {
      render(
        <TMDBTextStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });

    it("calls onNext when Next button is clicked", async () => {
      const user = userEvent.setup();
      const onNext = vi.fn();

      render(
        <TMDBTextStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={false}
          onNext={onNext}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
        />
      );

      await user.click(screen.getByRole("button", { name: /next/i }));

      expect(onNext).toHaveBeenCalled();
    });

    it("does not render Back button when canGoBack is false", () => {
      render(
        <TMDBTextStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
        />
      );

      expect(
        screen.queryByRole("button", { name: /back/i })
      ).not.toBeInTheDocument();
    });

    it("renders Back button when canGoBack is true", () => {
      render(
        <TMDBTextStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });

    it("calls onBack when Back button is clicked", async () => {
      const user = userEvent.setup();
      const onBack = vi.fn();

      render(
        <TMDBTextStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={true}
          onNext={vi.fn()}
          onBack={onBack}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
        />
      );

      await user.click(screen.getByRole("button", { name: /back/i }));

      expect(onBack).toHaveBeenCalled();
    });
  });

  describe("interactions", () => {
    it("calls onDataChange when name checkbox is toggled", async () => {
      const user = userEvent.setup();
      const onDataChange = vi.fn();

      render(
        <TMDBTextStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={onDataChange}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
        />
      );

      const nameCheckbox = screen.getByRole("checkbox", { name: /name/i });
      await user.click(nameCheckbox);

      expect(onDataChange).toHaveBeenCalledWith({
        textOptions: {
          updateName: false,
          updateDescription: true,
        },
      });
    });

    it("calls onDataChange when description checkbox is toggled", async () => {
      const user = userEvent.setup();
      const onDataChange = vi.fn();

      render(
        <TMDBTextStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error={null}
          canGoBack={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={onDataChange}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
        />
      );

      const descCheckbox = screen.getByRole("checkbox", {
        name: /description/i,
      });
      await user.click(descCheckbox);

      expect(onDataChange).toHaveBeenCalledWith({
        textOptions: {
          updateName: true,
          updateDescription: false,
        },
      });
    });
  });

  describe("loading state", () => {
    it("disables checkboxes when loading", () => {
      render(
        <TMDBTextStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={true}
          error={null}
          canGoBack={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
        />
      );

      const nameCheckbox = screen.getByRole("checkbox", { name: /name/i });
      const descCheckbox = screen.getByRole("checkbox", {
        name: /description/i,
      });

      expect(nameCheckbox).toBeDisabled();
      expect(descCheckbox).toBeDisabled();
    });

    it("disables Next button when loading", () => {
      render(
        <TMDBTextStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={true}
          error={null}
          canGoBack={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });
  });

  describe("error state", () => {
    it("displays error message", () => {
      render(
        <TMDBTextStep
          data={mockData}
          currentValues={mockCurrentValues}
          isLoading={false}
          error="Something went wrong"
          canGoBack={false}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onDataChange={vi.fn()}
          onLoadingChange={vi.fn()}
          onError={vi.fn()}
        />
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });
});
