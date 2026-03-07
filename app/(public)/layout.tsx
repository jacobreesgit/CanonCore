/**
 * Public layout with sidebar for unauthenticated pages.
 * Used by homepage, explore, and public profiles.
 * Includes spotlight search for authenticated users.
 * Mobile: Uses footer navigation instead of sidebar.
 */

import { AppSidebar } from "@/components/app-sidebar";
import { ErrorBoundary } from "@/components/providers/error-boundary";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { MobileNavProvider } from "@/components/mobile";
import { auth, getExtendedSidebarUser } from "@/lib/auth";
import { getCachedGoogleDriveConnection } from "@/lib/google-drive-data";
import { getPinnedItems } from "@/lib/item-actions";
import { MyItemsProviders } from "@/components/items/my-items-providers";

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
  const [user, driveConnection, pinnedResult] = await Promise.all([
    getExtendedSidebarUser(session),
    getCachedGoogleDriveConnection(),
    session?.user
      ? getPinnedItems()
      : Promise.resolve({ success: true as const, data: [] }),
  ]);
  const pinnedItems = "data" in pinnedResult ? (pinnedResult.data ?? []) : [];
  const emailUnverified = session?.user ? !session.user.emailVerified : false;
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
        bio: user.bio,
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
        driveConnection={driveConnection}
        pinnedItems={pinnedItems}
      />
      <SidebarInset className="bg-transparent lg:overflow-hidden">
        <main
          id="main-content"
          tabIndex={-1}
          className="@container/main flex min-h-full flex-col overflow-y-auto pb-16 outline-none lg:pb-0"
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </SidebarInset>

      {/* Mobile footer navigation (hidden on desktop) */}
      <MobileNavProvider
        user={mobileNavUser}
        driveConnection={driveConnection}
        emailUnverified={emailUnverified}
        driveNeedsReauth={driveNeedsReauth}
      />
    </SidebarProvider>
  );

  // Always wrap to maintain consistent component tree depth
  // Spotlight search only shows for authenticated users via context
  return <MyItemsProviders>{content}</MyItemsProviders>;
}
