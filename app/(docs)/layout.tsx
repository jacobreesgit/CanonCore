/**
 * Documentation layout with docs-specific sidebar navigation.
 * Uses the Fumadocs page tree for navigation.
 * Includes spotlight search for authenticated users.
 * Mobile: Uses footer navigation instead of sidebar.
 */

import { source } from "@/lib/source";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { MobileNavProvider } from "@/components/mobile";
import { auth, getExtendedSidebarUser } from "@/lib/auth";
import { getGoogleDriveConnection } from "@/lib/google-drive-actions";
import { MyItemsProviders } from "@/components/items/my-items-providers";
import { ErrorBoundary } from "@/components/providers/error-boundary";
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
  const [user, driveConnection] = await Promise.all([
    getExtendedSidebarUser(session),
    session?.user ? getGoogleDriveConnection() : Promise.resolve(null),
  ]);
  const driveNeedsReauth = driveConnection?.needsReauth ?? false;

  // Prepare user data for mobile nav (null-safe)
  const mobileNavUser = user
    ? {
        name: user.name || "User",
        email: user.email || "",
        avatar: user.avatar,
        username: user.username,
        isPublic: user.isPublic,
        hasImage: user.hasImage,
        hasHeroImage: user.hasHeroImage,
      }
    : null;

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
      <SidebarInset className="lg:overflow-hidden">
        <main
          id="main-content"
          tabIndex={-1}
          className="@container/main flex min-h-full flex-col overflow-y-auto pb-16 outline-none lg:pb-0"
        >
          <SiteHeader
            title="Documentation"
            titleHref="/docs"
            driveNeedsReauth={driveNeedsReauth}
          />
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </SidebarInset>

      {/* Mobile footer navigation (hidden on desktop) */}
      <MobileNavProvider
        user={mobileNavUser}
        driveConnection={driveConnection}
        driveNeedsReauth={driveNeedsReauth}
      />
    </SidebarProvider>
  );

  // Always wrap to maintain consistent component tree depth
  // Spotlight search only shows for authenticated users via context
  return <MyItemsProviders>{content}</MyItemsProviders>;
}
