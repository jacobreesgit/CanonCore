/**
 * Documentation layout using Fumadocs.
 * Separate from dashboard layout, uses Fumadocs DocsLayout with RootProvider.
 */

import Link from "next/link";
import { source } from "@/lib/source";
import { RootProvider } from "fumadocs-ui/provider/next";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";

/**
 * Wraps documentation pages with Fumadocs layout and RootProvider.
 * Includes navigation tree and respects theme settings.
 *
 * @param children - Page content to render
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      theme={{
        enabled: false, // Use app's ThemeProvider instead
      }}
    >
      <DocsLayout
        tree={source.pageTree}
        nav={{
          title: "CanonCore Docs",
        }}
        sidebar={{
          banner: (
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Back to Dashboard
            </Link>
          ),
        }}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
