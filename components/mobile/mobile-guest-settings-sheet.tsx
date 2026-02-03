/**
 * Mobile guest settings bottom sheet component.
 * Displays theme and reduced motion preferences for unauthenticated users.
 * Uses same design patterns as MobileUserSheet.
 */

"use client";

import * as React from "react";
import { Moon, Sun, Monitor, Settings } from "lucide-react";
import { useTheme } from "next-themes";
import { MobileBottomSheet } from "./mobile-bottom-sheet";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * Props for MobileGuestSettingsSheet component.
 */
export interface MobileGuestSettingsSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * Mobile guest settings bottom sheet.
 * Displays:
 * - Theme selector (Light/Dark/System)
 * - Reduced motion toggle
 *
 * @param open - Whether the sheet is open
 * @param onOpenChange - Callback when open state changes
 */
export function MobileGuestSettingsSheet({
  open,
  onOpenChange,
}: MobileGuestSettingsSheetProps) {
  const { theme, setTheme } = useTheme();
  const { reducedMotion, setReducedMotion } = useReducedMotion();

  return (
    <MobileBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={["auto"]}
      title="Settings"
      description="Customize your experience"
    >
      <div className="px-4 pt-2 pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 py-3">
          <div className="bg-primary/10 flex size-12 items-center justify-center rounded-full">
            <Settings className="text-primary size-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Preferences</p>
            <p className="text-muted-foreground text-sm">
              Settings are saved locally
            </p>
          </div>
        </div>

        <Separator className="my-3" />

        {/* Theme */}
        <div className="space-y-3 py-2">
          <Label className="text-sm font-medium">Theme</Label>
          <RadioGroup
            value={theme}
            onValueChange={setTheme}
            className="flex gap-2"
          >
            <label
              htmlFor="theme-light"
              className="border-input has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border p-3 transition-colors"
            >
              <RadioGroupItem
                value="light"
                id="theme-light"
                className="sr-only"
              />
              <Sun className="size-4" aria-hidden="true" />
              <span className="text-sm">Light</span>
            </label>
            <label
              htmlFor="theme-dark"
              className="border-input has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border p-3 transition-colors"
            >
              <RadioGroupItem
                value="dark"
                id="theme-dark"
                className="sr-only"
              />
              <Moon className="size-4" aria-hidden="true" />
              <span className="text-sm">Dark</span>
            </label>
            <label
              htmlFor="theme-system"
              className="border-input has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border p-3 transition-colors"
            >
              <RadioGroupItem
                value="system"
                id="theme-system"
                className="sr-only"
              />
              <Monitor className="size-4" aria-hidden="true" />
              <span className="text-sm">System</span>
            </label>
          </RadioGroup>
        </div>

        <Separator className="my-3" />

        {/* Reduced Motion */}
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="reduced-motion" className="text-sm font-medium">
              Reduce motion
            </Label>
            <p className="text-muted-foreground text-xs">
              Minimize animations throughout the app
            </p>
          </div>
          <Switch
            id="reduced-motion"
            checked={reducedMotion}
            onCheckedChange={setReducedMotion}
          />
        </div>
      </div>
    </MobileBottomSheet>
  );
}
