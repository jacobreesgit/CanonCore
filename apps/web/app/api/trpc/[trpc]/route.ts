import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { PrismaClient } from "@prisma/client";
import { jwtVerify } from "jose";
import { appRouter } from "@canoncore/api";
import { createTRPCContext } from "@canoncore/api/context";
import type { RateLimitFn } from "@canoncore/api/context";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit as webCheckRateLimit } from "@/lib/rate-limit";

const JWT_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET!);

/**
 * Next.js API route handler for tRPC.
 * Resolves auth (NextAuth session OR JWT Bearer) and creates context.
 * Injects checkRateLimit — keeps Upstash Redis as a web-only dep.
 */
const handler = async (req: Request) => {
  // Resolve auth — try NextAuth session first, then JWT
  let userId: string | null = null;
  let authSource: "session" | "jwt" | null = null;

  const session = await auth();
  if (session?.user?.id) {
    userId = session.user.id;
    authSource = "session";
  } else {
    // Check for JWT Bearer token (mobile clients)
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice(7);
        const { payload } = await jwtVerify(token, JWT_SECRET, {
          algorithms: ["HS256"],
        });
        if (typeof payload.sub === "string") {
          userId = payload.sub;
          authSource = "jwt";
        }
      } catch {
        // Invalid/expired token — fall through as unauthenticated
      }
    }
  }

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () =>
      createTRPCContext({
        prisma: prisma as unknown as PrismaClient,
        userId,
        authSource,
        checkRateLimit: webCheckRateLimit as RateLimitFn,
      }),
    onError({ error, path }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(`tRPC error on ${path}:`, error.message);
      }
    },
  });
};

export { handler as GET, handler as POST };
