/**
 * Swipeable underline-style tabs for mobile item detail pages.
 * Uses Embla Carousel for native-feeling swipe gestures between tab panels
 * while keeping the cinematic underline tab bar from UnderlineTabs.
 *
 * Loaded via next/dynamic so Embla's bundle is only downloaded on mobile.
 * Supports reduced motion and full WCAG 2.1 Level A accessibility.
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
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { Section } from "@/components/ui/section";

/** Tab configuration for SwipeableUnderlineTabs. */
interface Tab {
  /** Unique tab ID. */
  id: string;
  /** Tab label. */
  label: string;
  /** Tab content. */
  content: ReactNode;
}

interface SwipeableUnderlineTabsProps {
  /** Tab definitions. */
  tabs: Tab[];
  /** Currently active tab ID (controlled). */
  activeTab: string;
  /** Callback when active tab changes via swipe, click, or keyboard. */
  onTabChange: (id: string) => void;
  /** Controls Embla drag at runtime. Set to false to disable swipe (e.g. during edit mode). */
  swipeEnabled?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Swipeable underline tabs with Embla Carousel for mobile.
 * Same cinematic visual style as UnderlineTabs but with horizontal swipe
 * navigation between content panels.
 *
 * @param tabs - Tab definitions with id, label, and content
 * @param activeTab - Currently selected tab ID (controlled)
 * @param onTabChange - Called when tab selection changes (swipe, click, or keyboard)
 * @param swipeEnabled - Whether swipe gestures are active (default true)
 * @param className - Additional CSS classes for the container
 */
export function SwipeableUnderlineTabs({
  tabs,
  activeTab,
  onTabChange,
  swipeEnabled = true,
  className,
}: SwipeableUnderlineTabsProps) {
  const instanceId = useId();
  const prefersReducedMotion = usePrefersReducedMotion();
  const tablistRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const pendingFocusRef = useRef<number | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const activeIndex = tabs.findIndex((t) => t.id === activeTab);

  // Capture initial index once to avoid Embla reinit on every tab change
  const [initialIndex] = useState(() =>
    tabs.findIndex((t) => t.id === activeTab)
  );

  // Initialize Embla — swipeEnabled and prefersReducedMotion are reactive
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: false,
    watchDrag: swipeEnabled && !prefersReducedMotion,
    duration: prefersReducedMotion ? 0 : 20,
    startIndex: initialIndex,
  });

  // Handle swipe-initiated tab changes only.
  // Programmatic navigation (click/keyboard) is handled in navigateToIndex,
  // which updates state directly. The isDraggingRef ensures onSelect only
  // processes user-initiated drags, avoiding race conditions with async events.
  useEffect(() => {
    if (!emblaApi) return;

    const onPointerDown = () => {
      isDraggingRef.current = true;
    };
    const onSelect = () => {
      if (!isDraggingRef.current) return;
      const newIndex = emblaApi.selectedScrollSnap();
      const tab = tabs[newIndex];
      if (tab && tab.id !== activeTab) {
        onTabChange(tab.id);
        setAnnouncement(`${tab.label} tab selected`);
      }
    };
    const onSettle = () => {
      isDraggingRef.current = false;
    };

    emblaApi.on("pointerDown", onPointerDown);
    emblaApi.on("select", onSelect);
    emblaApi.on("settle", onSettle);
    return () => {
      emblaApi.off("pointerDown", onPointerDown);
      emblaApi.off("select", onSelect);
      emblaApi.off("settle", onSettle);
    };
  }, [emblaApi, tabs, activeTab, onTabChange]);

  // Sync external activeTab prop → carousel position
  useEffect(() => {
    if (!emblaApi) return;
    if (emblaApi.selectedScrollSnap() !== activeIndex) {
      emblaApi.scrollTo(activeIndex);
    }
  }, [emblaApi, activeIndex]);

  // Focus tab button after render when navigateToIndex sets a pending focus.
  // Must run after React commits DOM changes so the button is focusable.
  useEffect(() => {
    if (pendingFocusRef.current !== null) {
      const index = pendingFocusRef.current;
      pendingFocusRef.current = null;
      const tabButton = tablistRef.current?.querySelector(
        `[data-tab-index="${index}"]`
      ) as HTMLButtonElement | null;
      tabButton?.focus();
    }
  });

  /**
   * Navigates to a tab by index via click or keyboard.
   * Updates state immediately so aria-selected reflects the change without
   * waiting for Embla's async select event.
   */
  const navigateToIndex = useCallback(
    (index: number) => {
      const tab = tabs[index];
      if (tab) {
        onTabChange(tab.id);
        setAnnouncement(`${tab.label} tab selected`);
        emblaApi?.scrollTo(index);
        // Defer focus to the post-render effect to ensure DOM is updated
        pendingFocusRef.current = index;
      }
    },
    [tabs, emblaApi, onTabChange]
  );

  /**
   * Handles keyboard navigation within the tab bar.
   * Reads the focused button's data-tab-index rather than activeIndex from
   * state so navigation stays correct during the gap between scrollTo() and
   * the Embla select event settling.
   */
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = Number(
        e.currentTarget.getAttribute("data-tab-index")
      );
      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
          break;
        case "ArrowLeft":
          e.preventDefault();
          nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
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
    [tabs.length, navigateToIndex]
  );

  const getTabId = (tabId: string) => `${instanceId}-tab-${tabId}`;
  const getPanelId = (tabId: string) => `${instanceId}-panel-${tabId}`;

  return (
    <div className={className}>
      {/* Tab list — Section provides consistent horizontal padding */}
      <Section>
        <div ref={tablistRef} className="relative flex" role="tablist">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              id={getTabId(tab.id)}
              data-testid={`tab-${tab.id}`}
              data-tab-index={index}
              role="tab"
              tabIndex={activeTab === tab.id ? 0 : -1}
              aria-selected={activeTab === tab.id}
              aria-controls={getPanelId(tab.id)}
              onClick={() => navigateToIndex(index)}
              onKeyDown={handleTabKeyDown}
              className={cn(
                "relative flex-1 cursor-pointer py-4 text-center",
                "text-sm font-medium tracking-[0.15em] uppercase",
                "transition-colors duration-200",
                activeTab === tab.id
                  ? "text-foreground"
                  : "hover:text-muted-foreground text-[var(--tertiary-foreground)]",
                "focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              )}
            >
              {tab.label}
            </button>
          ))}
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
      </Section>

      {/* Content panels — Embla Carousel */}
      <div
        className="relative overflow-x-clip"
        data-vaul-no-drag
        ref={emblaRef}
      >
        <div className="flex items-start">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <div
                key={tab.id}
                id={getPanelId(tab.id)}
                data-testid={`tabpanel-${tab.id}`}
                role="tabpanel"
                aria-labelledby={getTabId(tab.id)}
                tabIndex={isActive ? 0 : undefined}
                inert={!isActive ? true : undefined}
                aria-hidden={!isActive ? true : undefined}
                className="min-w-0 flex-[0_0_100%]"
              >
                {tab.content}
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

export default SwipeableUnderlineTabs;
