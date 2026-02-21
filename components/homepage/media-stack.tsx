"use client";

import Image from "next/image";
import * as m from "motion/react-m";

const IMAGE_1 = "/images/google-drive-sync-laptop.webp";
const IMAGE_2 = "/images/explore.webp";

const glassClasses =
  "p-1 bg-white/10 border border-white/5 rounded-lg backdrop-blur-[2rem] shadow-[0_3rem_4rem_1rem_rgba(0,0,0,0.5)]";
const innerImgClasses = "rounded-sm border border-white/5 bg-[#141414]";

const EASE = [0, 0.2, 0.2, 1] as const;

export function MediaStack({ priority = false }: { priority?: boolean }) {
  return (
    <div className="relative w-full pt-[10%]">
      {/* Image 1 — top-right, higher z-index, enters first */}
      <m.div
        className={`absolute top-0 right-0 z-10 w-[85%] ${glassClasses}`}
        initial={{ opacity: 0, y: "4rem" }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 2, delay: 0.5, ease: EASE }}
      >
        <Image
          src={IMAGE_1}
          alt="CanonCore item detail page with cinematic metadata"
          width={1440}
          height={900}
          sizes="(max-width: 1024px) 70vw, 50vw"
          priority={priority}
          className={innerImgClasses}
        />
      </m.div>

      {/* Image 2 — bottom-left, creates natural height, enters second */}
      <m.div
        className={`relative -left-[8%] z-0 w-[85%] ${glassClasses}`}
        initial={{ opacity: 0, y: "4rem" }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 3, delay: 1, ease: EASE }}
      >
        <Image
          src={IMAGE_2}
          alt="CanonCore explore page with public collections"
          width={1440}
          height={900}
          sizes="(max-width: 1024px) 70vw, 50vw"
          loading={priority ? "eager" : "lazy"}
          className={innerImgClasses}
        />
      </m.div>
    </div>
  );
}
