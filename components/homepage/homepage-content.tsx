"use client";

import { MeshGradient } from "@mesh-gradient/react";
import { LazyMotion } from "motion/react";

const loadFeatures = () =>
  import("@/lib/motion-features").then((res) => res.default);

import Link from "next/link";

import { BackgroundScanline } from "./background-scanline";
import { HeroSection } from "./hero-section";
import { FeatureAccordion } from "./feature-accordion";
import { ManifestoCta } from "./manifesto-cta";

export function HomepageContent() {
  return (
    <LazyMotion features={loadFeatures} strict>
      <div>
        {/* Sticky background — stays pinned at top of scroll container */}
        <div className="sticky top-0 z-0 h-svh overflow-hidden">
          <MeshGradient
            className="absolute inset-0 h-full w-full"
            options={{
              colors: ["#0f0c29", "#302b63", "#24243e", "#6b21a8"],
              animationSpeed: 0.4,
              seed: 5,
            }}
          />
          <BackgroundScanline />

          {/* Noise texture — CSS-generated to avoid 328KB image load */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            aria-hidden="true"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundRepeat: "repeat",
              backgroundSize: "256px 256px",
            }}
          />

          {/* Bottom gradient */}
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background:
                "linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, transparent 60%)",
            }}
          />
        </div>

        {/* Content — pulls up over sticky bg, then scrolls past */}
        <div className="relative z-10 -mt-[100svh]">
          <HeroSection />
          <div>
            <FeatureAccordion />
            <ManifestoCta />
            <footer className="text-muted-foreground py-6 text-center text-sm">
              <div className="flex items-center justify-center gap-4">
                <Link
                  href="/legal/privacy-policy"
                  className="transition-colors hover:text-white"
                >
                  Privacy Policy
                </Link>
                <span className="text-white/20">·</span>
                <Link
                  href="/legal/terms-of-service"
                  className="transition-colors hover:text-white"
                >
                  Terms of Service
                </Link>
                <span className="text-white/20">·</span>
                <Link
                  href="/legal/cookie-policy"
                  className="transition-colors hover:text-white"
                >
                  Cookie Policy
                </Link>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </LazyMotion>
  );
}
