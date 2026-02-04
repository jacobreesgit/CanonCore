/**
 * Watch providers section showing streaming service logos.
 * Uses real TMDB watch provider data.
 */

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { DemoWatchProvider } from "../lib/tmdb-demo";

interface DemoWatchProvidersProps {
  /** Watch providers from TMDB. */
  providers: DemoWatchProvider[];
  /** Section title. */
  title?: string;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Displays streaming service logos from TMDB watch providers.
 */
export function DemoWatchProviders({
  providers,
  title = "Where to Watch",
  className,
}: DemoWatchProvidersProps) {
  if (providers.length === 0) {
    return (
      <section className={className}>
        <h2
          className={cn(
            "mb-4 text-xs font-medium tracking-[0.2em] uppercase",
            "text-[var(--atv-text-tertiary)]"
          )}
        >
          {title}
        </h2>
        <p className="text-sm text-[var(--atv-text-tertiary)]">
          No streaming information available
        </p>
      </section>
    );
  }

  return (
    <section className={className}>
      <h2
        className={cn(
          "mb-4 text-xs font-medium tracking-[0.2em] uppercase",
          "text-[var(--atv-text-tertiary)]"
        )}
      >
        {title}
      </h2>

      <div className="flex flex-wrap gap-4">
        {providers.map((provider) => (
          <div
            key={provider.providerId}
            className={cn(
              "group flex flex-col items-center gap-2",
              "cursor-pointer"
            )}
            title={provider.providerName}
          >
            {/* Logo */}
            <div
              className={cn(
                "relative size-14 overflow-hidden rounded-xl",
                "bg-[var(--atv-surface)]",
                "ring-1 ring-white/10",
                "transition-all duration-200",
                "group-hover:scale-105 group-hover:ring-white/30"
              )}
            >
              <Image
                src={provider.logoPath}
                alt={provider.providerName}
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>

            {/* Name */}
            <span
              className={cn(
                "max-w-16 truncate text-center text-xs",
                "text-[var(--atv-text-tertiary)]"
              )}
            >
              {provider.providerName}
            </span>
          </div>
        ))}
      </div>

      {/* Attribution */}
      <p className="mt-3 text-xs text-[var(--atv-text-tertiary)]">
        Streaming data from{" "}
        <a
          href="https://www.justwatch.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[var(--atv-text-secondary)]"
        >
          JustWatch
        </a>
      </p>
    </section>
  );
}
