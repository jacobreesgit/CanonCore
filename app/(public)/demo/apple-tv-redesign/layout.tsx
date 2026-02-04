/**
 * Layout for Apple TV+ redesign demo pages.
 * Provides scoped CSS custom properties for the cinematic aesthetic.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apple TV+ Redesign Demo | CanonCore",
  description: "Preview the Apple TV+ inspired redesign for CanonCore",
};

/**
 * Demo layout with Apple TV+ CSS variables.
 * Uses fragment to avoid wrapper div that breaks sticky header positioning.
 * Each page wraps its content in .apple-tv-demo to apply the theme.
 */
export default function AppleTVDemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .apple-tv-demo {
          /* ═══════════════════════════════════════════════════════════
             Colors - Dark Mode (Primary Experience)
             ═══════════════════════════════════════════════════════════ */
          --atv-bg: #0a0a0a;
          --atv-surface: #141414;
          --atv-text-primary: rgba(255, 255, 255, 0.95);
          --atv-text-secondary: rgba(255, 255, 255, 0.60);
          --atv-text-tertiary: rgba(255, 255, 255, 0.40);
          --atv-progress: white;
          --atv-border: rgba(255, 255, 255, 0.1);
          --atv-glow: 0 0 40px rgba(255, 255, 255, 0.05);

          /* ═══════════════════════════════════════════════════════════
             Spacing - Container Padding
             ═══════════════════════════════════════════════════════════ */
          --atv-px-mobile: 1.25rem;   /* 20px */
          --atv-px-sm: 2rem;          /* 32px */
          --atv-px-md: 2.5rem;        /* 40px */
          --atv-px-lg: 4rem;          /* 64px */
          --atv-px-xl: 5rem;          /* 80px */
          --atv-px-2xl: 6rem;         /* 96px */

          /* ═══════════════════════════════════════════════════════════
             Typography
             ═══════════════════════════════════════════════════════════ */
          --atv-font-display: "Geist", "SF Pro Display", "Inter var", system-ui, sans-serif;
          --atv-font-body: "Geist", "SF Pro Text", "Inter", system-ui, sans-serif;

          /* ═══════════════════════════════════════════════════════════
             Transitions
             ═══════════════════════════════════════════════════════════ */
          --atv-transition-fast: 150ms ease;
          --atv-transition-base: 300ms ease-out;
          --atv-transition-slow: 350ms ease-out;

          /* ═══════════════════════════════════════════════════════════
             Gradients
             ═══════════════════════════════════════════════════════════ */
          --atv-gradient-hero: linear-gradient(
            to top,
            rgba(10, 10, 10, 1) 0%,
            rgba(10, 10, 10, 0.8) 30%,
            rgba(10, 10, 10, 0.4) 50%,
            transparent 70%
          );
          --atv-gradient-card: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.9) 0%,
            rgba(0, 0, 0, 0.6) 40%,
            transparent 100%
          );
          --atv-gradient-top: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.3) 0%,
            transparent 100%
          );
        }

        /* ═══════════════════════════════════════════════════════════
           Light Mode Override
           ═══════════════════════════════════════════════════════════ */
        .light .apple-tv-demo {
          --atv-bg: #ffffff;
          --atv-surface: #fafafa;
          --atv-text-primary: rgba(0, 0, 0, 0.90);
          --atv-text-secondary: rgba(0, 0, 0, 0.60);
          --atv-text-tertiary: rgba(0, 0, 0, 0.40);
          --atv-progress: #0a0a0a;
          --atv-border: rgba(0, 0, 0, 0.1);
          --atv-glow: 0 4px 20px rgba(0, 0, 0, 0.08);
          --atv-gradient-hero: linear-gradient(
            to top,
            rgba(255, 255, 255, 1) 0%,
            rgba(255, 255, 255, 0.8) 30%,
            rgba(255, 255, 255, 0.4) 50%,
            transparent 70%
          );
        }

        /* ═══════════════════════════════════════════════════════════
           Reduced Motion
           ═══════════════════════════════════════════════════════════ */
        @media (prefers-reduced-motion: reduce) {
          .apple-tv-demo *,
          .apple-tv-demo *::before,
          .apple-tv-demo *::after {
            animation: none !important;
            transition: none !important;
          }
        }

        /* ═══════════════════════════════════════════════════════════
           Ken Burns Animation for Hero
           ═══════════════════════════════════════════════════════════ */
        @media (prefers-reduced-motion: no-preference) {
          .atv-ken-burns {
            animation: atv-ken-burns 20s ease-in-out infinite alternate;
          }
        }

        @keyframes atv-ken-burns {
          0% { transform: scale(1) translate(0, 0); }
          100% { transform: scale(1.05) translate(-1%, -1%); }
        }

        /* ═══════════════════════════════════════════════════════════
           Page Load Animation
           ═══════════════════════════════════════════════════════════ */
        @keyframes atv-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes atv-fade-in-up {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes atv-slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .atv-animate-fade-in {
          animation: atv-fade-in 350ms ease-out;
        }

        .atv-animate-slide-up {
          animation: atv-slide-up 350ms ease-out;
        }

        /* Staggered grid items (first 12 only) */
        .atv-stagger-grid > *:nth-child(-n+12) {
          animation: atv-fade-in-up 350ms ease-out backwards;
        }
        .atv-stagger-grid > *:nth-child(1) { animation-delay: 0ms; }
        .atv-stagger-grid > *:nth-child(2) { animation-delay: 40ms; }
        .atv-stagger-grid > *:nth-child(3) { animation-delay: 80ms; }
        .atv-stagger-grid > *:nth-child(4) { animation-delay: 120ms; }
        .atv-stagger-grid > *:nth-child(5) { animation-delay: 160ms; }
        .atv-stagger-grid > *:nth-child(6) { animation-delay: 200ms; }
        .atv-stagger-grid > *:nth-child(7) { animation-delay: 240ms; }
        .atv-stagger-grid > *:nth-child(8) { animation-delay: 280ms; }
        .atv-stagger-grid > *:nth-child(9) { animation-delay: 320ms; }
        .atv-stagger-grid > *:nth-child(10) { animation-delay: 360ms; }
        .atv-stagger-grid > *:nth-child(11) { animation-delay: 400ms; }
        .atv-stagger-grid > *:nth-child(12) { animation-delay: 440ms; }

        /* ═══════════════════════════════════════════════════════════
           Skeleton Shimmer
           ═══════════════════════════════════════════════════════════ */
        @keyframes atv-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .atv-skeleton {
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.05) 0%,
            rgba(255, 255, 255, 0.1) 50%,
            rgba(255, 255, 255, 0.05) 100%
          );
          background-size: 200% 100%;
          animation: atv-shimmer 1.5s infinite;
        }
      `,
        }}
      />
      {children}
    </>
  );
}
