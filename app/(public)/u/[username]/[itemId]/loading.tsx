import { SiteHeader } from "@/components/site-header";
import { ItemContentSkeleton } from "@/components/skeletons/item-content-skeleton";

export default function Loading() {
  return (
    <>
      <SiteHeader title="Items" />
      <div className="bg-background text-foreground -mt-(--header-height) flex flex-1 flex-col">
        <ItemContentSkeleton />
      </div>
    </>
  );
}
