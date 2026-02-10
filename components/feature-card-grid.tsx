/**
 * Animated feature card grid with hover highlight effects.
 * Used on the landing page to showcase key product features.
 */

"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import React, { useState } from "react";

import { cn } from "@/lib/utils";

export interface FeatureItem {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  href?: string;
}

interface FeatureCardGridProps {
  items: FeatureItem[];
  className?: string;
}

const FeatureCardGrid = ({ items, className }: FeatureCardGridProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className={cn("w-full", className)}>
      <div className="relative grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, idx) => {
          const content = (
            <>
              <AnimatePresence mode="wait" initial={false}>
                {hoveredIndex === idx && (
                  <motion.span
                    className={cn(
                      "absolute inset-0 block h-full w-full rounded-2xl",
                      item.bgColor
                    )}
                    layoutId="hoverBackground"
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </AnimatePresence>

              <Card
                title={item.title}
                description={item.description}
                icon={item.icon}
                color={item.color}
                bgColor={item.bgColor}
              />
            </>
          );

          const sharedProps = {
            className: "group relative block h-full w-full cursor-pointer p-2",
            onMouseEnter: () => setHoveredIndex(idx),
            onMouseLeave: () => setHoveredIndex(null),
          };

          return item.href ? (
            <Link key={idx} href={item.href} {...sharedProps}>
              {content}
            </Link>
          ) : (
            <div key={idx} {...sharedProps}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { FeatureCardGrid };

const Card = ({
  className,
  title,
  description,
  bgColor,
  icon: Icon,
  color,
}: {
  className?: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
  color: string;
}) => {
  return (
    <div
      className={cn(
        "border-border/50 bg-background relative z-20 flex h-full flex-col items-start justify-start gap-2 rounded-3xl border p-5 shadow-sm",
        className
      )}
    >
      <div
        className={cn(
          "bg-background mb-4 flex size-15 items-center justify-center rounded-2xl md:mb-12",
          color,
          bgColor
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h3 className="text-xl font-medium tracking-tight">{title}</h3>
      <p className="text-muted-foreground/50 text-sm">{description}</p>
    </div>
  );
};
