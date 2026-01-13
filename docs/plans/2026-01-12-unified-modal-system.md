# Unified Modal System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate modal stacking by consolidating related modals into single unified dialogs with step-based content and animated height transitions.

**Architecture:** Replace layered modal patterns with step-based content inside a single DialogContent. Use motion/react's `layout` prop for automatic height animation when content changes, combined with `AnimatePresence` for step transitions. All modals share a consistent `sm:max-w-lg` width while height animates based on content.

**Tech Stack:** React, Radix Dialog, motion/react (Framer Motion), Tailwind CSS 4

---

## Breaking Changes Warning

This refactor will:

- **Remove 4 exported components** that may be imported elsewhere
- **Change test patterns** - tests expecting separate dialogs will fail
- **Alter keyboard focus behavior** - single dialog context affects focus trapping

Before implementing, verify no external consumers import:

- `ChangePasswordDialog`
- `ChangeEmailDialog`
- `EpisodePicker`
- `MetadataWizardModal`

---

## Current Modal Stacking Problems

| Stack   | Parent             | Child 1              | Child 2             |
| ------- | ------------------ | -------------------- | ------------------- |
| 3-level | AddItemDialog      | EpisodePicker        | MetadataWizardModal |
| 3-level | ItemSettingsDialog | EpisodePicker        | MetadataWizardModal |
| 2-level | SettingsDialog     | ChangePasswordDialog | -                   |
| 2-level | SettingsDialog     | ChangeEmailDialog    | -                   |

## Solution: Step-Based Content with Motion Height

### Unified Width Standard

All dialogs use: `max-w-[calc(100vw-2rem)] sm:max-w-lg`

### Height Animation Pattern

**Key insight:** Using `animate={{ height: "auto" }}` alone won't re-animate when inner content changes. The `layout` prop tells Motion to animate layout changes automatically.

```tsx
<motion.div
  layout
  transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
  className="overflow-hidden"
>
  <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={currentStep}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      {/* Step content */}
    </motion.div>
  </AnimatePresence>
</motion.div>
```

**Why `layout` prop:** When the keyed child changes, AnimatePresence handles the opacity/y transition. The `layout` prop on the parent detects the size change and smoothly animates the container height.

### Design Refinements

**Step Indicator Pattern** - Match existing wizard with `transition-colors` and dynamic mapping:

```tsx
const WIZARD_STEPS = ["text", "poster", "hero"] as const;
const currentStepIndex = WIZARD_STEPS.indexOf(currentStep);

<div className="flex gap-1.5 py-2">
  {WIZARD_STEPS.map((_, index) => (
    <div
      key={index}
      className={cn(
        "h-1 flex-1 rounded-full transition-colors duration-200",
        index <= currentStepIndex ? "bg-amber-500" : "bg-muted"
      )}
    />
  ))}
</div>;
```

**Content Area Stability** - Prevent layout jank with minimum height:

```tsx
<div className="min-h-[300px] py-2">{/* Step content */}</div>
```

**Back Button Polish** - Subtle hover/active states:

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={onBack}
  className="hover:bg-muted/50 transition-all active:scale-95"
>
  <ChevronLeft className="size-4" />
</Button>
```

**Reduced Motion Accessibility** - Respect user preferences:

```tsx
import { useReducedMotion } from "motion/react";

const shouldReduceMotion = useReducedMotion();

<motion.div
  layout={!shouldReduceMotion}
  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
  // ...
>
```

### State Management Pattern

For complex dialogs with many steps (AddItemDialog, ItemSettingsDialog), use `useReducer` to manage state:

```typescript
type DialogState = {
  step: AddItemStep;
  formData: { name: string; description: string /* ... */ };
  tmdbResult: TMDBSearchResult | null;
  episodeSelection: EpisodeSelection | null;
  wizardSelections: WizardSelections;
};

type DialogAction =
  | { type: "SET_STEP"; step: AddItemStep }
  | { type: "SET_FORM_DATA"; data: Partial<FormData> }
  | { type: "SET_TMDB_RESULT"; result: TMDBSearchResult }
  | { type: "RESET" };

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_FORM_DATA":
      return { ...state, formData: { ...state.formData, ...action.data } };
    // ... other cases
  }
}
```

This prevents prop drilling and makes state flow explicit.

---

## Task 1: Create AnimatedDialogContent Component

**Files:**

- Create: `components/ui/animated-dialog-content.tsx`
- Test: `tests/unit/components/ui/animated-dialog-content.test.tsx`

**Step 1: Write the failing test**

```typescript
/**
 * Unit tests for AnimatedDialogContent component.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnimatedDialogContent } from "@/components/ui/animated-dialog-content";
import { Dialog } from "@/components/ui/dialog";

// Mock framer-motion
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<"div">) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

describe("AnimatedDialogContent", () => {
  it("should render children", () => {
    render(
      <Dialog open>
        <AnimatedDialogContent stepKey="step1">
          <div>Test Content</div>
        </AnimatedDialogContent>
      </Dialog>
    );
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("should apply consistent width class", () => {
    render(
      <Dialog open>
        <AnimatedDialogContent stepKey="step1" data-testid="dialog">
          Content
        </AnimatedDialogContent>
      </Dialog>
    );
    const dialog = screen.getByTestId("dialog");
    expect(dialog.className).toContain("sm:max-w-lg");
  });

  it("should accept custom className", () => {
    render(
      <Dialog open>
        <AnimatedDialogContent stepKey="step1" className="custom-class">
          Content
        </AnimatedDialogContent>
      </Dialog>
    );
    expect(document.querySelector(".custom-class")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/ui/animated-dialog-content.test.tsx`
Expected: FAIL - module not found

**Step 3: Write the component**

```typescript
/**
 * Animated dialog content with smooth height transitions between steps.
 * Maintains consistent width while animating height changes.
 */

"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnimatedDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Unique key for current step (triggers animation on change) */
  stepKey: string;
  /** Whether to show close button (default: true) */
  showClose?: boolean;
}

/**
 * Dialog content wrapper with animated height transitions.
 * Use stepKey to trigger height animation when content changes.
 * Respects prefers-reduced-motion for accessibility.
 *
 * @param stepKey - Unique identifier for current step
 * @param showClose - Whether to show close button
 * @param className - Additional classes
 * @param children - Dialog content
 */
const AnimatedDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  AnimatedDialogContentProps
>(({ className, children, stepKey, showClose = true, ...props }, ref) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80"
        )}
      />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100vw-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {/* layout prop enables automatic height animation on content changes */}
        {/* Respects prefers-reduced-motion for accessibility */}
        <motion.div
          layout={!shouldReduceMotion}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }
          }
          className="overflow-hidden"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={stepKey}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0.1 }
                  : { duration: 0.2, ease: "easeOut" }
              }
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {showClose && (
          <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
AnimatedDialogContent.displayName = "AnimatedDialogContent";

export { AnimatedDialogContent };
```

**Step 4: Run tests**

Run: `pnpm test tests/unit/components/ui/animated-dialog-content.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/ui/animated-dialog-content.tsx tests/unit/components/ui/animated-dialog-content.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add AnimatedDialogContent for step-based modals

Wraps Radix dialog with motion/react layout prop for smooth height
transitions. Uses consistent sm:max-w-lg width across all steps.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Unify SettingsDialog with Inline Password/Email Forms

**Files:**

- Modify: `components/profile/settings-dialog.tsx`
- Test: `tests/unit/components/profile/settings-dialog.test.tsx`

**Step 1: Define step types and content structure**

The unified dialog will have these steps:

- `main` - Main settings view (current content)
- `password` - Change password form (inline, not separate modal)
- `email` - Change email form (inline, not separate modal)

**Step 2: Update SettingsDialog to use step-based content**

Replace the modal pattern with inline step navigation:

```typescript
// Add step state
type SettingsStep = "main" | "password" | "email";
const [currentStep, setCurrentStep] = useState<SettingsStep>("main");

// Reset step when dialog closes
useEffect(() => {
  if (!open) {
    setCurrentStep("main");
  }
}, [open]);
```

**Step 3: Implement inline password change content**

Extract the password change form from `ChangePasswordDialog` and embed it inline:

```tsx
function PasswordChangeContent({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await changePassword({ currentPassword, newPassword });
      if (result.success) {
        toast.success("Password changed");
        onSuccess();
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to change password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="hover:bg-muted/50 transition-all active:scale-95"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <DialogTitle>Change Password</DialogTitle>
        </div>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-destructive text-sm">{error}</p>}
        <PasswordInput
          label="Current Password"
          value={currentPassword}
          onChange={setCurrentPassword}
        />
        <PasswordInput
          label="New Password"
          value={newPassword}
          onChange={setNewPassword}
        />
        <PasswordInput
          label="Confirm Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onBack}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="animate-spin" />
            ) : (
              "Change Password"
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
```

**Step 4: Implement inline email change content**

Similar pattern for email change:

```tsx
function EmailChangeContent({
  currentEmail,
  onBack,
  onSuccess,
}: {
  currentEmail: string;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await changeEmail({ newEmail, password });
      if (result.success) {
        toast.success("Email changed");
        onSuccess();
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to change email");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="hover:bg-muted/50 transition-all active:scale-95"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <DialogTitle>Change Email</DialogTitle>
        </div>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div>
          <Label>Current Email</Label>
          <p className="text-muted-foreground text-sm">{currentEmail}</p>
        </div>
        <Input
          type="email"
          label="New Email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <PasswordInput
          label="Password"
          value={password}
          onChange={setPassword}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onBack}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="animate-spin" />
            ) : (
              "Change Email"
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
```

**Step 5: Replace child dialogs with step content**

```tsx
// Instead of:
<ChangePasswordDialog open={changePasswordOpen} ... />
<ChangeEmailDialog open={changeEmailOpen} ... />

// Use AnimatedDialogContent with step-based rendering:
<Dialog open={open} onOpenChange={onOpenChange}>
  <AnimatedDialogContent stepKey={currentStep}>
    {currentStep === "main" && <MainSettingsContent onPasswordClick={() => setCurrentStep("password")} onEmailClick={() => setCurrentStep("email")} />}
    {currentStep === "password" && <PasswordChangeContent onBack={() => setCurrentStep("main")} onSuccess={() => setCurrentStep("main")} />}
    {currentStep === "email" && <EmailChangeContent currentEmail={email} onBack={() => setCurrentStep("main")} onSuccess={() => setCurrentStep("main")} />}
  </AnimatedDialogContent>
</Dialog>
```

**Step 6: Update tests**

Add tests for step navigation:

```typescript
it("should show password form when clicking Change Password", async () => {
  const user = userEvent.setup();
  render(<SettingsDialog open={true} ... />);

  await user.click(screen.getByRole("button", { name: /change password/i }));

  expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
});

it("should return to main view when clicking Back", async () => {
  const user = userEvent.setup();
  render(<SettingsDialog open={true} ... />);

  await user.click(screen.getByRole("button", { name: /change password/i }));
  await user.click(screen.getByRole("button", { name: /back/i }));

  expect(screen.getByText(/google drive/i)).toBeInTheDocument();
});
```

**Step 7: Run tests**

Run: `pnpm test tests/unit/components/profile/settings-dialog.test.tsx`
Expected: All tests pass

**Step 8: Commit**

```bash
git add components/profile/settings-dialog.tsx tests/unit/components/profile/settings-dialog.test.tsx
git commit -m "$(cat <<'EOF'
refactor(settings): unify settings dialog with inline password/email steps

Replaces modal stacking with step-based content and animated height
transitions. Password and email changes now happen inline with back
navigation instead of opening separate modals.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Unify AddItemDialog with Inline Episode Picker and Wizard

**Files:**

- Modify: `components/items/add-item-dialog.tsx`
- Test: `tests/unit/components/items/add-item-dialog.test.tsx`

**Step 1: Define unified step structure**

```typescript
type AddItemStep =
  | "details" // Main form (Details tab)
  | "files" // Files tab
  | "episode-picker" // TV show drill-down (seasons/episodes)
  | "wizard-text" // Metadata wizard step 1
  | "wizard-poster" // Metadata wizard step 2
  | "wizard-hero"; // Metadata wizard step 3
```

**Step 2: Implement useReducer for complex state**

```typescript
type AddItemState = {
  step: AddItemStep;
  activeTab: "details" | "files";
  name: string;
  description: string;
  tmdbResult: TMDBSearchResult | null;
  seasons: TMDBSeason[];
  selectedSeason: number | null;
  episodes: TMDBEpisode[];
  selectedEpisode: number | null;
  textPreview: TextPreviewData | null;
  images: TMDBImages | null;
  wizardSelections: MetadataWizardResult | null;
};

type AddItemAction =
  | { type: "SET_STEP"; step: AddItemStep }
  | { type: "SET_TAB"; tab: "details" | "files" }
  | { type: "SET_NAME"; name: string }
  | { type: "SET_DESCRIPTION"; description: string }
  | { type: "SET_TMDB_RESULT"; result: TMDBSearchResult }
  | { type: "SET_SEASONS"; seasons: TMDBSeason[] }
  | { type: "SELECT_SEASON"; seasonNumber: number }
  | { type: "SET_EPISODES"; episodes: TMDBEpisode[] }
  | { type: "SELECT_EPISODE"; episodeNumber: number }
  | { type: "SET_TEXT_PREVIEW"; preview: TextPreviewData }
  | { type: "SET_IMAGES"; images: TMDBImages }
  | { type: "SET_WIZARD_SELECTIONS"; selections: MetadataWizardResult }
  | { type: "RESET" };

function addItemReducer(
  state: AddItemState,
  action: AddItemAction
): AddItemState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_TAB":
      return { ...state, activeTab: action.tab };
    case "SET_NAME":
      return { ...state, name: action.name };
    case "SET_DESCRIPTION":
      return { ...state, description: action.description };
    case "SET_TMDB_RESULT":
      return { ...state, tmdbResult: action.result };
    case "SET_SEASONS":
      return { ...state, seasons: action.seasons };
    case "SELECT_SEASON":
      return {
        ...state,
        selectedSeason: action.seasonNumber,
        episodes: [],
        selectedEpisode: null,
      };
    case "SET_EPISODES":
      return { ...state, episodes: action.episodes };
    case "SELECT_EPISODE":
      return { ...state, selectedEpisode: action.episodeNumber };
    case "SET_TEXT_PREVIEW":
      return { ...state, textPreview: action.preview };
    case "SET_IMAGES":
      return { ...state, images: action.images };
    case "SET_WIZARD_SELECTIONS":
      return { ...state, wizardSelections: action.selections };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}
```

**Step 3: Implement inline episode picker content**

```tsx
function EpisodePickerContent({
  tmdbResult,
  seasons,
  selectedSeason,
  episodes,
  selectedEpisode,
  onSeasonSelect,
  onEpisodeSelect,
  onBack,
  onConfirm,
  isLoading,
}: {
  tmdbResult: TMDBSearchResult;
  seasons: TMDBSeason[];
  selectedSeason: number | null;
  episodes: TMDBEpisode[];
  selectedEpisode: number | null;
  onSeasonSelect: (seasonNumber: number) => void;
  onEpisodeSelect: (episodeNumber: number) => void;
  onBack: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="hover:bg-muted/50 transition-all active:scale-95"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div>
            <DialogTitle>{tmdbResult.title}</DialogTitle>
            <DialogDescription>Select season and episode</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4">
        {/* Season selector */}
        <div className="space-y-2">
          <Label>Season</Label>
          <Select
            value={selectedSeason?.toString()}
            onValueChange={(v) => onSeasonSelect(Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select season" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((season) => (
                <SelectItem
                  key={season.season_number}
                  value={season.season_number.toString()}
                >
                  {season.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Episode selector (visible after season selected) */}
        {selectedSeason !== null && (
          <div className="space-y-2">
            <Label>Episode</Label>
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-muted-foreground text-sm">
                  Loading episodes...
                </span>
              </div>
            ) : (
              <Select
                value={selectedEpisode?.toString()}
                onValueChange={(v) => onEpisodeSelect(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select episode" />
                </SelectTrigger>
                <SelectContent>
                  {episodes.map((episode) => (
                    <SelectItem
                      key={episode.episode_number}
                      value={episode.episode_number.toString()}
                    >
                      {episode.episode_number}. {episode.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onBack}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={selectedEpisode === null}>
          Continue
        </Button>
      </DialogFooter>
    </>
  );
}
```

**Step 4: Implement inline wizard step contents**

```tsx
const WIZARD_STEPS = ["text", "poster", "hero"] as const;
type WizardStep = (typeof WIZARD_STEPS)[number];

function WizardStepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const currentIndex = WIZARD_STEPS.indexOf(currentStep);
  return (
    <div className="flex gap-1.5 py-2">
      {WIZARD_STEPS.map((_, index) => (
        <div
          key={index}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors duration-200",
            index <= currentIndex ? "bg-amber-500" : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}

function WizardTextContent({
  currentValues,
  textPreview,
  options,
  onOptionsChange,
  onBack,
  onNext,
}: {
  currentValues: CurrentTextValues;
  textPreview: TextPreviewData;
  options: TitleDescriptionOptions;
  onOptionsChange: (options: TitleDescriptionOptions) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="hover:bg-muted/50 transition-all active:scale-95"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div>
            <DialogTitle>Title & Description</DialogTitle>
            <DialogDescription>Step 1 of 3</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <WizardStepIndicator currentStep="text" />

      <div className="min-h-[300px] py-2">
        <TitleDescriptionStep
          currentValues={currentValues}
          preview={textPreview}
          options={options}
          onOptionsChange={onOptionsChange}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onBack}>
          Cancel
        </Button>
        <Button onClick={onNext}>
          Next <ChevronRight className="ml-1 size-4" />
        </Button>
      </DialogFooter>
    </>
  );
}

function WizardPosterContent({
  posters,
  existingFiles,
  selectedValue,
  selectedSource,
  onSelect,
  isSkipped,
  onSkipChange,
  onBack,
  onNext,
}: {
  posters: TMDBImage[];
  existingFiles: ExistingArtworkFile[];
  selectedValue: string | null;
  selectedSource: "tmdb" | "existing" | null;
  onSelect: (value: string | null, source: "tmdb" | "existing") => void;
  isSkipped: boolean;
  onSkipChange: (skipped: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="hover:bg-muted/50 transition-all active:scale-95"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div>
            <DialogTitle>Select Poster</DialogTitle>
            <DialogDescription>Step 2 of 3</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <WizardStepIndicator currentStep="poster" />

      <div className="min-h-[300px] py-2">
        <PosterSelectionStep
          posters={posters}
          existingFiles={existingFiles}
          selectedValue={selectedValue}
          selectedSource={selectedSource}
          onSelect={onSelect}
          isSkipped={isSkipped}
          onSkipChange={onSkipChange}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          Next <ChevronRight className="ml-1 size-4" />
        </Button>
      </DialogFooter>
    </>
  );
}

function WizardHeroContent({
  backdrops,
  existingFiles,
  selectedValue,
  selectedSource,
  onSelect,
  isSkipped,
  onSkipChange,
  onBack,
  onApply,
  isApplying,
}: {
  backdrops: TMDBImage[];
  existingFiles: ExistingArtworkFile[];
  selectedValue: string | null;
  selectedSource: "tmdb" | "existing" | null;
  onSelect: (value: string | null, source: "tmdb" | "existing") => void;
  isSkipped: boolean;
  onSkipChange: (skipped: boolean) => void;
  onBack: () => void;
  onApply: () => void;
  isApplying: boolean;
}) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            disabled={isApplying}
            className="hover:bg-muted/50 transition-all active:scale-95 disabled:opacity-50"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div>
            <DialogTitle>Select Hero</DialogTitle>
            <DialogDescription>Step 3 of 3</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <WizardStepIndicator currentStep="hero" />

      <div className="min-h-[300px] py-2">
        <HeroSelectionStep
          backdrops={backdrops}
          existingFiles={existingFiles}
          selectedValue={selectedValue}
          selectedSource={selectedSource}
          onSelect={onSelect}
          isSkipped={isSkipped}
          onSkipChange={onSkipChange}
          disabled={isApplying}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onBack} disabled={isApplying}>
          Back
        </Button>
        <Button onClick={onApply} disabled={isApplying}>
          {isApplying ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Applying...
            </>
          ) : (
            "Apply"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
```

**Step 5: Convert to step-based content**

Remove the separate dialogs and use inline step content:

```tsx
// Remove these:
<EpisodePicker open={showEpisodePicker} ... />
<MetadataWizardModal open={showWizard} ... />

// Replace with step content inside main dialog:
<Dialog open={open} onOpenChange={handleOpenChange}>
  <AnimatedDialogContent stepKey={state.step}>
    {state.step === "details" && <DetailsTabContent state={state} dispatch={dispatch} />}
    {state.step === "files" && <FilesTabContent state={state} dispatch={dispatch} />}
    {state.step === "episode-picker" && (
      <EpisodePickerContent
        tmdbResult={state.tmdbResult!}
        seasons={state.seasons}
        selectedSeason={state.selectedSeason}
        episodes={state.episodes}
        selectedEpisode={state.selectedEpisode}
        onSeasonSelect={(n) => dispatch({ type: "SELECT_SEASON", seasonNumber: n })}
        onEpisodeSelect={(n) => dispatch({ type: "SELECT_EPISODE", episodeNumber: n })}
        onBack={() => dispatch({ type: "SET_STEP", step: "details" })}
        onConfirm={handleEpisodeConfirm}
        isLoading={isLoadingEpisodes}
      />
    )}
    {state.step === "wizard-text" && (
      <WizardTextContent
        currentValues={{ name: state.name, description: state.description }}
        textPreview={state.textPreview!}
        options={wizardOptions}
        onOptionsChange={setWizardOptions}
        onBack={() => dispatch({ type: "SET_STEP", step: "details" })}
        onNext={() => dispatch({ type: "SET_STEP", step: "wizard-poster" })}
      />
    )}
    {state.step === "wizard-poster" && (
      <WizardPosterContent
        posters={state.images?.posters || []}
        existingFiles={existingArtwork}
        selectedValue={posterValue}
        selectedSource={posterSource}
        onSelect={handlePosterSelect}
        isSkipped={posterSkipped}
        onSkipChange={setPosterSkipped}
        onBack={() => dispatch({ type: "SET_STEP", step: "wizard-text" })}
        onNext={() => dispatch({ type: "SET_STEP", step: "wizard-hero" })}
      />
    )}
    {state.step === "wizard-hero" && (
      <WizardHeroContent
        backdrops={state.images?.backdrops || []}
        existingFiles={existingArtwork}
        selectedValue={backdropValue}
        selectedSource={backdropSource}
        onSelect={handleBackdropSelect}
        isSkipped={backdropSkipped}
        onSkipChange={setBackdropSkipped}
        onBack={() => dispatch({ type: "SET_STEP", step: "wizard-poster" })}
        onApply={handleWizardComplete}
        isApplying={isApplying}
      />
    )}
  </AnimatedDialogContent>
</Dialog>
```

**Step 6: Update navigation handlers**

```typescript
const handleMediaSelect = async (result: TMDBSearchResult) => {
  dispatch({ type: "SET_TMDB_RESULT", result });
  if (result.mediaType === "tv") {
    // Fetch seasons and navigate to episode picker
    const seasons = await getSeasonsAction(result.id);
    dispatch({ type: "SET_SEASONS", seasons });
    dispatch({ type: "SET_STEP", step: "episode-picker" });
  } else {
    await fetchPreviewAndProceedToWizard(result.id, result.mediaType);
  }
};

const handleEpisodeConfirm = async () => {
  if (state.selectedSeason === null || state.selectedEpisode === null) return;
  const preview = await getMetadataPreviewAction(
    state.tmdbResult!.id,
    "tv",
    state.selectedSeason,
    state.selectedEpisode
  );
  dispatch({ type: "SET_TEXT_PREVIEW", preview });
  const images = await getImagesAction(state.tmdbResult!.id, "tv");
  dispatch({ type: "SET_IMAGES", images });
  dispatch({ type: "SET_STEP", step: "wizard-text" });
};
```

**Step 7: Update tests for unified flow**

```typescript
it("should show episode picker step when selecting TV show", async () => {
  const user = userEvent.setup();
  render(<AddItemDialog open={true} ... />);

  // Search and select a TV show
  await user.type(screen.getByRole("combobox"), "Breaking Bad");
  await user.click(await screen.findByText(/breaking bad/i));

  // Should show episode picker inline, not a separate modal
  expect(screen.getByText(/select season/i)).toBeInTheDocument();
});

it("should navigate through wizard steps inline", async () => {
  const user = userEvent.setup();
  render(<AddItemDialog open={true} ... />);

  // Select a movie to trigger wizard
  await user.type(screen.getByRole("combobox"), "Inception");
  await user.click(await screen.findByText(/inception/i));

  // Step 1: Title & Description
  expect(screen.getByText(/title & description/i)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /next/i }));

  // Step 2: Poster
  expect(screen.getByText(/select poster/i)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /next/i }));

  // Step 3: Hero
  expect(screen.getByText(/select hero/i)).toBeInTheDocument();
});
```

**Step 8: Run tests**

Run: `pnpm test tests/unit/components/items/add-item-dialog.test.tsx`
Expected: All tests pass

**Step 9: Commit**

```bash
git add components/items/add-item-dialog.tsx tests/unit/components/items/add-item-dialog.test.tsx
git commit -m "$(cat <<'EOF'
refactor(add-item): unify dialog with inline episode picker and wizard

Consolidates 3-level modal stack into single dialog with step-based
content. Episode selection and metadata wizard now animate inline
instead of opening separate modals. Uses useReducer for state.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Unify ItemSettingsDialog with Inline Episode Picker and Wizard

**Files:**

- Modify: `components/items/item-settings-dialog.tsx`
- Test: `tests/unit/components/items/item-settings-dialog.test.tsx`

**Step 1: Apply same pattern as AddItemDialog**

The ItemSettingsDialog has the same 3-level stack pattern. Apply identical refactoring:

```typescript
type ItemSettingsStep =
  | "details"
  | "files"
  | "episode-picker"
  | "wizard-text"
  | "wizard-poster"
  | "wizard-hero";
```

**Step 2: Convert to step-based content**

Same approach - replace child dialogs with step content inside AnimatedDialogContent. Reuse the same inline content components from AddItemDialog where possible (extract to shared module if needed).

**Step 3: Update tests**

Mirror the AddItemDialog tests for settings dialog context.

**Step 4: Run tests**

Run: `pnpm test tests/unit/components/items/item-settings-dialog.test.tsx`
Expected: All tests pass

**Step 5: Commit**

```bash
git add components/items/item-settings-dialog.tsx tests/unit/components/items/item-settings-dialog.test.tsx
git commit -m "$(cat <<'EOF'
refactor(item-settings): unify dialog with inline episode picker and wizard

Same pattern as add-item-dialog - consolidates 3-level modal stack
into single dialog with animated step transitions.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Remove Standalone Modal Components

**Files:**

- Delete: `components/profile/change-password-dialog.tsx`
- Delete: `components/profile/change-email-dialog.tsx`
- Modify: `components/profile/index.ts` (remove exports)
- Delete: `components/items/episode-picker.tsx`
- Delete: `components/items/metadata-wizard-modal.tsx`

**Step 1: Verify no external imports**

```bash
grep -r "ChangePasswordDialog" --include="*.tsx" --include="*.ts" | grep -v "settings-dialog"
grep -r "ChangeEmailDialog" --include="*.tsx" --include="*.ts" | grep -v "settings-dialog"
grep -r "EpisodePicker" --include="*.tsx" --include="*.ts" | grep -v "add-item-dialog\|item-settings-dialog"
grep -r "MetadataWizardModal" --include="*.tsx" --include="*.ts" | grep -v "add-item-dialog\|item-settings-dialog"
```

Expected: No external usages

**Step 2: Delete standalone components**

```bash
rm components/profile/change-password-dialog.tsx
rm components/profile/change-email-dialog.tsx
rm components/items/episode-picker.tsx
rm components/items/metadata-wizard-modal.tsx
```

**Step 3: Update barrel exports**

Update `components/profile/index.ts`:

```typescript
// Remove these exports:
// export { ChangePasswordDialog } from "./change-password-dialog";
// export { ChangeEmailDialog } from "./change-email-dialog";
```

**Step 4: Delete associated tests**

```bash
rm tests/unit/components/profile/change-password-dialog.test.tsx
rm tests/unit/components/profile/change-email-dialog.test.tsx
rm tests/unit/components/items/episode-picker.test.tsx
rm tests/unit/components/items/metadata-wizard-modal.test.tsx
```

**Step 5: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (with reduced count)

**Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: remove standalone modal components after unification

Deleted change-password-dialog, change-email-dialog, episode-picker,
and metadata-wizard-modal. Their functionality is now inline within
their parent dialogs.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update E2E Tests for Unified Modals

**Files:**

- Modify: `e2e/journeys/profile/settings.spec.ts`
- Modify: `e2e/journeys/items/add-item.spec.ts` (if exists)
- Modify: `e2e/journeys/items/items-settings.spec.ts`

**Step 1: Update settings E2E tests**

Remove expectations for separate modals, update for inline forms:

```typescript
// Old pattern:
await page.getByRole("button", { name: /change password/i }).click();
await expect(page.getByRole("dialog").nth(1)).toBeVisible(); // Second modal

// New pattern:
await page.getByRole("button", { name: /change password/i }).click();
await expect(page.getByRole("button", { name: /back/i })).toBeVisible();
await expect(page.getByLabelText(/current password/i)).toBeVisible();
```

**Step 2: Update item dialog E2E tests**

Update TMDB flow tests for inline wizard:

```typescript
// Old pattern expected separate dialogs
// New pattern: all within same dialog with step transitions

await page.getByRole("combobox").fill("Breaking Bad");
await page.getByText(/breaking bad/i).click();
// Episode picker is now inline
await expect(page.getByText(/select season/i)).toBeVisible();
await page.getByText(/season 1/i).click();
// Wizard is now inline
await expect(page.getByText(/title & description/i)).toBeVisible();
```

**Step 3: Run E2E tests**

Run: `pnpm test:e2e --project=chromium`
Expected: All tests pass

**Step 4: Commit**

```bash
git add e2e/
git commit -m "$(cat <<'EOF'
test(e2e): update tests for unified modal patterns

Removed expectations for stacked modals, updated to verify inline
step navigation within single dialogs.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Run Full Test Suite and Checks

**Step 1: Run unit tests**

Run: `pnpm test`
Expected: All tests pass

**Step 2: Run E2E tests**

Run: `pnpm test:e2e`
Expected: All tests pass

**Step 3: Run checks**

Run: `pnpm run check`
Expected: All checks pass (format, lint, type-check, knip, build)

**Step 4: Final commit if any fixes needed**

---

## Test Summary

### Unit Tests

| File                                                            | Change                    |
| --------------------------------------------------------------- | ------------------------- |
| `tests/unit/components/ui/animated-dialog-content.test.tsx`     | NEW (3 tests)             |
| `tests/unit/components/profile/settings-dialog.test.tsx`        | MODIFIED (add step tests) |
| `tests/unit/components/items/add-item-dialog.test.tsx`          | MODIFIED (add step tests) |
| `tests/unit/components/items/item-settings-dialog.test.tsx`     | MODIFIED (add step tests) |
| `tests/unit/components/profile/change-password-dialog.test.tsx` | DELETED                   |
| `tests/unit/components/profile/change-email-dialog.test.tsx`    | DELETED                   |
| `tests/unit/components/items/episode-picker.test.tsx`           | DELETED                   |
| `tests/unit/components/items/metadata-wizard-modal.test.tsx`    | DELETED                   |

### E2E Tests

| File                                        | Change                   |
| ------------------------------------------- | ------------------------ |
| `e2e/journeys/profile/settings.spec.ts`     | MODIFIED (inline forms)  |
| `e2e/journeys/items/items-settings.spec.ts` | MODIFIED (inline wizard) |

### Integration Tests

No changes required - integration tests use server actions directly.

### Test Limitations

Note: The following aspects are difficult to fully test in unit tests:

- **Height animation timing** - Motion layout animations are mocked, so actual animation duration/easing cannot be verified
- **Focus trap behavior** - Radix Dialog's focus management is complex and may need manual E2E verification
- **Animation interruption** - Rapid step changes during animation may have edge cases

E2E tests should include visual regression checks for animation smoothness if possible.

---

## Files Changed Summary

| File                                            | Change                  |
| ----------------------------------------------- | ----------------------- |
| `components/ui/animated-dialog-content.tsx`     | CREATE                  |
| `components/profile/settings-dialog.tsx`        | MODIFY (major refactor) |
| `components/profile/change-password-dialog.tsx` | DELETE                  |
| `components/profile/change-email-dialog.tsx`    | DELETE                  |
| `components/profile/index.ts`                   | MODIFY (remove exports) |
| `components/items/add-item-dialog.tsx`          | MODIFY (major refactor) |
| `components/items/item-settings-dialog.tsx`     | MODIFY (major refactor) |
| `components/items/episode-picker.tsx`           | DELETE                  |
| `components/items/metadata-wizard-modal.tsx`    | DELETE                  |

---

## Benefits

1. **No modal stacking** - Single dialog with animated content transitions
2. **Consistent width** - All dialogs use `sm:max-w-lg`
3. **Smooth UX** - Height animates between steps with easing via `layout` prop
4. **Simpler state** - useReducer pattern for complex dialogs, no need to manage multiple open states
5. **Better accessibility** - Single dialog context for screen readers
6. **Reduced bundle** - Less component code after consolidation

## Out of Scope

- Keyboard shortcuts for step navigation
- Step progress indicators (beyond existing wizard dots)
- Swipe gestures for step navigation on mobile
- Persisting step state across dialog closes
