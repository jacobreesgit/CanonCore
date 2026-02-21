# Homepage Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace CanonCore's text-only landing page with a cinematic, Payload-inspired homepage with 8 sections — hero (video BG), logo bar, use cases, testimonials, feature accordion, manifesto CTA, and footer.

**Architecture:** All sections render inside the existing `SidebarInset` content area. New components live in `components/homepage/`. The page is a single client component orchestrating 6+ section components. Payload's assets (video, images, textures) are used as placeholders. No new dependencies.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS 4, Framer Motion, Embla Carousel (already installed)

**Design Doc:** `docs/plans/2026-02-19-homepage-redesign-design.md`

**Reference Repo:** `_payload-ref/` (shallow clone of payloadcms/website, MIT licensed)

---

## Task 1: Copy Texture Assets from Payload Repo

**Files:**
- Copy: `_payload-ref/public/images/scanline-light.png` -> `public/images/scanline-light.png`
- Copy: `_payload-ref/public/images/noise.png` -> `public/images/noise.png`

**Step 1: Copy texture files**

```bash
cp _payload-ref/public/images/scanline-light.png public/images/scanline-light.png
cp _payload-ref/public/images/noise.png public/images/noise.png
```

**Step 2: Verify files exist**

```bash
ls -la public/images/scanline-light.png public/images/noise.png
```

Expected: Both files listed with sizes (scanline ~83B, noise ~328KB).

**Step 3: Commit**

```bash
git add public/images/scanline-light.png public/images/noise.png
git commit -m "chore: add texture assets from Payload (MIT) for homepage"
```

---

## Task 2: Build Background Effect Components

**Files:**
- Create: `components/homepage/background-video.tsx`
- Create: `components/homepage/background-grid.tsx`
- Create: `components/homepage/background-scanline.tsx`

These are small, reusable visual-only components with no business logic. No tests needed — they're purely decorative.

**Step 1: Create BackgroundVideo**

```tsx
// components/homepage/background-video.tsx
"use client";

import { cn } from "@/lib/utils";

interface BackgroundVideoProps {
  src: string;
  className?: string;
}

export function BackgroundVideo({ src, className }: BackgroundVideoProps) {
  return (
    <video
      autoPlay
      loop
      muted
      playsInline
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full object-cover",
        className
      )}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
```

**Step 2: Create BackgroundGrid**

Port from Payload's `BackgroundGrid`. Creates 5 vertical column lines with gradient fade-in.

```tsx
// components/homepage/background-grid.tsx
import { cn } from "@/lib/utils";

interface BackgroundGridProps {
  className?: string;
}

export function BackgroundGrid({ className }: BackgroundGridProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
      aria-hidden="true"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 w-px"
          style={{
            left: `${(i + 1) * (100 / 6)}%`,
            background:
              "linear-gradient(to bottom, transparent 0px, rgba(255, 255, 255, 0.125) 240px)",
          }}
        />
      ))}
    </div>
  );
}
```

**Step 3: Create BackgroundScanline**

```tsx
// components/homepage/background-scanline.tsx
import { cn } from "@/lib/utils";

interface BackgroundScanlineProps {
  className?: string;
}

export function BackgroundScanline({ className }: BackgroundScanlineProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 opacity-[0.08]",
        className
      )}
      aria-hidden="true"
      style={{
        backgroundImage: "url('/images/scanline-light.png')",
        backgroundRepeat: "repeat",
      }}
    />
  );
}
```

**Step 4: Commit**

```bash
git add components/homepage/background-video.tsx components/homepage/background-grid.tsx components/homepage/background-scanline.tsx
git commit -m "feat: add background effect components (video, grid, scanline)"
```

---

## Task 3: Build Hero Section

**Files:**
- Create: `components/homepage/hero-section.tsx`

The hero occupies the full viewport height (minus header), with layered background effects and content overlay.

**Step 1: Create HeroSection**

```tsx
// components/homepage/hero-section.tsx
"use client";

import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { HeroButton } from "@/components/items/hero-button";
import { BackgroundVideo } from "./background-video";
import { BackgroundGrid } from "./background-grid";
import { BackgroundScanline } from "./background-scanline";

const HERO_VIDEO_URL =
  "https://l4wlsi8vxy8hre4v.public.blob.vercel-storage.com/video/glass-animation-5-f0gPcjmKFIV3ot5MGOdNy2r4QHBoXt.mp4";

const ease = [0.25, 0.46, 0.45, 0.94] as const;

export function HeroSection() {
  const { data: session } = useSession();
  const username = session?.user?.username as string | undefined;

  return (
    <section className="relative flex min-h-[calc(100dvh-4rem)] items-end overflow-hidden pb-16 md:pb-24">
      {/* Background layers */}
      <BackgroundVideo src={HERO_VIDEO_URL} />
      <BackgroundGrid />
      <BackgroundScanline />
      {/* Noise texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        aria-hidden="true"
        style={{
          backgroundImage: "url('/images/noise.png')",
          backgroundRepeat: "repeat",
        }}
      />
      {/* Bottom gradient for text readability */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full px-6 md:px-10 lg:px-16">
        <motion.h1
          className="max-w-2xl text-4xl leading-[1.08] font-semibold tracking-tight text-white md:text-5xl lg:text-6xl"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease }}
        >
          The backend to build the modern web.
        </motion.h1>

        <motion.div
          className="mt-8 flex flex-wrap items-center gap-4"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease }}
        >
          <HeroButton variant="primary" asChild>
            <Link href={username ? `/u/${username}` : "/sign-up"}>
              Get Started
            </Link>
          </HeroButton>
          <HeroButton asChild className="group">
            <Link href="/explore">
              Explore Collections
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </HeroButton>
        </motion.div>
      </div>
    </section>
  );
}
```

**Step 2: Verify it renders**

Temporarily import `HeroSection` in `app/(public)/landing-hero.tsx` in place of existing content to visually check.

**Step 3: Commit**

```bash
git add components/homepage/hero-section.tsx
git commit -m "feat: add hero section with video background and grid effects"
```

---

## Task 4: Build Logo Bar Section

**Files:**
- Create: `components/homepage/logo-bar.tsx`

Uses placeholder company logos from Payload's CDN. These are `<img>` tags (external URLs, not Next.js Image) since they're temporary placeholders.

**Step 1: Create LogoBar**

```tsx
// components/homepage/logo-bar.tsx
"use client";

import { motion } from "motion/react";

const PLACEHOLDER_LOGOS = [
  { name: "Microsoft", src: "https://payloadcms.com/images/logos/microsoft.svg" },
  { name: "Cloudflare", src: "https://payloadcms.com/images/logos/cloudflare.svg" },
  { name: "Blue Origin", src: "https://payloadcms.com/images/logos/blue-origin.svg" },
  { name: "Bugatti", src: "https://payloadcms.com/images/logos/bugatti.svg" },
  { name: "Hello Bello", src: "https://payloadcms.com/images/logos/hello-bello.svg" },
  { name: "Fanatics", src: "https://payloadcms.com/images/logos/fanatics.svg" },
];

export function LogoBar() {
  return (
    <section className="border-y border-white/10 py-16 md:py-20">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <motion.p
          className="text-muted-foreground mb-10 text-base md:text-lg"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Payload is the open-source Next.js backend used in production by the
          most innovative companies on earth.
        </motion.p>
        <motion.div
          className="flex flex-wrap items-center justify-center gap-8 md:gap-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {PLACEHOLDER_LOGOS.map((logo) => (
            <img
              key={logo.name}
              src={logo.src}
              alt={logo.name}
              className="h-6 opacity-60 grayscale transition-opacity hover:opacity-100 md:h-8"
              loading="lazy"
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
```

Note: The logo URLs are placeholders. If Payload doesn't serve logos at those paths, we'll need to extract them from the cloned repo or use generic SVG rectangles. Check and adjust URLs as needed during implementation.

**Step 2: Commit**

```bash
git add components/homepage/logo-bar.tsx
git commit -m "feat: add logo bar section with placeholder company logos"
```

---

## Task 5: Build Use Cases Section

**Files:**
- Create: `components/homepage/use-cases-section.tsx`

Interactive vertical tab navigation with image swap.

**Step 1: Create UseCasesSection**

```tsx
// components/homepage/use-cases-section.tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const USE_CASES = [
  {
    title: "Headless CMS",
    description:
      "Build beautiful, content-driven websites with a live preview that shows changes in real time.",
    image: "https://payloadcms.com/images/use-cases/headless-cms.jpg",
  },
  {
    title: "Headless eCommerce",
    description:
      "Power your storefront with a flexible product catalogue, inventory management, and checkout flows.",
    image: "https://payloadcms.com/images/use-cases/ecommerce.jpg",
  },
  {
    title: "Enterprise App Builder",
    description:
      "Build internal tools, dashboards, and enterprise workflows with a fully customisable admin panel.",
    image: "https://payloadcms.com/images/use-cases/enterprise.jpg",
  },
  {
    title: "Digital Asset Management",
    description:
      "Organise, tag, and distribute media assets across your organisation with fine-grained access control.",
    image: "https://payloadcms.com/images/use-cases/dam.jpg",
  },
];

export function UseCasesSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.h2
          className="mb-4 text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Code-first for developers.
          <br />
          Content-first for marketers.
        </motion.h2>
        <motion.p
          className="text-muted-foreground mb-12 text-lg"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Use Payload to build anything. Or everything.
        </motion.p>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
          {/* Left — tab list */}
          <div className="flex flex-col gap-2">
            {USE_CASES.map((useCase, i) => (
              <button
                key={useCase.title}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "rounded-lg px-4 py-4 text-left text-xl font-medium transition-colors md:text-2xl",
                  i === activeIndex
                    ? "bg-white/5 text-white"
                    : "text-muted-foreground hover:text-white/80"
                )}
              >
                {useCase.title}
                {i === activeIndex && (
                  <p className="text-muted-foreground mt-2 text-sm font-normal md:text-base">
                    {useCase.description}
                  </p>
                )}
              </button>
            ))}
            <a
              href="/explore"
              className="text-muted-foreground hover:text-foreground mt-4 inline-flex items-center gap-2 text-sm transition-colors"
            >
              Explore collections
              <ArrowRight className="size-4" />
            </a>
          </div>

          {/* Right — image */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-white/10 bg-white/5">
            <AnimatePresence mode="wait">
              <motion.img
                key={activeIndex}
                src={USE_CASES[activeIndex].image}
                alt={USE_CASES[activeIndex].title}
                className="absolute inset-0 h-full w-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
```

Note: Image URLs are placeholders. If they 404, replace with solid colored rectangles or screenshots from `_payload-ref`.

**Step 2: Commit**

```bash
git add components/homepage/use-cases-section.tsx
git commit -m "feat: add use cases section with interactive tabs"
```

---

## Task 6: Build Testimonials Carousel

**Files:**
- Create: `components/homepage/testimonials-carousel.tsx`

Uses Embla Carousel (already a project dependency).

**Step 1: Create TestimonialsCarousel**

```tsx
// components/homepage/testimonials-carousel.tsx
"use client";

import { useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const TESTIMONIALS = [
  {
    quote:
      "Utilizing Payload enabled us to implement our digital postcards tool quickly and easily, engaging thousands of K-12 students.",
    author: "Heather Nelson",
    role: "Director",
    company: "Blue Origin",
  },
  {
    quote:
      "Building with Payload can be done quickly and effectively, thanks to its code-based customization and developer-friendly features.",
    author: "Sowmya Reddy Peta",
    role: "Engineer",
    company: "Microsoft",
  },
  {
    quote:
      "Payload had all the core features we needed to get started quickly, and the flexibility to make it our own as we build a world-class editing experience.",
    author: "Matt Dean",
    role: "Sr. Engineer",
    company: "Hello Bello",
  },
  {
    quote:
      "We were impressed by the built-in flexibility and extensibility that kept our development workflow agile and in sync with marketing needs.",
    author: "Duncan Van Keulen",
    role: "Developer",
    company: "Tekton",
  },
  {
    quote:
      "What we found so user-friendly was how simple the UI was to edit and manage content. Things were not hidden behind code.",
    author: "Frank Shi",
    role: "Co-founder",
    company: "Paper Triangles",
  },
];

export function TestimonialsCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
  });

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.h2
          className="mb-12 max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          From Fortune 500 companies to indie devs, Payload is the answer to
          &lsquo;build vs. buy.&rsquo;
        </motion.h2>
      </div>

      {/* Carousel — full-width overflow */}
      <div className="overflow-hidden pl-6 md:pl-10 lg:pl-16" ref={emblaRef}>
        <div className="flex gap-4">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.author}
              className={cn(
                "min-w-[80vw] shrink-0 md:min-w-[55vw] lg:min-w-[40vw]",
                "rounded-xl border border-white/10 bg-white/[0.03] p-8 md:p-10",
                "flex flex-col justify-between"
              )}
            >
              <blockquote className="mb-8 text-lg leading-relaxed text-white/90 md:text-xl">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <div>
                <p className="font-medium text-white">{t.author}</p>
                <p className="text-muted-foreground text-sm">
                  {t.role}, {t.company}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mx-auto mt-6 flex max-w-6xl gap-2 px-6">
        <button
          onClick={scrollPrev}
          aria-label="Previous testimonial"
          className="rounded-full border border-white/20 p-2 transition-colors hover:bg-white/10"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          onClick={scrollNext}
          aria-label="Next testimonial"
          className="rounded-full border border-white/20 p-2 transition-colors hover:bg-white/10"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </section>
  );
}
```

**Step 2: Commit**

```bash
git add components/homepage/testimonials-carousel.tsx
git commit -m "feat: add testimonials carousel with Embla"
```

---

## Task 7: Build Feature Accordion Section

**Files:**
- Create: `components/homepage/feature-accordion.tsx`

Two-column: accordion on left, image on right. One item open at a time.

**Step 1: Create FeatureAccordion**

```tsx
// components/homepage/feature-accordion.tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    title: "Next.js Native",
    description:
      "Get a full backend seamlessly built into your Next.js app.",
    image: "https://payloadcms.com/images/features/nextjs-native.jpg",
  },
  {
    title: "Visual Editing",
    description:
      "Effortlessly build and visualize the look and feel of your content.",
    image: "https://payloadcms.com/images/features/visual-editing.jpg",
  },
  {
    title: "RAG + Vector Embedding",
    description:
      "Payload automatically gets your content RAG-ready with zero manual effort.",
    image: "https://payloadcms.com/images/features/rag.jpg",
  },
  {
    title: "Define your schema in code",
    description:
      "Skip the hassle of building your own admin panel or using an ORM.",
    image: "https://payloadcms.com/images/features/schema.jpg",
  },
];

export function FeatureAccordion() {
  const [expandedIndex, setExpandedIndex] = useState(0);

  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.h3
          className="mb-12 text-3xl font-semibold tracking-tight md:text-4xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Meet the CMS from the future
        </motion.h3>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
          {/* Left — accordion */}
          <div className="flex flex-col">
            {FEATURES.map((feature, i) => {
              const isExpanded = i === expandedIndex;
              return (
                <button
                  key={feature.title}
                  onClick={() => setExpandedIndex(i)}
                  aria-expanded={isExpanded}
                  className={cn(
                    "border-b border-white/10 py-5 text-left",
                    "transition-colors",
                    isExpanded ? "text-white" : "text-muted-foreground hover:text-white/80"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium md:text-xl">
                      {feature.title}
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-5 shrink-0 transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <p className="text-muted-foreground mt-2 text-sm md:text-base">
                          {feature.description}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              );
            })}
          </div>

          {/* Right — image */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-white/10 bg-white/5">
            <AnimatePresence mode="wait">
              <motion.img
                key={expandedIndex}
                src={FEATURES[expandedIndex].image}
                alt={FEATURES[expandedIndex].title}
                className="absolute inset-0 h-full w-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Commit**

```bash
git add components/homepage/feature-accordion.tsx
git commit -m "feat: add feature accordion section with image swap"
```

---

## Task 8: Build Manifesto CTA Section

**Files:**
- Create: `components/homepage/manifesto-cta.tsx`

Centered copy block with dual CTA buttons.

**Step 1: Create ManifestoCTA**

```tsx
// components/homepage/manifesto-cta.tsx
"use client";

import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { HeroButton } from "@/components/items/hero-button";

export function ManifestoCTA() {
  return (
    <section className="py-20 md:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <motion.h2
          className="mb-8 text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          We&rsquo;re building a better way.
        </motion.h2>

        <motion.div
          className="text-muted-foreground mb-12 space-y-6 text-base leading-relaxed md:text-lg"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <p>
            The current wave of content platforms has brought big promises but
            fallen short on flexibility, locking teams into closed ecosystems and
            boxing in developers.
          </p>
          <p className="text-white font-medium">Payload marks a new era.</p>
          <p>
            Open source isn&rsquo;t just a feature &mdash; it&rsquo;s freedom.
            Freedom for everything from freelance projects to large-scale
            enterprise needs, giving developers the control to build as they
            need, while equipping marketers to create on their terms.
          </p>
          <p className="text-white font-semibold">
            With Payload, finally build something you truly own.
          </p>
        </motion.div>

        <motion.div
          className="flex flex-wrap items-center justify-center gap-4"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <HeroButton variant="primary" asChild>
            <Link href="/sign-up">
              Get Started
              <ArrowRight className="size-4" />
            </Link>
          </HeroButton>
          <HeroButton asChild>
            <Link href="/explore">
              Explore Collections
              <ArrowRight className="size-4" />
            </Link>
          </HeroButton>
        </motion.div>
      </div>
    </section>
  );
}
```

**Step 2: Commit**

```bash
git add components/homepage/manifesto-cta.tsx
git commit -m "feat: add manifesto CTA section"
```

---

## Task 9: Build Site Footer

**Files:**
- Create: `components/homepage/site-footer.tsx`

4-column grid footer. This is the first real footer for CanonCore.

**Step 1: Create SiteFooter**

```tsx
// components/homepage/site-footer.tsx
import Link from "next/link";

const FOOTER_COLUMNS = [
  {
    title: "Use Cases",
    links: [
      { label: "Content Management", href: "/docs" },
      { label: "Media Library", href: "/docs" },
      { label: "Google Drive Sync", href: "/docs/google-drive/sync-files" },
      { label: "Public Sharing", href: "/docs/sharing/public-profile" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Community Help", href: "/docs" },
      {
        label: "GitHub",
        href: "https://github.com/jacobrees/canoncore-v2",
        external: true,
      },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Explore", href: "/explore" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-xs font-medium uppercase tracking-widest text-white/60">
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Stay Connected */}
          <div>
            <h4 className="mb-4 text-xs font-medium uppercase tracking-widest text-white/60">
              Stay Connected
            </h4>
            <p className="text-muted-foreground mb-4 text-sm">
              Subscribe to our newsletter for updates.
            </p>
            <form
              className="flex gap-2"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="email"
                placeholder="Enter your email"
                className="bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/30 flex-1 min-w-0"
              />
              <button
                type="submit"
                className="rounded-md border border-white/20 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="text-muted-foreground mt-16 border-t border-white/10 pt-6 text-center text-xs">
          &copy; {new Date().getFullYear()} CanonCore. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
```

**Step 2: Commit**

```bash
git add components/homepage/site-footer.tsx
git commit -m "feat: add site footer with 4-column grid layout"
```

---

## Task 10: Build Homepage Orchestrator and Wire It Up

**Files:**
- Create: `components/homepage/homepage-content.tsx`
- Modify: `app/(public)/landing-hero.tsx` — Replace contents with new homepage
- Modify: `app/(public)/page.tsx` — Minor adjustments if needed

This task assembles all sections into the final page.

**Step 1: Create HomepageContent orchestrator**

```tsx
// components/homepage/homepage-content.tsx
"use client";

import { HeroSection } from "./hero-section";
import { LogoBar } from "./logo-bar";
import { UseCasesSection } from "./use-cases-section";
import { TestimonialsCarousel } from "./testimonials-carousel";
import { FeatureAccordion } from "./feature-accordion";
import { ManifestoCTA } from "./manifesto-cta";
import { SiteFooter } from "./site-footer";

export function HomepageContent() {
  return (
    <div className="bg-background">
      <HeroSection />
      <LogoBar />
      <UseCasesSection />
      <TestimonialsCarousel />
      <FeatureAccordion />
      <ManifestoCTA />
      <SiteFooter />
    </div>
  );
}
```

**Step 2: Replace landing-hero.tsx**

Replace the entire `HeroContent` export in `app/(public)/landing-hero.tsx` with a re-export from the new orchestrator:

```tsx
// app/(public)/landing-hero.tsx
"use client";

export { HomepageContent as HeroContent } from "@/components/homepage/homepage-content";
```

This keeps the server component import in `page.tsx` unchanged.

**Step 3: Run dev server and verify**

```bash
pnpm run dev
```

Open `http://localhost:3000` and verify:
- Hero with video background, grid lines, scanlines, noise
- Logo bar with placeholder logos
- Use cases with tab switching
- Testimonial carousel scrolling
- Feature accordion expanding/collapsing
- Manifesto CTA section
- Footer

**Step 4: Commit**

```bash
git add components/homepage/homepage-content.tsx app/(public)/landing-hero.tsx
git commit -m "feat: wire up all homepage sections into landing page"
```

---

## Task 11: Quality Gate

**Step 1: Run type check**

```bash
pnpm run type-check
```

Expected: PASS (no type errors)

**Step 2: Run lint**

```bash
pnpm run lint
```

Expected: PASS

**Step 3: Run format**

```bash
pnpm run format
```

**Step 4: Fix any issues found in steps 1-3**

Address lint/type errors. Common issues:
- Unused imports
- Missing `_` prefix on unused params
- `img` vs Next.js `Image` lint warnings (acceptable for external placeholder URLs)

**Step 5: Commit fixes**

```bash
git add -A
git commit -m "chore: fix lint and type-check issues"
```

---

## Task 12: Clean Up Payload Reference Repo

**Step 1: Remove the cloned reference**

```bash
rm -rf _payload-ref
```

**Step 2: Verify it's gone and not tracked**

```bash
ls _payload-ref 2>&1  # Should error
git status             # Should show nothing related to _payload-ref
```

**Step 3: Commit if .gitignore needs updating**

If `_payload-ref` somehow got tracked, add it to `.gitignore`. Otherwise, no commit needed.

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Copy texture assets | `public/images/` |
| 2 | Background effects (video, grid, scanline) | `components/homepage/background-*.tsx` |
| 3 | Hero section | `components/homepage/hero-section.tsx` |
| 4 | Logo bar | `components/homepage/logo-bar.tsx` |
| 5 | Use cases tabs | `components/homepage/use-cases-section.tsx` |
| 6 | Testimonials carousel | `components/homepage/testimonials-carousel.tsx` |
| 7 | Feature accordion | `components/homepage/feature-accordion.tsx` |
| 8 | Manifesto CTA | `components/homepage/manifesto-cta.tsx` |
| 9 | Site footer | `components/homepage/site-footer.tsx` |
| 10 | Wire up + landing page swap | `components/homepage/homepage-content.tsx`, `app/(public)/landing-hero.tsx` |
| 11 | Quality gate | (lint, type-check, format) |
| 12 | Clean up reference repo | Remove `_payload-ref/` |
