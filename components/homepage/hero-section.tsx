"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";

import { HeroButton } from "@/components/items/hero-button";
import { MediaStack } from "./media-stack";
import { GradientText } from "./gradient-text";

export function HeroSection() {
  return (
    <section className="relative min-h-svh overflow-hidden">
      {/* Text content — vertically centered on desktop, stacked on mobile */}
      <div className="relative z-10 flex min-h-[calc(100dvh-4rem)] items-center px-6 md:px-10 lg:px-16">
        <div className="w-full lg:max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight text-balance text-white md:text-5xl lg:text-6xl">
            Your media library.
            <br />
            <GradientText
              colors={["#a78bfa", "#c084fc", "#e879f9", "#818cf8"]}
              animationSpeed={6}
            >
              Elevated.
            </GradientText>
          </h1>

          <p className="text-muted-foreground mt-6 max-w-sm text-lg leading-relaxed">
            Organise, stream, and share your personal media collection — synced
            with Google Drive.
          </p>

          <ul className="mt-8 flex flex-wrap items-center gap-4">
            <li>
              <HeroButton variant="primary" asChild>
                <Link href="/sign-up" className="group">
                  Get Started
                  <FontAwesomeIcon
                    icon={faArrowRight}
                    className="size-3.5 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              </HeroButton>
            </li>
            <li>
              <HeroButton variant="secondary" asChild>
                <Link href="/explore" className="group">
                  Explore Collections
                  <FontAwesomeIcon
                    icon={faArrowRight}
                    className="size-3.5 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              </HeroButton>
            </li>
          </ul>

          {/* MediaStack — inline on mobile */}
          <div className="mt-10 lg:hidden">
            <MediaStack />
          </div>
        </div>
      </div>

      {/* MediaStack — absolute positioned on desktop, overflows right edge */}
      <div className="pointer-events-none absolute inset-y-0 left-[45%] hidden w-[75%] items-center lg:flex">
        <MediaStack priority />
      </div>
    </section>
  );
}
