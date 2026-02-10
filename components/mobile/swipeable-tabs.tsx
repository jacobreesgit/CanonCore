/**
 * Reusable horizontal swipeable tab component using Motion for React.
 * Designed for touch-first use in bottom sheets.
 * Supports drag gestures, keyboard navigation, lazy rendering,
 * and WCAG 2.1 Level A accessibility.
 */

"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";

/** Tab configuration for SwipeableTabs. */
export interface SwipeableTab {
  /** Unique identifier for the tab. */
  id: string;
  /** Display label for the tab button. */
  label: string;
  /** Optional icon displayed before the label. */
  icon?: LucideIcon;
  /** Content rendered in the tab panel. */
  content: ReactNode;
}

interface SwipeableTabsProps {
  /** Array of tab configurations. */
  tabs: SwipeableTab[];
  /** Currently active tab ID. */
  activeTab: string;
  /** Callback when active tab changes. */
  onTabChange: (id: string) => void;
  /** Accessible label for the tablist. */
  ariaLabel?: string;
  /** When true, only renders tab content after it has been visited. */
  lazy?: boolean;
  /** Additional className for the container. */
  className?: string;
}

/** Spring animation config for tab transitions. */
const SPRING_CONFIG = { type: "spring" as const, stiffness: 300, damping: 30 };

/** Swipe threshold in pixels. */
const SWIPE_THRESHOLD = 75;

/** Velocity threshold in px/s for fast flicks. */
const VELOCITY_THRESHOLD = 500;

/**
 * Horizontal swipeable tab component with Motion for React gestures.
 * Provides tab bar with sliding indicator, swipe navigation, and full
 * keyboard accessibility (arrow keys, Home/End).
 *
 * @param tabs - Tab configurations with id, label, icon, and content
 * @param activeTab - Currently selected tab ID
 * @param onTabChange - Callback when tab selection changes
 * @param ariaLabel - Accessible label for the tab list
 * @param lazy - When true, only renders tab content after first visit
 * @param className - Additional styling for the container
 */
export function SwipeableTabs({
  tabs,
  activeTab,
  onTabChange,
  ariaLabel = "Tabs",
  lazy = false,
  className,
}: SwipeableTabsProps) {
  const instanceId = useId();
  const prefersReducedMotion = usePrefersReducedMotion();
  const tablistRef = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState("");
  const [direction, setDirection] = useState(1);

  // Track which tabs have been visited (for lazy rendering)
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(
    () => new Set([activeTab])
  );

  const activeIndex = tabs.findIndex((t) => t.id === activeTab);

  /**
   * Navigates to a tab by index and announces the change.
   */
  const navigateToIndex = useCallback(
    (index: number) => {
      const tab = tabs[index];
      if (tab) {
        const currentIndex = tabs.findIndex((t) => t.id === activeTab);
        setDirection(index >= currentIndex ? 1 : -1);
        onTabChange(tab.id);
        setAnnouncement(`${tab.label} tab selected`);
        if (lazy) {
          setVisitedTabs((prev) => {
            if (prev.has(tab.id)) return prev;
            const next = new Set(prev);
            next.add(tab.id);
            return next;
          });
        }
        // Focus the tab button
        const tabButton = tablistRef.current?.querySelector(
          `[data-tab-index="${index}"]`
        ) as HTMLButtonElement | null;
        tabButton?.focus();
      }
    },
    [tabs, activeTab, onTabChange, lazy]
  );

  /**
   * Handles keyboard navigation within the tab bar.
   */
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          nextIndex = activeIndex < tabs.length - 1 ? activeIndex + 1 : 0;
          break;
        case "ArrowLeft":
          e.preventDefault();
          nextIndex = activeIndex > 0 ? activeIndex - 1 : tabs.length - 1;
          break;
        case "Home":
          e.preventDefault();
          nextIndex = 0;
          break;
        case "End":
          e.preventDefault();
          nextIndex = tabs.length - 1;
          break;
      }

      if (nextIndex !== null) {
        navigateToIndex(nextIndex);
      }
    },
    [activeIndex, tabs.length, navigateToIndex]
  );

  /**
   * Handles drag end to determine tab change from swipe gesture.
   */
  const handleDragEnd = useCallback(
    (
      _event: MouseEvent | TouchEvent | PointerEvent,
      info: { offset: { x: number }; velocity: { x: number } }
    ) => {
      const { offset, velocity } = info;

      const swipedLeft =
        offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD;
      const swipedRight =
        offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD;

      if (swipedLeft && activeIndex < tabs.length - 1) {
        navigateToIndex(activeIndex + 1);
      } else if (swipedRight && activeIndex > 0) {
        navigateToIndex(activeIndex - 1);
      }
    },
    [activeIndex, tabs.length, navigateToIndex]
  );

  const getTabId = (tabId: string) => `${instanceId}-tab-${tabId}`;
  const getPanelId = (tabId: string) => `${instanceId}-panel-${tabId}`;

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Tab bar */}
      <div
        ref={tablistRef}
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          "relative flex border-b border-white/[0.06]",
          "bg-white/[0.02]"
        )}
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={getTabId(tab.id)}
              role="tab"
              aria-selected={isActive}
              aria-controls={getPanelId(tab.id)}
              tabIndex={isActive ? 0 : -1}
              data-tab-index={index}
              onClick={() => navigateToIndex(index)}
              onKeyDown={handleTabKeyDown}
              className={cn(
                "relative flex flex-1 items-center justify-center gap-1.5 px-3 py-3",
                "text-sm font-medium",
                "transition-colors duration-150",
                "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
                "min-h-[44px]",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/80"
              )}
            >
              {Icon && <Icon aria-hidden="true" className="size-4 shrink-0" />}
              <span>{tab.label}</span>
            </button>
          );
        })}
        {/* Sliding indicator */}
        {activeIndex >= 0 && (
          <motion.div
            className="bg-primary absolute bottom-0 left-0 h-0.5"
            style={{ width: `${100 / tabs.length}%` }}
            animate={{ x: `${activeIndex * 100}%` }}
            transition={prefersReducedMotion ? { duration: 0 } : SPRING_CONFIG}
          />
        )}
      </div>

      {/* Content panels */}
      <div className="relative flex-1 overflow-hidden" data-vaul-no-drag>
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={activeTab}
            className="overflow-y-auto"
            custom={direction}
            initial={
              prefersReducedMotion ? false : { x: direction * 100, opacity: 0 }
            }
            animate={{ x: 0, opacity: 1 }}
            exit={
              prefersReducedMotion
                ? undefined
                : { x: direction * -100, opacity: 0 }
            }
            transition={prefersReducedMotion ? { duration: 0 } : SPRING_CONFIG}
            drag={prefersReducedMotion ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
          >
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab;
              const shouldRender = lazy
                ? isActive || visitedTabs.has(tab.id)
                : true;

              return (
                <div
                  key={tab.id}
                  id={getPanelId(tab.id)}
                  role="tabpanel"
                  aria-labelledby={getTabId(tab.id)}
                  tabIndex={0}
                  className={cn(isActive ? "block" : "hidden", "px-1 py-4")}
                >
                  {shouldRender ? tab.content : null}
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Screen reader announcement */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}

export default SwipeableTabs;
