import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/ui/section";

export function ExploreContentSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero carousel area — exact match to CinematicHero multi-slide mode */}
      <div
        data-testid="skeleton-hero"
        className="relative flex min-h-[calc(55vh+var(--header-height))] w-full flex-col bg-[var(--dark-900)] md:min-h-[calc(65vh+var(--header-height))] lg:block lg:h-[calc(65vh+var(--header-height))] lg:min-h-0 lg:overflow-hidden"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--dark-900) 0%, color-mix(in srgb, var(--dark-900) 70%, transparent) 20%, transparent 55%)",
          }}
          aria-hidden="true"
        />

        {/* Content at bottom — multi-slide uses pb-16 md:pb-20 */}
        <div className="pointer-events-none relative z-10 mt-auto pt-[30vh] md:pt-[40vh] lg:absolute lg:inset-x-0 lg:bottom-0 lg:mt-0 lg:pt-0">
          <div className="px-[var(--section-px-mobile)] pb-16 sm:px-[var(--section-px-sm)] md:px-[var(--section-px-md)] md:pb-20 lg:px-[var(--section-px-lg)] xl:px-[var(--section-px-xl)] 2xl:px-[var(--section-px-2xl)]">
            <Skeleton className="h-[80px] w-[220px] rounded-md sm:h-[100px] sm:w-[280px] md:h-[120px] md:w-[350px] lg:h-[140px] lg:w-[400px]" />
            <Skeleton className="mt-4 h-4 w-48 md:w-64" />
            <Skeleton className="mt-3 h-4 w-80 max-w-full md:w-96" />
            <div className="mt-6 flex gap-3">
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
          </div>
        </div>

        {/* Carousel dot indicators */}
        <div
          data-testid="skeleton-dots"
          className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2"
        >
          <Skeleton className="h-2 w-6 rounded-full" />
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-2 w-2 rounded-full" />
        </div>
      </div>

      {/* Tabs — matches UnderlineTabs: flex gap-8 */}
      <Section>
        <div className="flex gap-8">
          <Skeleton className="my-4 h-5 w-24" />
          <Skeleton className="my-4 h-5 w-20" />
        </div>
      </Section>

      {/* ContentToolbar — glassmorphism container */}
      <Section className="py-4">
        <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2">
          <Skeleton className="h-11 w-28 rounded-md lg:h-[34px]" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </Section>

      {/* Poster grid (12 cards) */}
      <Section className="pb-8">
        <div className="grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
          ))}
        </div>
      </Section>
    </div>
  );
}
