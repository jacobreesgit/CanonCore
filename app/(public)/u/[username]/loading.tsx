import { SiteHeader } from "@/components/site-header";
import { ProfileContentSkeleton } from "@/components/skeletons/profile-content-skeleton";

export default function Loading() {
  return (
    <>
      <SiteHeader title="Items" />
      <div className="bg-background text-foreground -mt-(--header-height) flex flex-1 flex-col">
        <ProfileContentSkeleton />
      </div>
    </>
  );
}
