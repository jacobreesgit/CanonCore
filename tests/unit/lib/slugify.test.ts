/**
 * Unit tests for the slugify utility.
 */
import { describe, it, expect } from "vitest";
import { slugify } from "../../../lib/slugify";

describe("slugify", () => {
  it("should convert basic strings to kebab-case", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("should handle leading and trailing whitespace", () => {
    expect(slugify("  hello world  ")).toBe("hello-world");
  });

  it("should collapse multiple spaces and dashes", () => {
    expect(slugify("hello   world---test")).toBe("hello-world-test");
  });

  it("should strip special characters", () => {
    expect(slugify("It's a Test!")).toBe("its-a-test");
  });

  it("should transliterate accented characters", () => {
    expect(slugify("Amélie")).toBe("amelie");
    expect(slugify("Über Cool")).toBe("uber-cool");
    expect(slugify("café")).toBe("cafe");
  });

  it("should handle numbers", () => {
    expect(slugify("Movie 2024")).toBe("movie-2024");
  });

  it("should return empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });

  it("should strip emoji", () => {
    expect(slugify("Movie 🎬")).toBe("movie");
  });

  it("should handle CJK characters by stripping them", () => {
    expect(slugify("映画")).toBe("");
    expect(slugify("Squid Game: 오징어 게임")).toBe("squid-game");
  });

  it("should handle underscores as separators", () => {
    expect(slugify("hello_world")).toBe("hello-world");
  });

  it("should strip leading and trailing dashes", () => {
    expect(slugify("-hello-world-")).toBe("hello-world");
  });
});
