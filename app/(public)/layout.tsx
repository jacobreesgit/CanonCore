/**
 * Public layout with sidebar for unauthenticated pages.
 * Used by homepage and docs pages.
 */

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth, extractSidebarUser } from "@/lib/auth";

/**
 * Wraps public pages with sidebar and header.
 * Shows guest navigation for unauthenticated users.
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
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
      <AppSidebar variant="inset" user={user} context="home" />
      <SidebarInset>
        <SiteHeader title="Home" titleHref="/" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
