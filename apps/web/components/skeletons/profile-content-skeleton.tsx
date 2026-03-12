import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/ui/section";
import { ShelfSkeleton } from "@/components/homepage/shelf-skeleton";

export function ProfileContentSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero — exact match to CinematicHero single-slide profile mode */}
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

        <div className="pointer-events-none relative z-10 mt-auto pt-[30vh] md:pt-[40vh] lg:absolute lg:inset-x-0 lg:bottom-0 lg:mt-0 lg:pt-0">
          <div className="px-[var(--section-px-mobile)] pb-8 sm:px-[var(--section-px-sm)] md:px-[var(--section-px-md)] md:pb-12 lg:px-[var(--section-px-lg)] xl:px-[var(--section-px-xl)] 2xl:px-[var(--section-px-2xl)]">
            <div className="flex flex-col items-center gap-4 md:flex-row md:items-end md:gap-8">
              <div className="relative shrink-0">
                <div className="relative rounded-full bg-gradient-to-b from-white/20 via-white/8 to-white/4 p-[3px]">
                  <Skeleton className="size-28 rounded-full ring-1 ring-white/10 sm:size-32 md:size-44 lg:size-48" />
                </div>
              </div>
              <div className="min-w-0 text-center md:flex-1 md:pb-1 md:text-left">
                <Skeleton className="h-8 w-48 sm:h-10 sm:w-56 md:h-12 md:w-72" />
                <Skeleton className="mt-2 h-5 w-28 md:w-32" />
                {/* Bio — matches line-clamp-2 text-sm leading-relaxed */}
                <Skeleton className="mx-auto mt-3 h-5 w-full max-w-2xl md:mx-0" />
                <Skeleton className="mx-auto mt-1.5 h-5 w-3/4 max-w-md md:mx-0" />
                {/* Watch progress — matches mt-5 max-w-xs flex-col gap-2 */}
                <div className="mx-auto mt-5 flex max-w-xs flex-col gap-2 md:mx-0">
                  <Skeleton className="h-1 w-full max-w-[400px] rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Section>
        <div className="flex gap-8">
          <Skeleton className="my-4 h-5 w-14" />
          <Skeleton className="my-4 h-5 w-18" />
        </div>
      </Section>

      <Section className="py-4">
        <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2 lg:gap-3">
          <div className="flex items-center gap-2 lg:gap-3">
            <Skeleton className="h-11 w-20 rounded-md lg:h-[34px]" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
          <div className="flex items-center gap-2 lg:gap-3">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        </div>
      </Section>

      {/* Search input skeleton — below toolbar, full width */}
      <Section className="pt-2 pb-0">
        <Skeleton className="h-9 w-full rounded-md" />
      </Section>

      <Section className="py-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
          ))}
        </div>
      </Section>

      <ShelfSkeleton />
    </div>
  );
}
