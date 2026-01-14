# Sticky Dialog Footers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make dialog footers always visible by restructuring AnimatedDialogContent with a slot-based API where only the body content animates, keeping header and footer fixed.

**Architecture:** Refactor AnimatedDialogContent to accept `header` and `footer` props that render outside the animated area. The body (children) animates height while header/footer remain fixed. Regular Dialog/AlertDialog get simpler flex-col layout updates.

**Tech Stack:** React, Tailwind CSS, Radix Dialog, Motion/React, ResizeObserver

---

## Dialogs Requiring Changes

| Dialog              | File                                           | Type                  | Approach                                    |
| ------------------- | ---------------------------------------------- | --------------------- | ------------------------------------------- |
| Add Item            | `components/items/add-item-dialog.tsx`         | AnimatedDialogContent | Slot-based API                              |
| Item Settings       | `components/items/item-settings-dialog.tsx`    | AnimatedDialogContent | Slot-based API                              |
| Profile Settings    | `components/profile/settings-dialog.tsx`       | AnimatedDialogContent | Slot-based API                              |
| Delete Confirmation | `components/items/item-context-menu.tsx`       | DialogContent         | Simple flex-col (no DialogBody needed)      |
| Drive Disconnect    | `components/google-drive/settings-section.tsx` | AlertDialogContent    | Simple flex-col (no AlertDialogBody needed) |

**Key Insight:** Small confirmation dialogs (delete, disconnect) don't need DialogBody - they don't scroll. Only add complexity where needed.

---

## Task 1: Restructure AnimatedDialogContent with Slot-Based API

**Files:**

- Modify: `components/ui/animated-dialog-content.tsx`
- Test: `tests/unit/components/ui/animated-dialog-content.test.tsx`

### Step 1: Write the failing test

Add to existing test file:

```typescript
// tests/unit/components/ui/animated-dialog-content.test.tsx

describe("AnimatedDialogContent slot-based API", () => {
  it("renders header outside animated area", () => {
    render(
      <Dialog open>
        <AnimatedDialogContent
          stepKey="step1"
          header={<div data-testid="slot-header">Header</div>}
        >
          Body content
        </AnimatedDialogContent>
      </Dialog>
    );

    const header = screen.getByTestId("slot-header");
    expect(header).toBeInTheDocument();
    // Header should be direct child of dialog content, not inside motion.div
    expect(header.closest("[data-slot='dialog-content']")?.firstChild).toBe(
      header.parentElement
    );
  });

  it("renders footer outside animated area", () => {
    render(
      <Dialog open>
        <AnimatedDialogContent
          stepKey="step1"
          footer={<div data-testid="slot-footer">Footer</div>}
        >
          Body content
        </AnimatedDialogContent>
      </Dialog>
    );

    const footer = screen.getByTestId("slot-footer");
    expect(footer).toBeInTheDocument();
    // Footer should be direct child of dialog content, not inside motion.div
    expect(footer.closest("[data-slot='dialog-content']")?.lastChild).toContain(
      footer.parentElement
    );
  });

  it("only animates body content height", () => {
    const { rerender } = render(
      <Dialog open>
        <AnimatedDialogContent
          stepKey="step1"
          header={<div>Header</div>}
          footer={<div>Footer</div>}
        >
          <div style={{ height: 100 }}>Short content</div>
        </AnimatedDialogContent>
      </Dialog>
    );

    // Rerender with taller content
    rerender(
      <Dialog open>
        <AnimatedDialogContent
          stepKey="step2"
          header={<div>Header</div>}
          footer={<div>Footer</div>}
        >
          <div style={{ height: 300 }}>Tall content</div>
        </AnimatedDialogContent>
      </Dialog>
    );

    // Motion div should exist and animate (mocked, so just verify structure)
    expect(screen.getByText("Tall content")).toBeInTheDocument();
  });

  it("applies shrink-0 to header and footer wrappers", () => {
    render(
      <Dialog open>
        <AnimatedDialogContent
          stepKey="step1"
          header={<div data-testid="slot-header">Header</div>}
          footer={<div data-testid="slot-footer">Footer</div>}
        >
          Body
        </AnimatedDialogContent>
      </Dialog>
    );

    const headerWrapper = screen.getByTestId("slot-header").parentElement;
    const footerWrapper = screen.getByTestId("slot-footer").parentElement;

    expect(headerWrapper?.className).toContain("shrink-0");
    expect(footerWrapper?.className).toContain("shrink-0");
  });

  it("body section has min-h-0 for proper flex scrolling", () => {
    render(
      <Dialog open>
        <AnimatedDialogContent
          stepKey="step1"
          header={<div>Header</div>}
          footer={<div>Footer</div>}
          data-testid="dialog"
        >
          Body
        </AnimatedDialogContent>
      </Dialog>
    );

    // The body wrapper should have min-h-0 and overflow-y-auto
    const dialog = screen.getByTestId("dialog");
    const bodyWrapper = dialog.querySelector("[data-slot='dialog-body']");
    expect(bodyWrapper?.className).toContain("min-h-0");
    expect(bodyWrapper?.className).toContain("overflow-y-auto");
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/ui/animated-dialog-content.test.tsx`
Expected: FAIL - header/footer props not implemented

### Step 3: Implement slot-based AnimatedDialogContent

Replace `components/ui/animated-dialog-content.tsx`:

```typescript
/**
 * Animated dialog content with smooth height transitions between steps.
 * Uses slot-based API: header and footer are fixed, only body animates.
 * Technique inspired by react-bits Stepper: measure content, animate container.
 * Respects prefers-reduced-motion for accessibility.
 */

"use client";

import * as React from "react";
import {
  useState,
  useRef,
  useLayoutEffect,
  useCallback,
  useEffect,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnimatedDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Unique key for current step (triggers animation on change). */
  stepKey: string;
  /** Whether to show close button (default: true). */
  showClose?: boolean;
  /** Fixed header content (rendered outside animated area). */
  header?: React.ReactNode;
  /** Fixed footer content (rendered outside animated area). */
  footer?: React.ReactNode;
}

interface BodyContentProps {
  /** Unique key for AnimatePresence. */
  stepKey: string;
  /** Callback to report measured height. */
  onHeightReady: (height: number) => void;
  /** Whether to skip all motion (first render). */
  skipMotion: boolean;
  /** Whether to reduce motion. */
  reduceMotion: boolean;
  /** Content to render. */
  children: React.ReactNode;
}

/**
 * Inner body wrapper that measures its height and reports it.
 * Positioned absolutely so it doesn't affect container height directly.
 * Uses ResizeObserver for dynamic height detection (e.g., tab switches).
 */
function BodyContent({
  stepKey,
  onHeightReady,
  skipMotion,
  reduceMotion,
  children,
}: BodyContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Use ResizeObserver to detect height changes from any source
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Initial measurement
    onHeightReady(element.offsetHeight);

    // Watch for size changes
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height =
          entry.borderBoxSize?.[0]?.blockSize ??
          entry.target.getBoundingClientRect().height;
        onHeightReady(height);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeightReady]);

  // On first render, skip all motion
  if (skipMotion) {
    return (
      <div ref={ref} className="absolute inset-x-0 top-0">
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      key={stepKey}
      className="absolute inset-x-0 top-0"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
      transition={
        reduceMotion ? { duration: 0.05 } : { duration: 0.25, ease: "easeOut" }
      }
    >
      {children}
    </motion.div>
  );
}

/**
 * Dialog content wrapper with animated height transitions.
 * Header and footer are fixed; only body content animates.
 *
 * @param stepKey - Unique identifier for current step
 * @param showClose - Whether to show close button
 * @param header - Fixed header content (outside animated area)
 * @param footer - Fixed footer content (outside animated area)
 * @param children - Body content (animates between steps)
 */
function AnimatedDialogContent({
  className,
  children,
  stepKey,
  showClose = true,
  header,
  footer,
  ...props
}: AnimatedDialogContentProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const bodyRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({
    height: 0,
    isFirstRender: true,
  });

  // Reset scroll position when step changes
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [stepKey]);

  // Stable callback for height updates
  const handleHeightReady = useCallback((newHeight: number) => {
    setState((prev) => ({
      height: newHeight,
      isFirstRender: prev.isFirstRender && prev.height === 0,
    }));
  }, []);

  const dialogContent = (
    <>
      {/* Fixed Header */}
      {header && (
        <div data-slot="dialog-header-wrapper" className="shrink-0">
          {header}
        </div>
      )}

      {/* Animated Body */}
      <div
        ref={bodyRef}
        data-slot="dialog-body"
        className="flex-1 min-h-0 overflow-y-auto"
      >
        {state.isFirstRender ? (
          // First render: no motion wrapper
          <div className="relative">
            <BodyContent
              key={stepKey}
              stepKey={stepKey}
              onHeightReady={handleHeightReady}
              skipMotion={true}
              reduceMotion={shouldReduceMotion}
            >
              {children}
            </BodyContent>
          </div>
        ) : (
          // Subsequent renders: animated height container
          <motion.div
            className="relative"
            style={{ overflow: "hidden" }}
            animate={{ height: state.height }}
            initial={false}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 400, damping: 35 }
            }
          >
            <AnimatePresence mode="sync" initial={false}>
              <BodyContent
                key={stepKey}
                stepKey={stepKey}
                onHeightReady={handleHeightReady}
                skipMotion={false}
                reduceMotion={shouldReduceMotion}
              >
                {children}
              </BodyContent>
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Fixed Footer */}
      {footer && (
        <div data-slot="dialog-footer-wrapper" className="shrink-0 pt-4">
          {footer}
        </div>
      )}

      {/* Close Button */}
      {showClose && (
        <DialogPrimitive.Close
          data-slot="dialog-close"
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 cursor-pointer rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </>
  );

  return (
    <DialogPrimitive.Portal data-slot="dialog-portal">
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 flex max-h-[95vh] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] flex-col gap-4 rounded-lg border p-6 shadow-lg duration-200 outline-none sm:max-w-lg",
          className
        )}
        {...props}
      >
        {dialogContent}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { AnimatedDialogContent };
export type { AnimatedDialogContentProps };
```

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/components/ui/animated-dialog-content.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add components/ui/animated-dialog-content.tsx tests/unit/components/ui/animated-dialog-content.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): restructure AnimatedDialogContent with slot-based API

BREAKING CHANGE: AnimatedDialogContent now accepts header and footer
props that render outside the animated area. Only children (body)
animates between steps.

- Header/footer fixed with shrink-0
- Body has min-h-0 overflow-y-auto for proper flex scrolling
- ResizeObserver only measures body content
- Maintains smooth spring animations between steps

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Update DialogFooter with shrink-0

**Files:**

- Modify: `components/ui/dialog.tsx`
- Test: `tests/unit/components/ui/dialog.test.tsx` (create)

### Step 1: Write the failing test

```typescript
// tests/unit/components/ui/dialog.test.tsx
/**
 * Unit tests for Dialog components.
 * Tests DialogFooter styling for sticky footer support.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";

describe("DialogFooter", () => {
  it("renders with shrink-0 to prevent compression", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogFooter data-testid="footer">
            <button>Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    const footer = screen.getByTestId("footer");
    expect(footer.className).toContain("shrink-0");
  });

  it("renders with pt-4 for top padding", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogFooter data-testid="footer">
            <button>Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    const footer = screen.getByTestId("footer");
    expect(footer.className).toContain("pt-4");
  });
});

describe("DialogContent", () => {
  it("uses flex-col layout", () => {
    render(
      <Dialog open>
        <DialogContent data-testid="content">
          Content
        </DialogContent>
      </Dialog>
    );

    const content = screen.getByTestId("content");
    expect(content.className).toContain("flex");
    expect(content.className).toContain("flex-col");
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/ui/dialog.test.tsx`
Expected: FAIL - missing shrink-0 and pt-4

### Step 3: Update dialog.tsx

Update `DialogFooter`:

```typescript
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}
```

Update `DialogContent` to use flex-col:

```typescript
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 flex max-h-[95vh] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] flex-col gap-4 rounded-lg border p-6 shadow-lg duration-200 outline-none sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 cursor-pointer rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
```

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/components/ui/dialog.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add components/ui/dialog.tsx tests/unit/components/ui/dialog.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): update Dialog components for sticky footer support

- DialogContent uses flex-col layout
- DialogFooter has shrink-0 pt-4 for fixed positioning
- Maintains existing responsive behavior

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Update AlertDialog Components

**Files:**

- Modify: `components/ui/alert-dialog.tsx`
- Test: `tests/unit/components/ui/alert-dialog.test.tsx` (create)

### Step 1: Write the failing test

```typescript
// tests/unit/components/ui/alert-dialog.test.tsx
/**
 * Unit tests for AlertDialog components.
 * Tests AlertDialogFooter styling for sticky footer support.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

describe("AlertDialogFooter", () => {
  it("renders with shrink-0 to prevent compression", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogFooter data-testid="footer">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );

    const footer = screen.getByTestId("footer");
    expect(footer.className).toContain("shrink-0");
  });
});

describe("AlertDialogContent", () => {
  it("uses flex-col layout", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent data-testid="content">
          Content
        </AlertDialogContent>
      </AlertDialog>
    );

    const content = screen.getByTestId("content");
    expect(content.className).toContain("flex");
    expect(content.className).toContain("flex-col");
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/ui/alert-dialog.test.tsx`
Expected: FAIL

### Step 3: Update alert-dialog.tsx

Update `AlertDialogContent`:

```typescript
function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 flex max-h-[95vh] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] flex-col gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
}
```

Update `AlertDialogFooter`:

```typescript
function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}
```

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/components/ui/alert-dialog.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add components/ui/alert-dialog.tsx tests/unit/components/ui/alert-dialog.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): update AlertDialog components for sticky footer support

- AlertDialogContent uses flex-col layout
- AlertDialogFooter has shrink-0 pt-4 for fixed positioning
- Maintains existing responsive behavior

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update Add Item Dialog

**Files:**

- Modify: `components/items/add-item-dialog.tsx`
- Modify: `tests/unit/components/add-item-dialog.test.tsx`

### Step 1: Write the failing test

Add to existing test file:

```typescript
// Add to tests/unit/components/add-item-dialog.test.tsx

describe("AddItemDialog slot-based layout", () => {
  it("passes header prop to AnimatedDialogContent", async () => {
    render(
      <AddItemDialog
        open
        onOpenChange={() => {}}
        onItemCreated={() => {}}
      />
    );

    // Header should contain the dialog title
    const header = await screen.findByRole("heading", { name: /add item/i });
    expect(header).toBeInTheDocument();

    // Header wrapper should have shrink-0
    const headerWrapper = header.closest("[data-slot='dialog-header-wrapper']");
    expect(headerWrapper).toBeInTheDocument();
  });

  it("passes footer prop to AnimatedDialogContent", async () => {
    render(
      <AddItemDialog
        open
        onOpenChange={() => {}}
        onItemCreated={() => {}}
      />
    );

    // Footer should contain action buttons
    const createButton = await screen.findByRole("button", { name: /create/i });
    expect(createButton).toBeInTheDocument();

    // Footer wrapper should have shrink-0
    const footerWrapper = createButton.closest("[data-slot='dialog-footer-wrapper']");
    expect(footerWrapper).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/add-item-dialog.test.tsx -- --grep "slot-based"`
Expected: FAIL - using old children pattern

### Step 3: Update add-item-dialog.tsx

Update each step to use the slot-based API. Example for main step:

**Before:**

```tsx
{currentStep === "main" && (
  <>
    <DialogHeader>
      {/* ... header content ... */}
    </DialogHeader>

    <div className="py-2">
      <ItemDialogTabs ... />
    </div>

    <DialogFooter>
      {/* ... buttons ... */}
    </DialogFooter>
  </>
)}
```

**After:**

```tsx
<AnimatedDialogContent
  stepKey={currentStep}
  header={
    currentStep === "main" ? (
      <DialogHeader>
        {/* ... header content ... */}
      </DialogHeader>
    ) : currentStep === "episode-picker" ? (
      <DialogHeader>
        {/* ... episode picker header ... */}
      </DialogHeader>
    ) : /* ... other step headers ... */ null
  }
  footer={
    currentStep === "main" ? (
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
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
    ) : /* ... other step footers ... */ null
  }
>
  {/* Only body content here - this animates */}
  {currentStep === "main" && (
    <div className="py-2">
      <ItemDialogTabs ... />
    </div>
  )}
  {currentStep === "episode-picker" && (
    /* ... episode picker body ... */
  )}
  {/* ... other step bodies ... */}
</AnimatedDialogContent>
```

**Refactoring Pattern:** Extract header/footer/body for each step into helper functions or constants to keep JSX readable:

```tsx
// Helper to get header for current step
const getStepHeader = () => {
  switch (currentStep) {
    case "main":
      return (
        <DialogHeader>
          <div className="flex items-center gap-3">{/* ... */}</div>
        </DialogHeader>
      );
    case "episode-picker":
      return <DialogHeader>{/* ... */}</DialogHeader>;
    // ... other cases
    default:
      return null;
  }
};

// Helper to get footer for current step
const getStepFooter = () => {
  switch (currentStep) {
    case "main":
      return (
        <DialogFooter>
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
      );
    // ... other cases
    default:
      return null;
  }
};

// In render:
<AnimatedDialogContent
  stepKey={currentStep}
  header={getStepHeader()}
  footer={getStepFooter()}
>
  {/* Body content for each step */}
</AnimatedDialogContent>;
```

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/components/add-item-dialog.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add components/items/add-item-dialog.tsx tests/unit/components/add-item-dialog.test.tsx
git commit -m "$(cat <<'EOF'
feat(items): migrate add-item-dialog to slot-based API

Updates all 8 steps to use AnimatedDialogContent header/footer props.
Header and footer now render outside animated area for sticky behavior.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update Item Settings Dialog

**Files:**

- Modify: `components/items/item-settings-dialog.tsx`
- Modify: `tests/unit/components/items/item-settings-dialog.test.tsx`

### Step 1: Write the failing test

Add to existing test file:

```typescript
// Add to tests/unit/components/items/item-settings-dialog.test.tsx

describe("ItemSettingsDialog slot-based layout", () => {
  it("passes header prop to AnimatedDialogContent", async () => {
    const mockItem = { id: "1", name: "Test", parentId: null, order: 0 };

    render(
      <ItemSettingsDialog
        item={mockItem}
        open
        onOpenChange={() => {}}
      />
    );

    const header = await screen.findByRole("heading", { name: /item settings/i });
    const headerWrapper = header.closest("[data-slot='dialog-header-wrapper']");
    expect(headerWrapper).toBeInTheDocument();
  });

  it("passes footer prop to AnimatedDialogContent", async () => {
    const mockItem = { id: "1", name: "Test", parentId: null, order: 0 };

    render(
      <ItemSettingsDialog
        item={mockItem}
        open
        onOpenChange={() => {}}
      />
    );

    const saveButton = await screen.findByRole("button", { name: /save/i });
    const footerWrapper = saveButton.closest("[data-slot='dialog-footer-wrapper']");
    expect(footerWrapper).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/items/item-settings-dialog.test.tsx -- --grep "slot-based"`
Expected: FAIL

### Step 3: Update item-settings-dialog.tsx

Apply the same refactoring pattern as add-item-dialog.tsx:

1. Extract `getStepHeader()` helper
2. Extract `getStepFooter()` helper
3. Update AnimatedDialogContent usage with header/footer props
4. Keep only body content as children

All 5 steps need updating: main, episode-picker, wizard-text, wizard-poster, wizard-hero.

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/components/items/item-settings-dialog.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add components/items/item-settings-dialog.tsx tests/unit/components/items/item-settings-dialog.test.tsx
git commit -m "$(cat <<'EOF'
feat(items): migrate item-settings-dialog to slot-based API

Updates all 5 steps to use AnimatedDialogContent header/footer props.
Header and footer now render outside animated area for sticky behavior.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update Profile Settings Dialog

**Files:**

- Modify: `components/profile/settings-dialog.tsx`
- Test: `tests/unit/components/profile/settings-dialog.test.tsx` (create)

### Step 1: Write the failing test

```typescript
// tests/unit/components/profile/settings-dialog.test.tsx
/**
 * Unit tests for Settings Dialog slot-based layout.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock auth
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "1", email: "test@example.com", name: "Test" } },
    status: "authenticated",
  }),
}));

// Mock server actions
vi.mock("@/lib/user-actions", () => ({
  updateProfileAction: vi.fn(),
  updatePasswordAction: vi.fn(),
  updateEmailAction: vi.fn(),
  deleteAccountAction: vi.fn(),
}));

vi.mock("@/lib/google-drive-actions", () => ({
  getConnectionStatusAction: vi.fn().mockResolvedValue({ isConnected: false }),
  disconnectDriveAction: vi.fn(),
}));

vi.mock("@/lib/sync-log", () => ({
  getRecentSyncLogsAction: vi.fn().mockResolvedValue([]),
}));

import { SettingsDialog } from "@/components/profile/settings-dialog";

describe("SettingsDialog slot-based layout", () => {
  it("passes header prop to AnimatedDialogContent", async () => {
    render(<SettingsDialog open onOpenChange={() => {}} />);

    const header = await screen.findByRole("heading", { name: /settings/i });
    const headerWrapper = header.closest("[data-slot='dialog-header-wrapper']");
    expect(headerWrapper).toBeInTheDocument();
  });

  it("passes footer prop to AnimatedDialogContent", async () => {
    render(<SettingsDialog open onOpenChange={() => {}} />);

    const saveButton = await screen.findByRole("button", { name: /save/i });
    const footerWrapper = saveButton.closest("[data-slot='dialog-footer-wrapper']");
    expect(footerWrapper).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/profile/settings-dialog.test.tsx`
Expected: FAIL

### Step 3: Update settings-dialog.tsx

Apply the same refactoring pattern. All 3 steps need updating: main, password, email.

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/components/profile/settings-dialog.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add components/profile/settings-dialog.tsx tests/unit/components/profile/settings-dialog.test.tsx
git commit -m "$(cat <<'EOF'
feat(profile): migrate settings-dialog to slot-based API

Updates all 3 steps to use AnimatedDialogContent header/footer props.
Header and footer now render outside animated area for sticky behavior.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Verify Small Dialogs (No Changes Needed)

**Files:**

- `components/items/item-context-menu.tsx` - Delete confirmation
- `components/google-drive/settings-section.tsx` - Disconnect confirmation

### Step 1: Verify delete confirmation dialog works

The delete confirmation dialog uses regular `DialogContent` which now has `flex-col` layout. Since it's small and doesn't scroll, no additional changes are needed.

Run visual check: Right-click item → Delete → Verify dialog looks correct.

### Step 2: Verify disconnect AlertDialog works

The disconnect AlertDialog uses `AlertDialogContent` which now has `flex-col` layout. Since it's small and doesn't scroll, no additional changes are needed.

Run visual check: Settings → Google Drive → Disconnect → Verify dialog looks correct.

### Step 3: Commit (no code changes, just verification)

No commit needed - these dialogs work with the base component updates from Tasks 2 and 3.

---

## Task 8: Address Nested ScrollArea Compatibility

**Files:**

- Modify: `components/items/image-selection-grid.tsx`
- Modify: `components/items/episode-picker-helpers.tsx`

### Step 1: Review existing ScrollArea usage

These components use ScrollArea with explicit maxHeight:

- `image-selection-grid.tsx`: ScrollArea for poster/backdrop grids
- `episode-picker-helpers.tsx`: ScrollArea for season/episode lists

### Step 2: Verify no nested scrolling issues

The new AnimatedDialogContent body section has `overflow-y-auto`. If a child also has scroll (ScrollArea), we may get nested scrolling.

**Solution:** The ScrollArea components already have explicit `maxHeight` which constrains their size. The body section's `overflow-y-auto` only activates if total content exceeds viewport. Since ScrollArea constrains itself, there should be no conflict.

### Step 3: Test manually

1. Open Add Item dialog
2. Search for a movie with many posters
3. Go to wizard-poster step
4. Verify:
   - Poster grid scrolls within its ScrollArea
   - Dialog body does NOT scroll (poster grid fits)
   - Footer is visible

If issues found, add `overflow-visible` to body wrapper for wizard steps that have internal ScrollArea.

### Step 4: Document in code

Add comment to AnimatedDialogContent:

```typescript
/**
 * Note: Child components with their own ScrollArea (like image-selection-grid)
 * should work fine since they have explicit maxHeight constraints. The body
 * section's overflow-y-auto only activates for unconstrained content.
 */
```

### Step 5: Commit if changes needed

```bash
git add components/ui/animated-dialog-content.tsx
git commit -m "$(cat <<'EOF'
docs(ui): add note about nested ScrollArea compatibility

Documents that child ScrollArea components with explicit maxHeight
work correctly within the animated body section.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: E2E Tests for Sticky Footer Behavior

**Files:**

- Modify: `e2e/journeys/items/items-settings.spec.ts`
- Modify: `e2e/journeys/profile/settings.spec.ts`

### Step 1: Add E2E test for item settings with scroll verification

Add to `e2e/journeys/items/items-settings.spec.ts`:

```typescript
test("dialog footer remains visible while body scrolls", async ({
  itemsPage,
}) => {
  await itemsPage.goto();
  await itemsPage.createItem("Scroll Test");
  await itemsPage.waitForToastToDisappear();
  await itemsPage.switchToTreeView();

  await itemsPage.openSettingsViaContextMenu("Scroll Test");

  // Switch to Files tab which may have more content
  const filesTab = itemsPage.page.getByRole("tab", { name: /files/i });
  await filesTab.click();

  // Footer should be visible initially
  const footer = itemsPage.page.locator("[data-slot='dialog-footer-wrapper']");
  await expect(footer).toBeVisible();
  await expect(footer).toBeInViewport();

  // Get the body section
  const body = itemsPage.page.locator("[data-slot='dialog-body']");

  // If body is scrollable, scroll to bottom
  const isScrollable = await body.evaluate(
    (el) => el.scrollHeight > el.clientHeight
  );
  if (isScrollable) {
    await body.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    // Footer should STILL be visible after scroll
    await expect(footer).toBeInViewport();
  }

  // Save button should always be accessible
  const saveButton = footer.getByRole("button", { name: /save/i });
  await expect(saveButton).toBeVisible();
});
```

### Step 2: Add E2E test for profile settings

Add to `e2e/journeys/profile/settings.spec.ts`:

```typescript
test("dialog footer remains visible across all tabs", async ({
  page,
  settingsPage,
}) => {
  await settingsPage.goto();
  await settingsPage.openSettings();

  const footer = page.locator("[data-slot='dialog-footer-wrapper']");

  // Test each tab
  const tabs = ["Profile", "Preferences", "Activity"];
  for (const tabName of tabs) {
    const tab = page.getByRole("tab", { name: new RegExp(tabName, "i") });
    await tab.click();

    // Footer should be visible on every tab
    await expect(footer).toBeVisible();
    await expect(footer).toBeInViewport();
  }
});
```

### Step 3: Run E2E tests

Run: `pnpm test:e2e e2e/journeys/items/items-settings.spec.ts --grep "footer"`
Run: `pnpm test:e2e e2e/journeys/profile/settings.spec.ts --grep "footer"`
Expected: PASS

### Step 4: Commit

```bash
git add e2e/journeys/items/items-settings.spec.ts e2e/journeys/profile/settings.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add sticky footer scroll verification tests

Tests verify that dialog footers remain in viewport during scrolling
and across tab switches, ensuring action buttons are always accessible.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Mobile Viewport Testing

**Files:** None (manual verification)

### Step 1: Test on mobile viewport (375px)

1. Open browser DevTools
2. Set viewport to 375x667 (iPhone SE)
3. Test each dialog:
   - Add Item: Create item → verify footer visible
   - Item Settings: Right-click → Settings → verify footer visible
   - Profile Settings: Click avatar → Settings → verify footer visible

### Step 2: Test with keyboard open (mobile simulation)

1. Set viewport to 375x400 (simulating keyboard open)
2. Open Add Item dialog
3. Focus on name input
4. Verify:
   - Dialog content compresses
   - Footer remains visible (may be closer to input)
   - No content gets cut off

### Step 3: Document any mobile-specific issues

If issues found, add responsive adjustments:

```css
/* Tighter spacing on mobile when viewport is constrained */
@media (max-height: 500px) {
  [data-slot="dialog-body"] {
    max-height: 40vh;
  }
}
```

---

## Task 11: Visual Regression Check

**Files:** None (manual verification)

### Step 1: Start dev server

Run: `pnpm dev`

### Step 2: Test each dialog manually

1. **Add Item Dialog**: Click "+" button
   - Verify header fixed at top
   - Add long description to make content scroll
   - Verify footer fixed at bottom during scroll
   - Go through TMDB wizard steps - verify footer on each

2. **Item Settings**: Right-click item → Settings
   - Verify header fixed at top
   - Switch between tabs (Details, Files, Activity)
   - Verify footer fixed at bottom on all tabs
   - Go through TMDB wizard - verify footer on each step

3. **Profile Settings**: Click avatar → Settings
   - Verify header fixed at top
   - Switch between tabs (Profile, Preferences, Activity)
   - Verify footer fixed at bottom on all tabs
   - Change password flow - verify footer visible

4. **Delete Confirmation**: Right-click item → Delete
   - Verify small dialog displays correctly
   - Footer (Cancel/Delete) visible without scroll

5. **Drive Disconnect**: Settings → Google Drive tab → Disconnect
   - Verify AlertDialog displays correctly
   - Footer (Cancel/Disconnect) visible

### Step 3: Test step transitions

1. Open Add Item dialog
2. Search for a TV show
3. Select it → Episode picker
4. Select season → Episodes
5. Select episode → Wizard steps

**Verify during each transition:**

- Header updates smoothly
- Body animates height
- Footer updates smoothly (no jumping)

### Step 4: Run full test suite

Run: `pnpm run check`
Expected: All checks pass

### Step 5: Commit final changes if needed

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: polish sticky footer implementation

Minor adjustments from visual regression testing.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Test Summary

### Unit Tests

| Test File                                                   | Tests Added  | Tests Modified | Tests Removed |
| ----------------------------------------------------------- | ------------ | -------------- | ------------- |
| `tests/unit/components/ui/animated-dialog-content.test.tsx` | 5            | 0              | 0             |
| `tests/unit/components/ui/dialog.test.tsx`                  | 3 (new file) | 0              | 0             |
| `tests/unit/components/ui/alert-dialog.test.tsx`            | 2 (new file) | 0              | 0             |
| `tests/unit/components/add-item-dialog.test.tsx`            | 2            | 0              | 0             |
| `tests/unit/components/items/item-settings-dialog.test.tsx` | 2            | 0              | 0             |
| `tests/unit/components/profile/settings-dialog.test.tsx`    | 2 (new file) | 0              | 0             |

### E2E Tests

| Test File                                   | Tests Added | Tests Modified | Tests Removed |
| ------------------------------------------- | ----------- | -------------- | ------------- |
| `e2e/journeys/items/items-settings.spec.ts` | 1           | 0              | 0             |
| `e2e/journeys/profile/settings.spec.ts`     | 1           | 0              | 0             |

### Integration Tests

No changes needed - integration tests focus on server actions, not UI layout.

---

## Files Changed Summary

| File                                                        | Action      | Description                              |
| ----------------------------------------------------------- | ----------- | ---------------------------------------- |
| `components/ui/animated-dialog-content.tsx`                 | **Rewrite** | Slot-based API with header/footer props  |
| `components/ui/dialog.tsx`                                  | Modify      | flex-col layout, shrink-0 pt-4 on footer |
| `components/ui/alert-dialog.tsx`                            | Modify      | flex-col layout, shrink-0 pt-4 on footer |
| `components/items/add-item-dialog.tsx`                      | **Major**   | Migrate all 8 steps to slot-based API    |
| `components/items/item-settings-dialog.tsx`                 | **Major**   | Migrate all 5 steps to slot-based API    |
| `components/profile/settings-dialog.tsx`                    | **Major**   | Migrate all 3 steps to slot-based API    |
| `tests/unit/components/ui/animated-dialog-content.test.tsx` | Modify      | Add slot-based API tests                 |
| `tests/unit/components/ui/dialog.test.tsx`                  | Create      | Footer and layout tests                  |
| `tests/unit/components/ui/alert-dialog.test.tsx`            | Create      | Footer and layout tests                  |
| `tests/unit/components/add-item-dialog.test.tsx`            | Modify      | Add slot-based layout tests              |
| `tests/unit/components/items/item-settings-dialog.test.tsx` | Modify      | Add slot-based layout tests              |
| `tests/unit/components/profile/settings-dialog.test.tsx`    | Create      | Slot-based layout tests                  |
| `e2e/journeys/items/items-settings.spec.ts`                 | Modify      | Add scroll verification test             |
| `e2e/journeys/profile/settings.spec.ts`                     | Modify      | Add tab switching test                   |

---

## Breaking Changes

This plan introduces a **breaking change** to `AnimatedDialogContent`:

**Before:**

```tsx
<AnimatedDialogContent stepKey={step}>
  <DialogHeader>...</DialogHeader>
  <div>Body content</div>
  <DialogFooter>...</DialogFooter>
</AnimatedDialogContent>
```

**After:**

```tsx
<AnimatedDialogContent
  stepKey={step}
  header={<DialogHeader>...</DialogHeader>}
  footer={<DialogFooter>...</DialogFooter>}
>
  <div>Body content (only this animates)</div>
</AnimatedDialogContent>
```

All usages of AnimatedDialogContent in the codebase are updated in this plan.
