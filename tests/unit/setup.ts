import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Mock ResizeObserver for cmdk and Radix UI (jsdom doesn't implement it)
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Mock Pointer Capture API for Radix UI (jsdom doesn't implement it)
Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

// Mock scrollIntoView for Radix UI
Element.prototype.scrollIntoView = vi.fn();

// Mock scrollTo for animated dialog scroll reset
Element.prototype.scrollTo = vi.fn();

// Mock window.matchMedia for useMobile hook (jsdom doesn't implement it)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    passwordReset: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    item: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    googleDriveConnection: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    itemFile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    emailVerificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    fork: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn((updates) => Promise.all(updates)),
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

// Mock Resend email
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock Next.js cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock next/server `after` (runs callback synchronously in tests)
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: vi.fn((fn: () => void) => fn()),
  };
});

// Mock rate limiting (returns null = allowed)
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
  rateLimiters: {},
}));

// Mock next-auth (prevents module resolution issues in tests)
vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(() => ({ data: null, status: "unauthenticated" })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock @/lib/auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

// Mock PrismaClientKnownRequestError for error testing
class MockPrismaClientKnownRequestError extends Error {
  code: string;
  meta?: Record<string, unknown>;
  clientVersion?: string;
  constructor(
    message: string,
    {
      code,
      meta,
      clientVersion,
    }: { code: string; meta?: Record<string, unknown>; clientVersion?: string }
  ) {
    super(message);
    this.name = "PrismaClientKnownRequestError";
    this.code = code;
    this.meta = meta;
    this.clientVersion = clientVersion;
  }
}

// Mock PrismaClientInitializationError for error testing
class MockPrismaClientInitializationError extends Error {
  clientVersion?: string;
  constructor(message: string, clientVersion?: string) {
    super(message);
    this.name = "PrismaClientInitializationError";
    this.clientVersion = clientVersion;
  }
}

// Mock PrismaClientValidationError for error testing
class MockPrismaClientValidationError extends Error {
  clientVersion?: string;
  constructor(
    message: string,
    { clientVersion }: { clientVersion?: string } = {}
  ) {
    super(message);
    this.name = "PrismaClientValidationError";
    this.clientVersion = clientVersion;
  }
}

// Mock @prisma/client for enum imports in components and Prisma namespace
vi.mock("@prisma/client", () => ({
  SyncStatus: {
    SYNCED: "SYNCED",
    SYNCING: "SYNCING",
    PENDING: "PENDING",
    ERROR: "ERROR",
  },
  SyncLogAction: {
    CREATE: "CREATE",
    RENAME: "RENAME",
    DELETE: "DELETE",
    MOVE: "MOVE",
    UPLOAD: "UPLOAD",
    DOWNLOAD: "DOWNLOAD",
    SYNC: "SYNC",
  },
  SyncLogStatus: {
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
    PENDING: "PENDING",
  },
  FileType: {
    MEDIA: "MEDIA",
    ARTWORK: "ARTWORK",
    SUBTITLE: "SUBTITLE",
  },
  Prisma: {
    PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
    PrismaClientInitializationError: MockPrismaClientInitializationError,
    PrismaClientValidationError: MockPrismaClientValidationError,
  },
}));

// Export mock class for use in tests
export { MockPrismaClientKnownRequestError };

// Mock logger for unit tests
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  createRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  })),
  createUserLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  })),
  generateRequestId: vi.fn(() => "test-request-id"),
}));
