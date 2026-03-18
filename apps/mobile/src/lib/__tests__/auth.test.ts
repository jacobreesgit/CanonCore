import { __resetStore } from "../../../__mocks__/expo-secure-store";
import {
  getToken,
  setToken,
  removeToken,
  setUser,
  getUser,
  clearAuth,
} from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

beforeEach(() => {
  __resetStore();
});

describe("auth token helpers", () => {
  it("returns null when no token stored", async () => {
    const token = await getToken();
    expect(token).toBeNull();
  });

  it("stores and retrieves a token", async () => {
    await setToken("test-jwt-token");
    const token = await getToken();
    expect(token).toBe("test-jwt-token");
  });

  it("removes a stored token", async () => {
    await setToken("test-jwt-token");
    await removeToken();
    const token = await getToken();
    expect(token).toBeNull();
  });
});

describe("auth user helpers", () => {
  const mockUser: AuthUser = {
    id: "user-1",
    email: "test@example.com",
    username: "testuser",
  };

  it("returns null when no user stored", async () => {
    const user = await getUser();
    expect(user).toBeNull();
  });

  it("stores and retrieves a user", async () => {
    await setUser(mockUser);
    const user = await getUser();
    expect(user).toEqual(mockUser);
  });

  it("handles user with null username", async () => {
    const userNoUsername = { ...mockUser, username: null };
    await setUser(userNoUsername);
    const user = await getUser();
    expect(user?.username).toBeNull();
  });
});

describe("clearAuth", () => {
  it("clears both token and user", async () => {
    await setToken("test-jwt");
    await setUser({ id: "1", email: "a@b.com", username: null });
    await clearAuth();
    expect(await getToken()).toBeNull();
    expect(await getUser()).toBeNull();
  });
});
