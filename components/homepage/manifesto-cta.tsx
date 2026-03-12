"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import * as m from "motion/react-m";

import { HeroButton } from "@/components/items/hero-button";

export function ManifestoCta() {
  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center md:px-10 lg:px-16">
        <m.h2
          className="text-3xl font-semibold tracking-tight text-balance text-white md:text-4xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          Your files. Your library. Your rules.
        </m.h2>

        <m.div
          className="text-muted-foreground mt-8 space-y-4 text-lg leading-relaxed"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <p>
            Media libraries shouldn&rsquo;t be locked inside walled gardens.
            Your movies, shows, and music already live on your Google
            Drive&mdash;CanonCore simply brings them to life.
          </p>
          <p>
            Rich metadata from TMDB. Progress tracking across devices. Public
            profiles and playlists to share what you love.
          </p>
          <p>
            <strong className="font-semibold text-white">
              No subscriptions. No lock-in. Just your collection, elevated.
            </strong>
          </p>
        </m.div>

        <m.div
          className="mt-10 flex flex-wrap justify-center gap-4"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <HeroButton variant="primary" asChild>
            <Link href="/sign-up">
              Get Started
              <FontAwesomeIcon
                icon={faArrowRight}
                className="size-3.5"
                aria-hidden="true"
              />
            </Link>
          </HeroButton>

          <HeroButton variant="secondary" asChild>
            <Link href="/explore">
              Explore Collections
              <FontAwesomeIcon
                icon={faArrowRight}
                className="size-3.5"
                aria-hidden="true"
              />
            </Link>
          </HeroButton>
        </m.div>
      </div>
    </section>
  );
}
