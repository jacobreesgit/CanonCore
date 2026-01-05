/**
 * SFTP connections list page.
 * Displays all user connections with management options.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSftpConnections } from "@/lib/sftp-actions";
import { ConnectionCard } from "@/components/sftp/connection-card";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Plus, Server, Cable } from "lucide-react";

export default async function ConnectionsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const result = await getSftpConnections();
  const connections = result.success ? (result.data ?? []) : [];

  return (
    <>
      <SiteHeader title="Connections" titleHref="/my-items/connections" />
      <div className="container mx-auto space-y-8 p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              SFTP Connections
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage your SFTP server connections for file synchronization
            </p>
          </div>
          {connections.length > 0 && (
            <Button asChild>
              <Link href="/my-items/connections/new">
                <Plus className="mr-2 size-4" />
                Add Connection
              </Link>
            </Button>
          )}
        </div>

        {/* Connections Grid */}
        {connections.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {connections.map((connection) => (
              <ConnectionCard
                key={connection.id}
                connection={{
                  ...connection,
                  authType: connection.authType as "PASSWORD" | "PRIVATE_KEY",
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
            <div className="bg-muted flex size-16 items-center justify-center rounded-full">
              <Cable className="text-muted-foreground size-8" />
            </div>
            <h3 className="mt-4 text-lg font-medium">No connections yet</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Add your first SFTP connection to start syncing files
            </p>
            <Button asChild className="mt-6">
              <Link href="/my-items/connections/new">
                <Server className="mr-2 size-4" />
                Add Your First Connection
              </Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
