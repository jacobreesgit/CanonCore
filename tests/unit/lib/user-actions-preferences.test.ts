/**
 * Unit tests for user preferences server actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPreferences, updatePreferences } from "@/lib/user-actions";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

describe("getPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default preferences when user has none set", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      defaultViewMode: null,
      defaultSortBy: null,
    } as never);

    const result = await getPreferences();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        viewMode: "grid",
        sortBy: "custom",
      });
    }
  });

  it("returns stored preferences", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      defaultViewMode: "tree",
      defaultSortBy: "name-asc",
    } as never);

    const result = await getPreferences();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        viewMode: "tree",
        sortBy: "name-asc",
      });
    }
  });

  it("returns error when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await getPreferences();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Not authenticated");
    }
  });

  it("returns defaults for invalid stored values", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      defaultViewMode: "invalid-mode",
      defaultSortBy: "invalid-sort",
    } as never);

    const result = await getPreferences();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        viewMode: "grid",
        sortBy: "custom",
      });
    }
  });
});

describe("updatePreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates view mode preference", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const result = await updatePreferences({ viewMode: "tree" });

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { defaultViewMode: "tree" },
    });
  });

  it("updates sort preference", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const result = await updatePreferences({ sortBy: "name-asc" });

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { defaultSortBy: "name-asc" },
    });
  });

  it("updates multiple preferences at once", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const result = await updatePreferences({
      viewMode: "tree",
      sortBy: "created-desc",
    });

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        defaultViewMode: "tree",
        defaultSortBy: "created-desc",
      },
    });
  });

  it("validates view mode value", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);

    const result = await updatePreferences({ viewMode: "invalid" as never });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid view mode");
    }
  });

  it("validates sort value", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);

    const result = await updatePreferences({ sortBy: "invalid" as never });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid sort option");
    }
  });

  it("returns error when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await updatePreferences({ viewMode: "tree" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Not authenticated");
    }
  });
});
