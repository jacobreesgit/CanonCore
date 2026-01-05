/**
 * Modal dialog for creating new folders.
 * Provides a clean, focused interface for folder creation.
 */

"use client";

import { useState, useEffect } from "react";
import { FolderPlus, Loader2 } from "lucide-react";
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

interface AddFolderDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback to create the folder. Returns error message or undefined on success. */
  onAdd: (name: string, description?: string) => Promise<string | undefined>;
  /** Parent folder name for context (optional) */
  parentName?: string;
}

/**
 * Modal dialog for creating folders.
 * Auto-focuses input, supports Enter to submit, shows loading state.
 *
 * @param open - Whether dialog is visible
 * @param onOpenChange - Callback for visibility changes
 * @param onAdd - Async callback to create folder
 * @param parentName - Optional parent folder name for context
 */
export function AddFolderDialog({
  open,
  onOpenChange,
  onAdd,
  parentName,
}: AddFolderDialogProps) {
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

  const descriptionId = "folder-dialog-description";
  const dialogHint = parentName
    ? `Create a new folder inside "${parentName}".`
    : "Create a new folder to organize your files.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        aria-describedby={descriptionId}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          document.getElementById("folder-name")?.focus();
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
              <FolderPlus className="text-primary size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Create Folder</DialogTitle>
              <DialogDescription id={descriptionId} className="text-sm">
                {dialogHint}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter folder name..."
              disabled={isLoading}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="folder-description">
              Description{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Textarea
              id="folder-description"
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
