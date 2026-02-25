"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";

import { HeroButton } from "@/components/items/hero-button";
import { MediaStack } from "./media-stack";
import { GradientText } from "./gradient-text";
import styles from "./hero-section.module.css";

export function HeroSection() {
  return (
    <section className={styles.heroWrapper}>
      <div className={styles.heroContentWrapper}>
        {/* Text — cols 1-4 on desktop, full width on mobile */}
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl">
              Your media library.
              <br />
              <GradientText
                colors={["#a78bfa", "#c084fc", "#e879f9", "#818cf8"]}
                animationSpeed={6}
              >
                Elevated.
              </GradientText>
            </h1>

            <p className="text-muted-foreground max-w-sm text-lg leading-relaxed">
              Organise, stream, and share your personal media collection, synced
              with Google Drive.
            </p>
          </div>

          <ul className={styles.primaryButtons}>
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
        </div>

        {/* Images — cols 8-16 on desktop, full width on mobile */}
        <div className={styles.graphicWrapper}>
          <MediaStack />
        </div>
      </div>
    </section>
  );
}
