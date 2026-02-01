/**
 * Unit tests for the wizard step indicator component.
 * Tests accessibility, visual states, and step label rendering.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WizardStepIndicator } from "@/components/wizards/wizard-step-indicator";

describe("WizardStepIndicator", () => {
  const defaultSteps = ["text", "poster", "hero", "summary"] as const;
  type TestStep = (typeof defaultSteps)[number];

  const defaultLabels: Record<TestStep, string> = {
    text: "Title & Description",
    poster: "Poster",
    hero: "Hero Image",
    summary: "Review",
  };

  describe("rendering", () => {
    it("renders all steps", () => {
      render(
        <WizardStepIndicator
          steps={defaultSteps}
          currentStep="text"
          stepLabels={defaultLabels}
        />
      );

      expect(screen.getByText("Title & Description")).toBeInTheDocument();
      expect(screen.getByText("Poster")).toBeInTheDocument();
      expect(screen.getByText("Hero Image")).toBeInTheDocument();
      expect(screen.getByText("Review")).toBeInTheDocument();
    });

    it("renders step numbers", () => {
      render(
        <WizardStepIndicator
          steps={defaultSteps}
          currentStep="text"
          stepLabels={defaultLabels}
        />
      );

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has accessible navigation landmark", () => {
      render(
        <WizardStepIndicator
          steps={defaultSteps}
          currentStep="text"
          stepLabels={defaultLabels}
        />
      );

      const nav = screen.getByRole("navigation", { name: /wizard progress/i });
      expect(nav).toBeInTheDocument();
    });

    it("renders as ordered list", () => {
      render(
        <WizardStepIndicator
          steps={defaultSteps}
          currentStep="poster"
          stepLabels={defaultLabels}
        />
      );

      const list = screen.getByRole("list");
      expect(list).toBeInTheDocument();
      expect(screen.getAllByRole("listitem")).toHaveLength(4);
    });

    it("marks current step with aria-current", () => {
      render(
        <WizardStepIndicator
          steps={defaultSteps}
          currentStep="poster"
          stepLabels={defaultLabels}
        />
      );

      const items = screen.getAllByRole("listitem");
      expect(items[0]).not.toHaveAttribute("aria-current");
      expect(items[1]).toHaveAttribute("aria-current", "step");
      expect(items[2]).not.toHaveAttribute("aria-current");
      expect(items[3]).not.toHaveAttribute("aria-current");
    });

    it("provides step labels for screen readers", () => {
      render(
        <WizardStepIndicator
          steps={defaultSteps}
          currentStep="hero"
          stepLabels={defaultLabels}
        />
      );

      // Screen readers should be able to understand step context
      const items = screen.getAllByRole("listitem");
      expect(items[0]).toHaveAttribute(
        "aria-label",
        "Step 1: Title & Description, completed"
      );
      expect(items[1]).toHaveAttribute(
        "aria-label",
        "Step 2: Poster, completed"
      );
      expect(items[2]).toHaveAttribute(
        "aria-label",
        "Step 3: Hero Image, current"
      );
      expect(items[3]).toHaveAttribute(
        "aria-label",
        "Step 4: Review, upcoming"
      );
    });

    it("includes live region for step announcements", () => {
      render(
        <WizardStepIndicator
          steps={defaultSteps}
          currentStep="poster"
          stepLabels={defaultLabels}
        />
      );

      const liveRegion = screen.getByRole("status");
      expect(liveRegion).toHaveAttribute("aria-live", "polite");
      expect(liveRegion).toHaveAttribute("aria-atomic", "true");
      expect(liveRegion).toHaveTextContent("Step 2 of 4: Poster");
    });
  });

  describe("visual states", () => {
    it("marks completed steps", () => {
      render(
        <WizardStepIndicator
          steps={defaultSteps}
          currentStep="hero"
          stepLabels={defaultLabels}
        />
      );

      // Steps before current should be marked as completed
      // We check for the completed class or check icon
      const items = screen.getAllByRole("listitem");
      expect(items[0]).toHaveAttribute("data-state", "completed");
      expect(items[1]).toHaveAttribute("data-state", "completed");
      expect(items[2]).toHaveAttribute("data-state", "current");
      expect(items[3]).toHaveAttribute("data-state", "upcoming");
    });

    it("marks current step", () => {
      render(
        <WizardStepIndicator
          steps={defaultSteps}
          currentStep="text"
          stepLabels={defaultLabels}
        />
      );

      const items = screen.getAllByRole("listitem");
      expect(items[0]).toHaveAttribute("data-state", "current");
    });

    it("marks upcoming steps", () => {
      render(
        <WizardStepIndicator
          steps={defaultSteps}
          currentStep="text"
          stepLabels={defaultLabels}
        />
      );

      const items = screen.getAllByRole("listitem");
      expect(items[1]).toHaveAttribute("data-state", "upcoming");
      expect(items[2]).toHaveAttribute("data-state", "upcoming");
      expect(items[3]).toHaveAttribute("data-state", "upcoming");
    });
  });

  describe("edge cases", () => {
    it("handles single step wizard", () => {
      const singleStep = ["only"] as const;
      const singleLabel = { only: "Only Step" };

      render(
        <WizardStepIndicator
          steps={singleStep}
          currentStep="only"
          stepLabels={singleLabel}
        />
      );

      expect(screen.getByText("Only Step")).toBeInTheDocument();
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });

    it("handles first step correctly", () => {
      render(
        <WizardStepIndicator
          steps={defaultSteps}
          currentStep="text"
          stepLabels={defaultLabels}
        />
      );

      const items = screen.getAllByRole("listitem");
      expect(items[0]).toHaveAttribute("data-state", "current");
      expect(items[1]).toHaveAttribute("data-state", "upcoming");
    });

    it("handles last step correctly", () => {
      render(
        <WizardStepIndicator
          steps={defaultSteps}
          currentStep="summary"
          stepLabels={defaultLabels}
        />
      );

      const items = screen.getAllByRole("listitem");
      expect(items[0]).toHaveAttribute("data-state", "completed");
      expect(items[1]).toHaveAttribute("data-state", "completed");
      expect(items[2]).toHaveAttribute("data-state", "completed");
      expect(items[3]).toHaveAttribute("data-state", "current");
    });
  });
});
