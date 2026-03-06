import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/ui/section";

export function ItemContentSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero backdrop — exact match to CinematicHero single-slide item mode */}
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

        {/* Content at bottom — single-slide uses pb-8 md:pb-12 */}
        <div className="pointer-events-none relative z-10 mt-auto pt-[30vh] md:pt-[40vh] lg:absolute lg:inset-x-0 lg:bottom-0 lg:mt-0 lg:pt-0">
          <div className="px-[var(--section-px-mobile)] pb-8 sm:px-[var(--section-px-sm)] md:px-[var(--section-px-md)] md:pb-12 lg:px-[var(--section-px-lg)] xl:px-[var(--section-px-xl)] 2xl:px-[var(--section-px-2xl)]">
            <Skeleton className="h-10 w-64 md:h-14 md:w-96" />
            <Skeleton className="mt-5 h-5 w-80 max-w-full md:w-[28rem]" />
            <Skeleton className="mt-4 h-4 w-48 md:w-64" />
            <div className="mt-6 flex gap-3">
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs — matches UnderlineTabs: Contents / About */}
      <Section>
        <div className="flex gap-8">
          <Skeleton className="my-4 h-5 w-20" />
          <Skeleton className="my-4 h-5 w-14" />
        </div>
      </Section>

      {/* ContentToolbar — glassmorphism container */}
      <Section className="py-4">
        <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-11 w-20 rounded-md lg:h-[34px]" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        </div>
      </Section>

      {/* Children grid (6 cards) — matches grid-view-content.tsx breakpoints */}
      <Section className="py-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
          ))}
        </div>
      </Section>
    </div>
  );
}
