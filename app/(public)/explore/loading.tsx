import { SiteHeader } from "@/components/site-header";
import { ExploreContentSkeleton } from "@/components/skeletons/explore-content-skeleton";

export default function Loading() {
  return (
    <>
      <SiteHeader title="Explore" titleHref="/explore" />
      <div className="text-foreground -mt-(--header-height) flex flex-1 flex-col">
        <ExploreContentSkeleton />
      </div>
    </>
  );
}
