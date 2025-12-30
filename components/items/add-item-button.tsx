/**
 * Inline add item button with expandable input field.
 * Smooth expand/collapse animation with refined interactions.
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AddItemButtonProps {
  onAdd(name: string): Promise<string | undefined>;
  placeholder?: string;
  className?: string;
}

/**
 * Inline button that expands to an input field for creating items.
 * Closes automatically on success, stays open on error (parent shows toast).
 */
export function AddItemButton({
  onAdd,
  placeholder = "Folder name...",
  className,
}: AddItemButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to allow animation to start before focus
      const timeout = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        if (isOpen && !isLoading) {
          setIsOpen(false);
          setName("");
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, isLoading]);

  async function handleSubmit() {
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      const errorMessage = await onAdd(name.trim());
      if (!errorMessage) {
        // Success: close input and reset
        setName("");
        setIsOpen(false);
      }
      // Error: stay open (parent shows toast)
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setName("");
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="flex items-center gap-2">
        {/* Input area - conditionally rendered for proper accessibility */}
        {isOpen ? (
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isLoading}
              className="h-9 w-48 min-w-0"
            />
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!name.trim() || isLoading}
              className="h-9 shrink-0"
            >
              {isLoading ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                "Add"
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsOpen(false);
                setName("");
              }}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground size-9 shrink-0"
            >
              <IconX className="size-4" strokeWidth={2} />
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(true)}
            className="gap-1.5"
          >
            <IconPlus className="size-4" strokeWidth={2} />
            <span>Add Folder</span>
          </Button>
        )}
      </div>
    </div>
  );
}
