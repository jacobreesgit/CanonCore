import { SiteHeader } from "@/components/site-header";
import { PlaylistContentSkeleton } from "@/components/skeletons/playlist-content-skeleton";

export default function Loading() {
  return (
    <>
      <SiteHeader title="My Playlists" />
      <div className="bg-background text-foreground flex flex-1 flex-col">
        <PlaylistContentSkeleton />
      </div>
    </>
  );
}
