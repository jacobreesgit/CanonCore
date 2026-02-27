/**
 * Unit tests for the TMDB wizard logo step.
 * Tests step visibility by content type.
 */
import { describe, it, expect } from "vitest";
import { getVisibleSteps } from "@/components/items/wizards/tmdb-wizard/tmdb-wizard-types";

describe("getVisibleSteps — logo", () => {
  it("includes logo step for movie", () => {
    expect(getVisibleSteps("movie")).toContain("logo");
  });

  it("includes logo step for show", () => {
    expect(getVisibleSteps("show")).toContain("logo");
  });

  it("excludes logo step for season", () => {
    expect(getVisibleSteps("season")).not.toContain("logo");
  });

  it("excludes logo step for episode", () => {
    expect(getVisibleSteps("episode")).not.toContain("logo");
  });

  it("places logo after hero for movies", () => {
    const steps = getVisibleSteps("movie");
    const heroIndex = steps.indexOf("hero");
    const logoIndex = steps.indexOf("logo");
    const summaryIndex = steps.indexOf("summary");

    expect(logoIndex).toBeGreaterThan(heroIndex);
    expect(logoIndex).toBeLessThan(summaryIndex);
  });

  it("places logo after hero for shows", () => {
    const steps = getVisibleSteps("show");
    const heroIndex = steps.indexOf("hero");
    const logoIndex = steps.indexOf("logo");
    const summaryIndex = steps.indexOf("summary");

    expect(logoIndex).toBeGreaterThan(heroIndex);
    expect(logoIndex).toBeLessThan(summaryIndex);
  });
});
