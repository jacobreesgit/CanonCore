import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for shelves (used as Suspense fallback).
 */
export function ShelfSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <Section key={i} className="space-y-3 py-8 md:space-y-4">
          {/* Title skeleton */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          {/* Card skeletons — match ShelfRow: gap-4, calc-based widths, overflow-x-auto */}
          <div className="scrollbar-none -my-4 flex gap-4 overflow-x-auto overflow-y-hidden py-4">
            {Array.from({ length: 8 }).map((_, j) => (
              <Skeleton
                key={j}
                className="aspect-[2/3] w-[calc((100%-1rem)/2)] flex-shrink-0 rounded-lg md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-5rem)/6)]"
              />
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}
