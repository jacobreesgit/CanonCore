/**
 * Documentation layout with docs-specific sidebar navigation.
 * Uses the Fumadocs page tree for navigation.
 * Includes spotlight search for authenticated users.
 */

import { source } from "@/lib/source";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth, getExtendedSidebarUser } from "@/lib/auth";
import { MyItemsProviders } from "@/components/my-items-providers";
import type { ReactNode } from "react";

/**
 * Wraps documentation pages with docs-specific sidebar navigation.
 * Includes spotlight search for authenticated users.
 *
 * @param children - Page content to render
 */
export default async function DocsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const user = await getExtendedSidebarUser(session);

  const content = (
    <SidebarProvider
      className="h-svh overflow-hidden"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        user={user}
        context="docs"
        docsTree={source.pageTree}
      />
      <SidebarInset className="overflow-hidden">
        <main
          id="main-content"
          tabIndex={-1}
          className="@container/main flex min-h-full flex-col overflow-y-auto outline-none"
        >
          <SiteHeader title="Documentation" titleHref="/docs" />
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );

  // Wrap with spotlight provider for authenticated users
  return user ? <MyItemsProviders>{content}</MyItemsProviders> : content;
}
