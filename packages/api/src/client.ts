import { createTRPCContext as createTRPCReactContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "./root";

/**
 * tRPC React context for client components.
 *
 * Web usage: Wrap app in <TRPCProvider> (see apps/web/components/providers/trpc-provider.tsx)
 * Mobile usage: Wrap app in <TRPCProvider> (see apps/mobile/app/_layout.tsx)
 */
export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCReactContext<AppRouter>();

/** Re-export AppRouter type for client-side type inference */
export type { AppRouter } from "./root";
