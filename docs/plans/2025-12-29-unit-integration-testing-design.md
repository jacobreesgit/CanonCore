# Unit and Integration Testing Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add unit and integration tests using Vitest, prioritizing auth logic.

**Architecture:** Separate unit (mocked) and integration (real DB) test directories with shared setup.

**Tech Stack:** Vitest, @vitest/coverage-v8

---

## Project Structure

```
tests/
├── unit/
│   ├── lib/
│   │   ├── auth-actions.test.ts    # signUp, forgotPassword, resetPassword
│   │   ├── utils.test.ts           # cn() helper
│   │   └── email.test.ts           # sendPasswordResetEmail
│   └── setup.ts                    # Global test setup, mocks
├── integration/
│   ├── auth/
│   │   ├── sign-up.test.ts         # Full sign-up flow with DB
│   │   ├── sign-in.test.ts         # Credentials validation
│   │   └── password-reset.test.ts  # Token generation + redemption
│   └── setup.ts                    # DB cleanup helpers
└── vitest.config.ts
```

## Dependencies

```bash
pnpm add -D vitest @vitest/coverage-v8
```

## Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["e2e/**"],
    setupFiles: ["tests/unit/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
```

## Package.json Scripts

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:unit": "vitest run tests/unit",
  "test:integration": "vitest run tests/integration"
}
```

## Unit Test Setup (Mocking)

```typescript
// tests/unit/setup.ts
import { vi } from "vitest";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    passwordReset: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock Resend
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn(),
}));
```

## Example Unit Test

```typescript
// tests/unit/lib/auth-actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { signUp } from "@/lib/auth-actions";
import { prisma } from "@/lib/prisma";

describe("signUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates user with hashed password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "1",
      email: "test@example.com",
    });

    const result = await signUp("test@example.com", "Password123!");

    expect(result.success).toBe(true);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "test@example.com",
        passwordHash: expect.any(String),
      }),
    });
  });

  it("returns error for existing email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "1",
      email: "exists@example.com",
    });

    const result = await signUp("exists@example.com", "Password123!");

    expect(result.error).toBe("An account with this email already exists");
  });
});
```

## Integration Test Setup

```typescript
// tests/integration/setup.ts
import { prisma } from "@/lib/prisma";
import { beforeEach, afterAll } from "vitest";

// Clean up test data before each test
beforeEach(async () => {
  await prisma.passwordReset.deleteMany({
    where: { user: { email: { contains: "@test.example.com" } } },
  });
  await prisma.user.deleteMany({
    where: { email: { contains: "@test.example.com" } },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

## Example Integration Test

```typescript
// tests/integration/auth/sign-up.test.ts
import { describe, it, expect } from "vitest";
import { signUp } from "@/lib/auth-actions";
import { prisma } from "@/lib/prisma";

describe("signUp integration", () => {
  it("persists user to database", async () => {
    const email = `signup-${Date.now()}@test.example.com`;

    const result = await signUp(email, "Password123!");

    expect(result.success).toBe(true);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user?.email).toBe(email);
  });
});
```

## Test Types Summary

| Test Type   | Purpose           | Speed | Database |
| ----------- | ----------------- | ----- | -------- |
| Unit        | Logic correctness | ~1s   | Mocked   |
| Integration | DB + full flow    | ~5s   | Real     |
| E2E         | User journeys     | ~11s  | Real     |
