/**
 * Protected layout with sidebar navigation for authenticated users.
 * Protects all child routes with authentication check.
 */

import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import { MyItemsProviders } from "@/components/my-items-providers";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth, getExtendedSidebarUser } from "@/lib/auth";
import { getGoogleDriveConnection } from "@/lib/google-drive-actions";
import { getPinnedItems } from "@/lib/item-actions";

/**
 * Wraps protected pages with sidebar and header.
 * Redirects unauthenticated users to sign-in.
 */
export default async function MyItemsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  // Server-side fetch for Drive connection, pinned items, and extended user data
  const [driveConnection, pinnedResult, user] = await Promise.all([
    getGoogleDriveConnection(),
    getPinnedItems(),
    getExtendedSidebarUser(session),
  ]);

  // This should never happen since we check session above, but TypeScript needs it
  if (!user) {
    redirect("/sign-in");
  }

  const pinnedItems = pinnedResult.success ? pinnedResult.data : [];

  return (
    <MyItemsProviders>
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
          context="my-items"
          driveConnection={driveConnection}
          pinnedItems={pinnedItems}
        />
        <SidebarInset className="overflow-hidden">
          <div className="@container/main flex min-h-full flex-col overflow-y-auto">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </MyItemsProviders>
  );
}
