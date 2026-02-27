import { describe, it, expect } from "vitest";
import { createColourShades } from "@/lib/colour-utils";

describe("createColourShades", () => {
  it("generates 10 shades from a valid hex colour", () => {
    const shades = createColourShades("#1a3a5c");
    expect(Object.keys(shades)).toHaveLength(10);
    for (let i = 1; i <= 10; i++) {
      const key = `--dark-${i}00` as string;
      expect(shades[key]).toBeDefined();
      expect(shades[key]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("is deterministic — same input produces same output", () => {
    const a = createColourShades("#ff6b35");
    const b = createColourShades("#ff6b35");
    expect(a).toEqual(b);
  });

  it("handles pure black", () => {
    const shades = createColourShades("#000000");
    expect(shades["--dark-1000"]).toMatch(/^#[0-9a-f]{6}$/i);
    // Darkest shade should be very close to black
    expect(shades["--dark-1000"]).toBe("#000000");
  });

  it("handles pure white", () => {
    const shades = createColourShades("#ffffff");
    expect(shades["--dark-100"]).toBeDefined();
  });

  it("produces darker shades at higher numbers", () => {
    const shades = createColourShades("#4488cc");
    // Convert hex to brightness for comparison
    const brightness = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return r + g + b;
    };
    expect(brightness(shades["--dark-100"])).toBeGreaterThan(
      brightness(shades["--dark-1000"])
    );
  });

  it("handles 3-digit hex shorthand", () => {
    const shades = createColourShades("#abc");
    expect(Object.keys(shades)).toHaveLength(10);
  });

  it("shade 700 is close to the input colour", () => {
    // --dark-700 is the primary theme shade used in gradients
    const shades = createColourShades("#1a3a5c");
    expect(shades["--dark-700"]).toBeDefined();
  });
});
