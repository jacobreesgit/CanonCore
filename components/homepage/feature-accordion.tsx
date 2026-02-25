"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import * as m from "motion/react-m";

const FEATURES = [
  {
    title: "Google Drive Native",
    description:
      "Your media stays in Google Drive. CanonCore reads it directly. No uploads, no migrations, no storage limits. Connect once and your entire library is ready.",
    image: "/images/06-google-drive-sync.webp",
    learnMoreHref: "/docs/google-drive/sync-files",
  },
  {
    title: "Cinema-Grade Metadata",
    description:
      "One click pulls posters, backdrops, cast, genres, and ratings from TMDB. Every item in your library gets the treatment it deserves.",
    image: "/images/04-tmdb-wizard.webp",
    learnMoreHref: "/docs/files-and-folders/item-settings",
  },
  {
    title: "Curate with Playlists",
    description:
      "Group items into themed playlists \u2014 weekend watchlists, all-time favourites, or anything you like. Drag to reorder, add custom artwork, and share publicly or via private link.",
    image: "/images/09-playlist-detail.webp",
    learnMoreHref: "/docs/playlists/create-playlist",
  },
  {
    title: "Instant Spotlight Search",
    description:
      "Hit \u2318K and find anything in your library instantly. Spotlight searches across titles, genres, and metadata \u2014 no scrolling, no hunting.",
    image: "/images/08-spotlight-search.webp",
    learnMoreHref: "/docs/files-and-folders/navigation",
  },
  {
    title: "Built to Share",
    description:
      "Go public with your profile, curate playlists, and let others fork your collections. Forking copies an entire library structure into someone else\u2019s account \u2014 they get their own editable version while yours stays untouched.",
    image: "/images/32-fork-dialog.webp",
    learnMoreHref: "/docs/sharing/public-profile",
  },
];

export function FeatureAccordion() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section className="relative py-24 md:py-32">
      <div className="px-6 md:px-10 lg:px-16">
        {/* Desktop: proper two-column grid — image left, accordion right */}
        <div className="hidden lg:grid lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-16">
          {/* Left — image showcase */}
          <div>
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-1.5 shadow-[0_2rem_4rem_-1rem_rgba(0,0,0,0.5)]">
              {/* Top-edge glow */}
              <div
                className="pointer-events-none absolute -inset-px rounded-xl opacity-30"
                aria-hidden="true"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.2), transparent 60%)",
                }}
              />
              <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-[#0a0a0a]">
                {FEATURES.map((feature, index) => (
                  <m.div
                    key={feature.title}
                    className="absolute inset-0 h-full w-full"
                    animate={{ opacity: index === activeIndex ? 1 : 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <Image
                      src={feature.image}
                      alt={feature.title}
                      width={1200}
                      height={800}
                      sizes="(max-width: 1024px) 0px, 58vw"
                      className="h-full w-full object-cover"
                    />
                  </m.div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — heading + button list + content panel (flex, zero layout shift) */}
          <div>
            <m.h3
              className="mb-10 text-3xl font-semibold tracking-tight text-white md:text-4xl"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              Your complete media command centre.
            </m.h3>

            {/* Button list — stable, no content inside, zero layout shift */}
            {FEATURES.map((feature, index) => (
              <button
                key={feature.title}
                onClick={() => setActiveIndex(index)}
                className={`flex w-full cursor-pointer items-center border-b border-l-2 border-white/10 py-4 pl-4 text-left transition-colors ${
                  index === activeIndex
                    ? "border-l-white"
                    : "border-l-transparent"
                }`}
              >
                <span
                  className={`text-sm font-medium ${
                    index === activeIndex
                      ? "text-white"
                      : "text-muted-foreground"
                  }`}
                >
                  {feature.title}
                </span>
              </button>
            ))}

            {/* Content panel — grid stack so height = tallest feature, zero shift */}
            <div className="grid pt-5">
              {FEATURES.map((feature, index) => (
                <div
                  key={feature.title}
                  className={`col-start-1 row-start-1 transition-opacity duration-300 ${
                    index === activeIndex
                      ? "opacity-100"
                      : "pointer-events-none opacity-0"
                  }`}
                >
                  <p className="text-muted-foreground pb-2 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                  <Link
                    href={feature.learnMoreHref}
                    className="group mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white"
                  >
                    Learn more
                    <FontAwesomeIcon
                      icon={faArrowRight}
                      className="size-3 transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile/tablet: vertical stack — image then accordion */}
        <div className="lg:hidden">
          <m.h3
            className="mb-10 text-3xl font-semibold tracking-tight text-white md:text-4xl"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            Your complete media command centre.
          </m.h3>

          {/* Image */}
          <div className="relative mb-10 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-1">
            <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-[#0a0a0a]">
              {FEATURES.map((feature, index) => (
                <div
                  key={feature.title}
                  className={
                    index === 0
                      ? "relative h-full w-full transition-opacity duration-500"
                      : "absolute inset-0 h-full w-full transition-opacity duration-500"
                  }
                  style={{ opacity: index === activeIndex ? 1 : 0 }}
                >
                  <Image
                    src={feature.image}
                    alt={feature.title}
                    width={1200}
                    height={800}
                    sizes="calc(100vw - 3rem)"
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Button list — stable, zero layout shift */}
          {FEATURES.map((feature, index) => (
            <button
              key={feature.title}
              onClick={() => setActiveIndex(index)}
              className={`flex w-full cursor-pointer items-center border-b border-l-2 border-white/10 py-4 pl-4 text-left transition-colors ${
                index === activeIndex
                  ? "border-l-white"
                  : "border-l-transparent"
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  index === activeIndex ? "text-white" : "text-muted-foreground"
                }`}
              >
                {feature.title}
              </span>
            </button>
          ))}

          {/* Content panel — grid stack, zero shift */}
          <div className="grid pt-5">
            {FEATURES.map((feature, index) => (
              <div
                key={feature.title}
                className={`col-start-1 row-start-1 transition-opacity duration-300 ${
                  index === activeIndex
                    ? "opacity-100"
                    : "pointer-events-none opacity-0"
                }`}
              >
                <p className="text-muted-foreground pb-2 text-sm leading-relaxed">
                  {feature.description}
                </p>
                <Link
                  href={feature.learnMoreHref}
                  className="group mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white"
                >
                  Learn more
                  <FontAwesomeIcon
                    icon={faArrowRight}
                    className="size-3 transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
