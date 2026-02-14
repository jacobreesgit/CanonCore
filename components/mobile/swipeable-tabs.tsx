/**
 * Reusable horizontal swipeable tab component using Embla Carousel.
 * Designed for touch-first use in bottom sheets.
 * Supports swipe gestures, keyboard navigation, lazy rendering,
 * and WCAG 2.1 Level A accessibility.
 *
 * When more than 3 tabs are provided, automatically switches to a
 * Select dropdown mode for better usability on mobile.
 */

"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

/** Maximum number of tabs before switching to Select dropdown mode. */
const SELECT_THRESHOLD = 3;

/**
 * Horizontal swipeable tab component with Embla Carousel.
 * Provides tab bar with sliding indicator, swipe navigation, and full
 * keyboard accessibility (arrow keys, Home/End).
 *
 * Automatically switches to a Select dropdown when more than 3 tabs
 * are provided, improving usability on cramped mobile layouts.
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

  // Track which tabs have been visited (for lazy rendering)
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(
    () => new Set([activeTab])
  );

  const useSelectMode = tabs.length > SELECT_THRESHOLD;
  const activeIndex = tabs.findIndex((t) => t.id === activeTab);

  // Capture initial index once to avoid Embla reinit on every tab change
  const [initialIndex] = useState(() =>
    tabs.findIndex((t) => t.id === activeTab)
  );

  // Initialize Embla — only prefersReducedMotion is reactive
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: false,
    watchDrag: !prefersReducedMotion,
    duration: prefersReducedMotion ? 0 : 20,
    startIndex: initialIndex,
  });

  // Single source of truth: select + reinit event handlers
  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      const newIndex = emblaApi.selectedScrollSnap();
      const tab = tabs[newIndex];
      if (tab && tab.id !== activeTab) {
        onTabChange(tab.id);
        setAnnouncement(`${tab.label} tab selected`);
        if (lazy) {
          setVisitedTabs((prev) => {
            if (prev.has(tab.id)) return prev;
            return new Set(prev).add(tab.id);
          });
        }
      }
    };

    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, tabs, activeTab, onTabChange, lazy]);

  // Sync external activeTab prop → carousel position
  useEffect(() => {
    if (!emblaApi) return;
    if (emblaApi.selectedScrollSnap() !== activeIndex) {
      emblaApi.scrollTo(activeIndex);
    }
  }, [emblaApi, activeIndex]);

  /**
   * Navigates to a tab by index via Embla scrollTo.
   * Does not call onTabChange directly — state flows through the select event.
   */
  const navigateToIndex = useCallback(
    (index: number) => {
      const tab = tabs[index];
      if (tab) {
        emblaApi?.scrollTo(index);
        // Focus the tab button
        const tabButton = tablistRef.current?.querySelector(
          `[data-tab-index="${index}"]`
        ) as HTMLButtonElement | null;
        tabButton?.focus();
      }
    },
    [tabs, emblaApi]
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
   * Handles tab change from the Select dropdown.
   */
  const handleSelectChange = useCallback(
    (value: string) => {
      const tab = tabs.find((t) => t.id === value);
      if (tab) {
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
      }
    },
    [tabs, onTabChange, lazy]
  );

  const getTabId = (tabId: string) => `${instanceId}-tab-${tabId}`;
  const getPanelId = (tabId: string) => `${instanceId}-panel-${tabId}`;

  // -------------------------------------------------------------------------
  // Select mode: >3 tabs renders dropdown instead of swipeable tab bar
  // -------------------------------------------------------------------------

  if (useSelectMode) {
    const activeTabData = tabs[activeIndex];
    const ActiveIcon = activeTabData?.icon;

    return (
      <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>
        <div data-vaul-no-drag>
          <Select value={activeTab} onValueChange={handleSelectChange}>
            <SelectTrigger
              aria-label={ariaLabel}
              className="w-full"
            >
              <SelectValue>
                {ActiveIcon && (
                  <ActiveIcon aria-hidden="true" className="size-4 shrink-0" />
                )}
                {activeTabData?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <SelectItem
                    key={tab.id}
                    value={tab.id}
                  >
                    {Icon && (
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                    )}
                    {tab.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Content panels — map ALL tabs, show/hide to preserve form state */}
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            const shouldRender = lazy
              ? isActive || visitedTabs.has(tab.id)
              : true;

            return (
              <div
                key={tab.id}
                role="tabpanel"
                id={getPanelId(tab.id)}
                aria-label={tab.label}
                inert={!isActive ? true : undefined}
                aria-hidden={!isActive ? true : undefined}
                className={cn(isActive ? "block" : "hidden", "px-1 py-4")}
              >
                {shouldRender ? tab.content : null}
              </div>
            );
          })}
        </div>

        {/* Screen reader announcement */}
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Swipeable mode: ≤3 tabs renders tab bar with Embla Carousel
  // -------------------------------------------------------------------------

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
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
        {/* Sliding indicator — plain div with CSS translate */}
        {activeIndex >= 0 && (
          <div
            className="bg-primary absolute bottom-0 left-0 h-0.5"
            style={{
              width: `${100 / tabs.length}%`,
              translate: `${activeIndex * 100}% 0`,
              transition: prefersReducedMotion
                ? "none"
                : "translate 200ms ease",
            }}
          />
        )}
      </div>

      {/* Content panels — Embla Carousel */}
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        data-vaul-no-drag
        ref={emblaRef}
      >
        <div className="flex h-full">
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
                tabIndex={isActive ? 0 : undefined}
                inert={!isActive ? true : undefined}
                aria-hidden={!isActive ? true : undefined}
                className="min-w-0 flex-[0_0_100%] overflow-y-auto overscroll-y-contain px-1 py-4"
              >
                {shouldRender ? tab.content : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Screen reader announcement */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}

export default SwipeableTabs;
