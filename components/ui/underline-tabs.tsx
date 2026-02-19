/**
 * Minimal underline-style tabs for content section switcher.
 * Underline tab design with full ARIA support.
 * All panels stay mounted (inactive panels use `hidden`) to preserve React
 * state across tab switches.
 */

"use client";

import { useEffect, useRef, useState } from "react";
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
  /** Default active tab ID (uncontrolled mode). */
  defaultTab?: string;
  /** Currently active tab ID (controlled mode). */
  activeTab?: string;
  /** Callback when active tab changes (controlled mode). */
  onTabChange?: (id: string) => void;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Minimal underline tabs for switching between content sections.
 * Supports keyboard navigation with arrow keys, Home, and End.
 * All panels remain in the DOM (inactive panels use `hidden`) so React state
 * is preserved across tab switches.
 *
 * Works in both controlled (`activeTab` + `onTabChange`) and uncontrolled
 * (`defaultTab`) modes.
 */
export function UnderlineTabs({
  tabs,
  defaultTab,
  activeTab: activeTabProp,
  onTabChange,
  className,
}: UnderlineTabsProps) {
  const [internalTab, setInternalTab] = useState(defaultTab || tabs[0]?.id);
  const activeTab = activeTabProp ?? internalTab;
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const prevTabRef = useRef(activeTab);

  // Restore scroll position after DOM updates for the new tab
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      window.scrollTo(0, scrollPositionsRef.current[activeTab] ?? 0);
      prevTabRef.current = activeTab;
    }
  }, [activeTab]);

  const switchTab = (newId: string) => {
    if (newId !== activeTab) {
      // Save scroll position BEFORE state change hides the current panel
      scrollPositionsRef.current[activeTab] = window.scrollY;
      if (onTabChange) {
        onTabChange(newId);
      } else {
        setInternalTab(newId);
      }
    }
  };

  return (
    <div className={className}>
      {/* Tab list — Section provides consistent horizontal padding */}
      <Section>
        <div className="flex gap-8" role="tablist">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              tabIndex={activeTab === tab.id ? 0 : -1}
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => switchTab(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  const next = tabs[(index + 1) % tabs.length];
                  switchTab(next.id);
                  document.getElementById(`tab-${next.id}`)?.focus();
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  const prev = tabs[(index - 1 + tabs.length) % tabs.length];
                  switchTab(prev.id);
                  document.getElementById(`tab-${prev.id}`)?.focus();
                } else if (e.key === "Home") {
                  e.preventDefault();
                  const first = tabs[0];
                  switchTab(first.id);
                  document.getElementById(`tab-${first.id}`)?.focus();
                } else if (e.key === "End") {
                  e.preventDefault();
                  const last = tabs[tabs.length - 1];
                  switchTab(last.id);
                  document.getElementById(`tab-${last.id}`)?.focus();
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

      {/* All panels rendered; inactive panels hidden to preserve state */}
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`tabpanel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== activeTab}
          className="min-h-[50vh]"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
