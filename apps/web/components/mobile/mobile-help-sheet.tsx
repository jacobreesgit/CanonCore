/**
 * Mobile help bottom sheet component.
 * Shows documentation sections matching the sidebar docs navigation.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBook,
  faCircleQuestion,
  faCloud,
  faFolderOpen,
  faGear,
  faRocket,
  faShareNodes,
  faTableCellsLarge,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { MobileBottomSheet } from "./mobile-bottom-sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * Props for MobileHelpSheet component.
 */
export interface MobileHelpSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
}

/** Documentation section with icon and link. */
interface DocSection {
  label: string;
  href: string;
  icon: React.ReactNode;
  description: string;
}

/** Documentation sections matching the sidebar structure. */
const DOC_SECTIONS: DocSection[] = [
  {
    label: "Getting Started",
    href: "/docs/getting-started/quick-tour",
    icon: <FontAwesomeIcon icon={faRocket} className="size-4" />,
    description: "Create account, sign in, quick tour",
  },
  {
    label: "Files & Folders",
    href: "/docs/files-and-folders/navigation",
    icon: <FontAwesomeIcon icon={faFolderOpen} className="size-4" />,
    description: "Create, organise, delete items",
  },
  {
    label: "Google Drive",
    href: "/docs/google-drive/connect-drive",
    icon: <FontAwesomeIcon icon={faCloud} className="size-4" />,
    description: "Connect, sync, upload files",
  },
  {
    label: "Views",
    href: "/docs/views/grid-view",
    icon: <FontAwesomeIcon icon={faTableCellsLarge} className="size-4" />,
    description: "Grid, tree, sort & filter",
  },
  {
    label: "Sharing",
    href: "/docs/sharing/public-profile",
    icon: <FontAwesomeIcon icon={faShareNodes} className="size-4" />,
    description: "Public profile, explore, forking",
  },
  {
    label: "Preferences",
    href: "/docs/preferences/dark-mode",
    icon: <FontAwesomeIcon icon={faGear} className="size-4" />,
    description: "Dark mode, default settings",
  },
  {
    label: "Account",
    href: "/docs/account/profile-settings",
    icon: <FontAwesomeIcon icon={faUser} className="size-4" />,
    description: "Profile, security, password",
  },
];

/**
 * Mobile help bottom sheet.
 * Shows documentation sections as a navigation list.
 *
 * @param open - Whether the sheet is open
 * @param onOpenChange - Callback when open state changes
 */
export function MobileHelpSheet({ open, onOpenChange }: MobileHelpSheetProps) {
  return (
    <MobileBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={["auto"]}
      title="Get Help"
      description="Documentation and guides"
    >
      <div className="max-h-[70vh] overflow-y-auto px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {/* Header */}
        <div className="flex items-center gap-3 py-3">
          <div className="bg-primary/10 flex size-12 items-center justify-center rounded-full">
            <FontAwesomeIcon
              icon={faCircleQuestion}
              className="text-primary size-6"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Documentation</p>
            <p className="text-muted-foreground text-sm">
              Learn how to use CanonCore
            </p>
          </div>
        </div>

        <Separator className="my-3" />

        {/* All Docs link */}
        <Link
          href="/docs"
          onClick={() => onOpenChange(false)}
          className={cn(
            "mb-3 flex items-center gap-3 rounded-lg border p-3",
            "hover:bg-accent transition-colors"
          )}
        >
          <FontAwesomeIcon
            icon={faBook}
            className="text-primary size-5"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Browse All Documentation</p>
            <p className="text-muted-foreground text-xs">
              Full searchable docs with all topics
            </p>
          </div>
        </Link>

        {/* Documentation sections */}
        <div className="space-y-1">
          {DOC_SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              onClick={() => onOpenChange(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5",
                "hover:bg-accent transition-colors"
              )}
            >
              <span className="text-muted-foreground">{section.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{section.label}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {section.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </MobileBottomSheet>
  );
}
