/**
 * Minimal underline-style tabs for content section switcher.
 * Underline tab design with full ARIA support.
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Section } from "@/components/ui/section";

interface Tab {
  /** Unique tab ID. */
  id: string;
  /** Tab label. */
  label: string;
  /** Tab content. */
  content: React.ReactNode;
}

interface UnderlineTabsProps {
  /** Tab definitions. */
  tabs: Tab[];
  /** Default active tab ID. */
  defaultTab?: string;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Minimal underline tabs for switching between content sections.
 * Supports keyboard navigation with arrow keys.
 */
export function UnderlineTabs({
  tabs,
  defaultTab,
  className,
}: UnderlineTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const activeContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className={className}>
      {/* Tab list — Section provides consistent horizontal padding */}
      <Section>
        <div className="flex gap-8" role="tablist">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              data-testid={`tab-${tab.id}`}
              role="tab"
              tabIndex={activeTab === tab.id ? 0 : -1}
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  const next = tabs[(index + 1) % tabs.length];
                  setActiveTab(next.id);
                  document.getElementById(`tab-${next.id}`)?.focus();
                } else if (e.key === "ArrowLeft") {
                  const prev = tabs[(index - 1 + tabs.length) % tabs.length];
                  setActiveTab(prev.id);
                  document.getElementById(`tab-${prev.id}`)?.focus();
                }
              }}
              className={cn(
                "relative cursor-pointer py-4",
                "text-sm font-medium tracking-[0.15em] uppercase",
                "transition-colors duration-200",
                activeTab === tab.id
                  ? "text-foreground"
                  : "hover:text-muted-foreground text-[var(--tertiary-foreground)]",
                "focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:outline-none"
              )}
            >
              {tab.label}

              {/* Active underline */}
              {activeTab === tab.id && (
                <span
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-0.5",
                    "bg-primary"
                  )}
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
      </Section>

      {/* Tab panel */}
      <div
        id={`tabpanel-${activeTab}`}
        data-testid={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeContent}
      </div>
    </div>
  );
}
