/**
 * Modal dialog for creating new items.
 * Provides a clean, focused interface for item creation.
 */

"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface AddItemDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback to create the item. Returns error message or undefined on success. */
  onAdd: (name: string, description?: string) => Promise<string | undefined>;
  /** Parent item name for context (optional) */
  parentName?: string;
}

/**
 * Modal dialog for creating items.
 * Auto-focuses input, supports Enter to submit, shows loading state.
 *
 * @param open - Whether dialog is visible
 * @param onOpenChange - Callback for visibility changes
 * @param onAdd - Async callback to create item
 * @param parentName - Optional parent item name for context
 */
export function AddItemDialog({
  open,
  onOpenChange,
  onAdd,
  parentName,
}: AddItemDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setIsLoading(false);
    }
  }, [open]);

  async function handleSubmit() {
    if (!name.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const desc = description.trim() || undefined;
      const error = await onAdd(name.trim(), desc);
      if (!error) {
        onOpenChange(false);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && name.trim()) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const descriptionId = "item-dialog-description";
  const dialogHint = parentName
    ? `Create a new item inside "${parentName}".`
    : "Create a new item to organize your content.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        aria-describedby={descriptionId}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          document.getElementById("item-name")?.focus();
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                "bg-primary/10 ring-primary/20 ring-1"
              )}
            >
              <Plus className="text-primary size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Create Item</DialogTitle>
              <DialogDescription id={descriptionId} className="text-sm">
                {dialogHint}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="item-name">Item name</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter item name..."
              disabled={isLoading}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-description">
              Description{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Textarea
              id="item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a short description..."
              disabled={isLoading}
              className="min-h-[80px] resize-none"
              maxLength={200}
            />
            <p className="text-muted-foreground text-xs">
              {description.length}/200 characters
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
