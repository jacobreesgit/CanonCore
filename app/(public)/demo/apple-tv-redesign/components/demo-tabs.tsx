/**
 * Minimal underline-style tabs for Contents/About switcher.
 * Apple TV+ inspired tab design.
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface DemoTab {
  /** Unique tab ID. */
  id: string;
  /** Tab label. */
  label: string;
  /** Tab content. */
  content: React.ReactNode;
}

interface DemoTabsProps {
  /** Tab definitions. */
  tabs: DemoTab[];
  /** Default active tab ID. */
  defaultTab?: string;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Minimal underline tabs for switching between content sections.
 */
export function DemoTabs({ tabs, defaultTab, className }: DemoTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const activeContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className={className}>
      {/* Tab list */}
      <div
        className={cn("flex gap-6 border-b border-[var(--atv-border)]", "mb-6")}
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative pb-3",
              "text-sm font-medium tracking-[0.2em] uppercase",
              "transition-colors duration-150",
              activeTab === tab.id
                ? "text-[var(--atv-text-primary)]"
                : "text-[var(--atv-text-tertiary)] hover:text-[var(--atv-text-secondary)]",
              "focus-visible:outline-none"
            )}
          >
            {tab.label}

            {/* Active underline */}
            {activeTab === tab.id && (
              <span
                className={cn(
                  "absolute inset-x-0 bottom-0 h-0.5",
                  "bg-[var(--atv-progress)]"
                )}
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab panel */}
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={activeTab}
      >
        {activeContent}
      </div>
    </div>
  );
}
