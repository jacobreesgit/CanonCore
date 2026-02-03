/**
 * Public layout with sidebar for unauthenticated pages.
 * Used by homepage, explore, and public profiles.
 * Includes spotlight search for authenticated users.
 * Mobile: Uses footer navigation instead of sidebar.
 */

import { AppSidebar } from "@/components/app-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { MobileNavProvider } from "@/components/mobile";
import { auth, getExtendedSidebarUser } from "@/lib/auth";
import { getGoogleDriveConnection } from "@/lib/google-drive-actions";
import { getPinnedItems } from "@/lib/item-actions";
import { MyItemsProviders } from "@/components/my-items-providers";

/**
 * Wraps public pages with sidebar and header.
 * Shows guest navigation for unauthenticated users.
 * Includes spotlight search for authenticated users.
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const [user, pinnedResult, driveConnection] = await Promise.all([
    getExtendedSidebarUser(session),
    session?.user
      ? getPinnedItems()
      : Promise.resolve({ success: true, data: [] }),
    session?.user ? getGoogleDriveConnection() : Promise.resolve(null),
  ]);
  const pinnedItems = pinnedResult.success ? pinnedResult.data : [];

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
        context="home"
        pinnedItems={pinnedItems}
        driveConnection={driveConnection}
      />
      <SidebarInset className="md:overflow-hidden">
        <main
          id="main-content"
          tabIndex={-1}
          className="@container/main flex min-h-full flex-col overflow-y-auto pb-16 outline-none md:pb-0"
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </SidebarInset>

      {/* Mobile footer navigation (hidden on desktop) */}
      <MobileNavProvider
        user={mobileNavUser}
        driveConnection={driveConnection}
      />
    </SidebarProvider>
  );

  // Always wrap to maintain consistent component tree depth
  // Spotlight search only shows for authenticated users via context
  return <MyItemsProviders>{content}</MyItemsProviders>;
}
