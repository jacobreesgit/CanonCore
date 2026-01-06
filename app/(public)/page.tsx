/**
 * Public landing page.
 * Displays hero section with background pattern and call-to-action.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

/**
 * Renders the landing page with hero content and navigation buttons.
 * Shows different CTAs based on authentication state.
 */
export default async function LandingPage() {
  const session = await auth();
  const isAuthenticated = !!session?.user;

  return (
    <section className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* Background Pattern */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `
            radial-gradient(circle 600px at 0% 200px, oklch(from var(--primary) calc(l * 0.7) calc(c * 0.6) h / 0.15), transparent),
            radial-gradient(circle 600px at 100% 200px, oklch(from var(--primary) calc(l * 0.75) calc(c * 0.65) h / 0.12), transparent)
          `,
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        <div className="container">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center">
            <div className="max-w-3xl">
              <h1
                data-testid="landing-hero-title"
                className="text-foreground mb-6 text-4xl font-medium tracking-tight text-pretty md:text-5xl lg:text-6xl"
              >
                Welcome to CanonCore
              </h1>
              <p className="text-muted-foreground mx-auto max-w-2xl font-light tracking-tighter text-pretty md:text-lg lg:text-xl">
                Your all-in-one platform for managing and streaming your media
                library. Organize movies, TV shows, and music with powerful item
                hierarchies and SFTP sync.
              </p>
            </div>

            <Button asChild data-testid="landing-cta-button">
              <Link href={isAuthenticated ? "/my-items" : "/sign-in"}>
                {isAuthenticated ? "Go to My Items" : "Get Started"}
                <ArrowRight className="ml-2 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
