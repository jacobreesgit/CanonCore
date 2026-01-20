/**
 * Public layout with sidebar for unauthenticated pages.
 * Used by homepage, explore, and public profiles.
 * Includes spotlight search for authenticated users.
 */

import { AppSidebar } from "@/components/app-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth, getExtendedSidebarUser } from "@/lib/auth";
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
      <AppSidebar variant="inset" user={user} context="home" />
      <SidebarInset className="overflow-hidden">
        <main
          id="main-content"
          tabIndex={-1}
          className="@container/main flex min-h-full flex-col overflow-y-auto outline-none"
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );

  // Wrap with spotlight provider for authenticated users
  return user ? <MyItemsProviders>{content}</MyItemsProviders> : content;
}
