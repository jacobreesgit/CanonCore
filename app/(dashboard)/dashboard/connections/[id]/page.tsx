/**
 * Connection detail page displaying SFTP folder contents.
 * Shows synced content stats and root-level items with sync/upload capabilities.
 */

import { notFound } from "next/navigation";
import { Folder, Film, ImageIcon, FileText, Server } from "lucide-react";
import { ItemsView } from "@/components/items";
import { getSftpConnection, getItemsByConnection } from "@/lib/sftp-actions";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface ConnectionDetailPageProps {
  params: Promise<{ id: string }>;
}

/** Stat item for the synced content display. */
interface StatItemProps {
  value: number;
  label: string;
  icon: React.ReactNode;
  accentColor: string;
}

/** Individual stat with cinematic styling. */
function StatItem({ value, label, icon, accentColor }: StatItemProps) {
  return (
    <div className="group relative flex flex-col items-center gap-2 p-4">
      {/* Ambient glow on hover */}
      <div
        className={cn(
          "absolute inset-0 opacity-0 blur-xl transition-opacity duration-500",
          "group-hover:opacity-20",
          accentColor
        )}
      />

      {/* Icon with subtle ring */}
      <div
        className={cn(
          "relative flex size-12 items-center justify-center rounded-full",
          "bg-gradient-to-br from-white/5 to-white/0",
          "ring-1 ring-white/10",
          "transition-all duration-300",
          "group-hover:shadow-lg group-hover:ring-white/20"
        )}
      >
        {icon}
      </div>

      {/* Value with theatrical typography */}
      <p
        className={cn(
          "relative text-3xl font-light tracking-tight",
          "bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent"
        )}
      >
        {value.toLocaleString()}
      </p>

      {/* Label */}
      <p className="text-muted-foreground/70 text-xs font-medium tracking-widest uppercase">
        {label}
      </p>
    </div>
  );
}

/**
 * Renders the SFTP connection root folder view.
 * Displays synced content stats and items at the connection's base path.
 */
export default async function ConnectionDetailPage({
  params,
}: ConnectionDetailPageProps) {
  const { id } = await params;

  // Verify user is authenticated
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  // Verify connection exists and user owns it
  const connectionResult = await getSftpConnection(id);
  if (!connectionResult.success || !connectionResult.data) {
    notFound();
  }

  const connection = connectionResult.data;

  // Get synced content stats in parallel
  const [itemsResult, folderCount, fileStats] = await Promise.all([
    getItemsByConnection(id, null),
    prisma.item.count({
      where: { connectionId: id, userId: session.user.id },
    }),
    prisma.itemFile.groupBy({
      by: ["fileType"],
      where: { item: { connectionId: id, userId: session.user.id } },
      _count: true,
    }),
  ]);

  const items = itemsResult.success ? (itemsResult.data ?? []) : [];

  // Extract counts by file type
  const mediaCount = fileStats.find((s) => s.fileType === "MEDIA")?._count ?? 0;
  const artworkCount =
    fileStats.find((s) => s.fileType === "ARTWORK")?._count ?? 0;
  const subtitleCount =
    fileStats.find((s) => s.fileType === "SUBTITLE")?._count ?? 0;
  const totalFiles = mediaCount + artworkCount + subtitleCount;

  // Breadcrumbs: just the connection name at root level
  const breadcrumbs = [{ id, name: connection.name }];

  const hasContent = folderCount > 0 || totalFiles > 0;

  return (
    <div className="flex flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
      {/* Synced Content Stats Card - Only show if there's synced content */}
      {hasContent && (
        <div
          className={cn(
            "relative overflow-hidden rounded-xl",
            // Dark cinematic background
            "bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-900/80",
            // Subtle border
            "ring-1 ring-white/5"
          )}
        >
          {/* Film grain texture overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.015] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Ambient gradient accents */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background: `
                radial-gradient(ellipse at 0% 0%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse at 100% 100%, rgba(139, 92, 246, 0.06) 0%, transparent 50%)
              `,
            }}
          />

          {/* Header */}
          <div className="relative border-b border-white/5 px-6 py-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg",
                  "from-primary/20 to-primary/5 bg-gradient-to-br",
                  "ring-primary/20 ring-1"
                )}
              >
                <Server className="text-primary size-4" />
              </div>
              <div>
                <h2 className="text-foreground/90 text-sm font-medium">
                  Synced Content
                </h2>
                <p className="text-muted-foreground/60 text-xs">
                  {connection.name}
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="relative grid grid-cols-2 divide-x divide-white/5 sm:grid-cols-4">
            <StatItem
              value={folderCount}
              label="Folders"
              icon={<Folder className="size-5 text-amber-400/80" />}
              accentColor="bg-amber-500"
            />
            <StatItem
              value={mediaCount}
              label="Media"
              icon={<Film className="size-5 text-blue-400/80" />}
              accentColor="bg-blue-500"
            />
            <StatItem
              value={artworkCount}
              label="Artwork"
              icon={<ImageIcon className="size-5 text-emerald-400/80" />}
              accentColor="bg-emerald-500"
            />
            <StatItem
              value={subtitleCount}
              label="Subtitles"
              icon={<FileText className="size-5 text-violet-400/80" />}
              accentColor="bg-violet-500"
            />
          </div>
        </div>
      )}

      {/* Items View */}
      <ItemsView
        items={items}
        parentId={null}
        connectionId={id}
        breadcrumbs={breadcrumbs}
      />
    </div>
  );
}
