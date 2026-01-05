/**
 * Protected layout with sidebar navigation for authenticated users.
 * Protects all child routes with authentication check.
 */

import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { MyItemsProviders } from "@/components/my-items-providers";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth, extractSidebarUser } from "@/lib/auth";

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

  const user = extractSidebarUser(session)!;

  return (
    <MyItemsProviders>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" user={user} context="my-items" />
        <SidebarInset>
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </MyItemsProviders>
  );
}
