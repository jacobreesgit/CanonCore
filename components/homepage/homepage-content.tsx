"use client";

import { useState, useEffect } from "react";
import { MeshGradient } from "@mesh-gradient/react";
import { LazyMotion } from "motion/react";

const loadFeatures = () =>
  import("@/lib/motion-features").then((res) => res.default);

import Link from "next/link";

import { BackgroundScanline } from "./background-scanline";
import { HeroSection } from "./hero-section";
import { FeatureAccordion } from "./feature-accordion";
import { ManifestoCta } from "./manifesto-cta";

type ColorTuple = [string, string, string, string];

const PALETTES: ColorTuple[] = [
  ["#0f0c29", "#302b63", "#24243e", "#6b21a8"], // purple
  ["#0a1628", "#0c2d48", "#1a3a5c", "#0891b2"], // ocean
  ["#0a1f0a", "#064e3b", "#115e59", "#10b981"], // emerald
  ["#1c1004", "#422006", "#78350f", "#d97706"], // amber
  ["#1a0a12", "#4c0519", "#881337", "#e11d48"], // rose
  ["#0c0a29", "#1e1b4b", "#312e81", "#4f46e5"], // indigo
];

const TEXT_PALETTES = [
  ["#a78bfa", "#c084fc", "#e879f9", "#818cf8"], // purple
  ["#67e8f9", "#22d3ee", "#06b6d4", "#38bdf8"], // ocean
  ["#6ee7b7", "#34d399", "#10b981", "#2dd4bf"], // emerald
  ["#fcd34d", "#fbbf24", "#f59e0b", "#fb923c"], // amber
  ["#fda4af", "#fb7185", "#f43f5e", "#e879f9"], // rose
  ["#a5b4fc", "#818cf8", "#6366f1", "#93c5fd"], // indigo
];

export function HomepageContent() {
  const [state, setState] = useState({
    layerA: PALETTES[0],
    layerB: PALETTES[1],
    textA: TEXT_PALETTES[0],
    textB: TEXT_PALETTES[1],
    active: "a" as "a" | "b",
    index: 0,
  });

  useEffect(() => {
    // Randomise starting palette on mount (avoids hydration mismatch).
    // Deferred via rAF to avoid synchronous setState in effect body.
    const start = Math.floor(Math.random() * PALETTES.length);
    const next = (start + 1) % PALETTES.length;
    const rafId = requestAnimationFrame(() => {
      setState({
        layerA: PALETTES[start],
        layerB: PALETTES[next],
        textA: TEXT_PALETTES[start],
        textB: TEXT_PALETTES[next],
        active: "a",
        index: start,
      });
    });

    const interval = setInterval(() => {
      setState((prev) => {
        const nextIndex = (prev.index + 1) % PALETTES.length;
        if (prev.active === "a") {
          return {
            ...prev,
            layerB: PALETTES[nextIndex],
            textB: TEXT_PALETTES[nextIndex],
            active: "b",
            index: nextIndex,
          };
        }
        return {
          ...prev,
          layerA: PALETTES[nextIndex],
          textA: TEXT_PALETTES[nextIndex],
          active: "a",
          index: nextIndex,
        };
      });
    }, 8000);
    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(interval);
    };
  }, []);

  return (
    <LazyMotion features={loadFeatures} strict>
      <div>
        {/* Sticky background — stays pinned at top of scroll container */}
        <div className="sticky top-0 z-0 h-svh overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              opacity: state.active === "a" ? 1 : 0,
              transition: "opacity 3s ease-in-out",
            }}
          >
            <MeshGradient
              className="h-full w-full"
              options={{
                colors: state.layerA,
                animationSpeed: 0.4,
                seed: 5,
              }}
            />
          </div>
          <div
            className="absolute inset-0"
            style={{
              opacity: state.active === "b" ? 1 : 0,
              transition: "opacity 3s ease-in-out",
            }}
          >
            <MeshGradient
              className="h-full w-full"
              options={{
                colors: state.layerB,
                animationSpeed: 0.4,
                seed: 5,
              }}
            />
          </div>
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
          <HeroSection
            textColorsA={state.textA}
            textColorsB={state.textB}
            activeLayer={state.active}
          />
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
