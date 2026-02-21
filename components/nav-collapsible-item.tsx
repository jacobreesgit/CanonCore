/**
 * Reusable collapsible sidebar nav item.
 * Supports two modes: link (My Items) and toggle (Legal).
 * When `href` is provided, the label is a navigable link with a separate chevron toggle.
 * When `href` is omitted, clicking the label itself toggles the collapsible.
 */

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar";

/**
 * Props for NavCollapsibleItem component.
 */
interface NavCollapsibleItemProps {
  /** Display label for the nav item */
  label: string;
  /** FontAwesome icon shown before the label */
  icon: IconDefinition;
  /** When provided, the label is a navigable link; when omitted, clicking toggles collapse */
  href?: string;
  /** Whether the item is currently active */
  isActive?: boolean;
  /** Whether the collapsible starts open */
  defaultOpen?: boolean;
  /** Tooltip text (defaults to label) */
  tooltip?: string;
  /** Sub-items rendered inside the collapsible */
  children: ReactNode;
}

/**
 * Renders a sidebar nav item with a collapsible sub-menu.
 *
 * In link mode (`href` provided), the label navigates and a separate
 * SidebarMenuAction chevron toggles the sub-items. In toggle mode (no `href`),
 * clicking the label itself expands/collapses.
 *
 * @param label - Display text for the nav item
 * @param icon - FontAwesome icon
 * @param href - Optional link destination
 * @param isActive - Whether the item is active
 * @param defaultOpen - Whether to start expanded
 * @param tooltip - Tooltip text
 * @param children - Sub-items to render when expanded
 */
export function NavCollapsibleItem({
  label,
  icon,
  href,
  isActive = false,
  defaultOpen = true,
  tooltip,
  children,
}: NavCollapsibleItemProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
      <SidebarMenuItem>
        {href ? (
          <SidebarMenuButton
            tooltip={tooltip ?? label}
            asChild
            isActive={isActive}
          >
            <Link href={href}>
              <FontAwesomeIcon icon={icon} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          </SidebarMenuButton>
        ) : (
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={tooltip ?? label} isActive={isActive}>
              <FontAwesomeIcon icon={icon} aria-hidden="true" />
              <span>{label}</span>
            </SidebarMenuButton>
          </CollapsibleTrigger>
        )}
        <CollapsibleTrigger asChild>
          <SidebarMenuAction className="bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <FontAwesomeIcon
              icon={faChevronRight}
              className="transition-transform group-data-[state=open]/collapsible:rotate-90"
            />
            <span className="sr-only">Toggle {label}</span>
          </SidebarMenuAction>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>{children}</SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
