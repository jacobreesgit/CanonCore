/**
 * Public layout with sidebar for unauthenticated pages.
 * Used by homepage. Includes spotlight search for authenticated users.
 */

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth, extractSidebarUser } from "@/lib/auth";
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
  const user = extractSidebarUser(session);

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
        <div className="@container/main flex min-h-full flex-col overflow-y-auto">
          <SiteHeader title="Home" titleHref="/" />
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );

  // Wrap with spotlight provider for authenticated users
  return user ? <MyItemsProviders>{content}</MyItemsProviders> : content;
}
