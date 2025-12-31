/**
 * Documentation layout with docs-specific sidebar navigation.
 * Uses the Fumadocs page tree for navigation.
 */

import { source } from "@/lib/source";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth, extractSidebarUser } from "@/lib/auth";
import type { ReactNode } from "react";

/**
 * Wraps documentation pages with docs-specific sidebar navigation.
 *
 * @param children - Page content to render
 */
export default async function DocsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const user = extractSidebarUser(session);

  return (
    <SidebarProvider
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
      <SidebarInset>
        <SiteHeader title="Documentation" titleHref="/docs" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
