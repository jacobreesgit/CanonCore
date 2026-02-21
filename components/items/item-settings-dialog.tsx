/**
 * Unified item settings dialog with tabbed interface and single atomic save.
 * Uses step-based navigation for TV episode picker and TMDB metadata wizard.
 * Consolidates name, description (Details tab) and file selections (Files tab).
 * Delegates form state management to useItemSettingsForm hook.
 */

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faImage,
  faFileLines,
  faFilm,
  faGears,
  faWandMagicSparkles,
  faChevronLeft,
  faChevronRight,
  faTv,
} from "@fortawesome/free-solid-svg-icons";
import { Dialog } from "@/components/ui/dialog";
import { AnimatedDialogContent } from "@/components/ui/animated-dialog-content";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileTypeCombobox } from "@/components/items/file-type-combobox";
import { MediaSearchCombobox } from "@/components/items/media-search-combobox";
import { ItemDialogTabs } from "@/components/items/item-dialog-tabs";
import { TMDBWizard } from "./wizards/tmdb-wizard";

import { TVPicker } from "./wizards/tv-picker";
import { TmdbDisplayOptionsEditor } from "@/components/items/tmdb-display-options";
import { cn } from "@/lib/utils";
import { VisibilityToggle } from "@/components/items/visibility-toggle";
import {
  useItemSettingsForm,
  type ItemSettingsFormItem,
  type ItemSettingsFormFiles,
} from "@/hooks/use-item-settings-form";

interface ItemSettingsDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** The item being configured */
  item: ItemSettingsFormItem;
  /** Files attached to this item, grouped by type (serialized for client) */
  files: ItemSettingsFormFiles;
  /** Whether user has Google Drive connected (enables uploads) */
  hasDriveConnection?: boolean;
  /** Optional callback when settings change (for refreshing data). Awaited to ensure sync. */
  onSettingsChange?: () => Promise<void>;
}

/**
 * Item settings dialog with tabbed interface and single atomic save.
 * Uses step-based navigation for TV shows and TMDB metadata wizard.
 * Delegates all form state to useItemSettingsForm hook.
 *
 * @param open - Whether dialog is visible
 * @param onOpenChange - Callback for visibility changes
 * @param item - Item metadata
 * @param files - Files grouped by type
 * @param hasDriveConnection - Whether uploads are enabled
 * @param onSettingsChange - Optional callback when settings are saved
 */
export function ItemSettingsDialog({
  open,
  onOpenChange,
  item,
  files,
  hasDriveConnection = false,
  onSettingsChange,
}: ItemSettingsDialogProps) {
  const form = useItemSettingsForm(item, files, onSettingsChange, () =>
    onOpenChange(false)
  );

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      form.resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Details tab content
  const detailsContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="item-name">Item name</Label>
        <div className="relative">
          <MediaSearchCombobox
            id="item-name"
            onSelect={form.handleMediaSelect}
            onChange={form.setName}
            value={form.name}
            placeholder="Search movies & TV shows…"
          />
          {(form.isLoadingPreview || form.isApplyingMetadata) && (
            <div className="bg-background/80 absolute inset-0 flex items-center justify-center rounded-md">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon
                  icon={faSpinner}
                  aria-hidden="true"
                  className="text-muted-foreground size-4"
                  spin
                />
                <span className="text-muted-foreground text-sm">
                  {form.isLoadingPreview ? "Loading preview…" : "Applying…"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="item-description">
          Description{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="item-description"
          value={form.description}
          onChange={(e) => form.setDescription(e.target.value)}
          placeholder="Add a short description…"
          maxLength={1000}
          className="min-h-[80px] resize-none"
        />
        <p className="text-muted-foreground text-xs tabular-nums">
          {form.description.length}/1000 characters
        </p>
      </div>

      {/* Visibility settings */}
      <div className="space-y-2 pt-2">
        <Label>Visibility</Label>
        <VisibilityToggle
          itemId={item.id}
          itemName={form.name}
          isPublic={form.isPublic}
          inheritVisibility={form.inheritVisibility}
          hasParent={item.hasParent}
          hasChildren={item.hasChildren}
          onVisibilityChange={(newIsPublic) => {
            form.setIsPublic(newIsPublic);
            onSettingsChange?.().catch((err) => {
              console.warn(
                "[ItemSettingsDialog] Refetch failed after visibility change:",
                err
              );
            });
          }}
          onInheritChange={(newInherit) => {
            form.setInheritVisibility(newInherit);
            onSettingsChange?.().catch((err) => {
              console.warn(
                "[ItemSettingsDialog] Refetch failed after inherit change:",
                err
              );
            });
          }}
        />
      </div>
    </div>
  );

  // Files tab content
  const filesContent = (
    <div className="space-y-4">
      {!hasDriveConnection && (
        <p className="text-muted-foreground border-muted rounded-lg border border-dashed p-3 text-center text-xs">
          Connect Google Drive to upload files.{" "}
          <Link
            href="/docs/google-drive/connect-drive"
            className="text-primary hover:underline"
          >
            Learn more
          </Link>
        </p>
      )}

      <FileTypeCombobox
        label="Primary Media"
        description="The file that plays when clicking on this item."
        icon={faFilm}
        files={files.media}
        selectedId={form.primaryMediaId}
        onSelect={form.setPrimaryMediaId}
        onUploadComplete={form.handleUploadComplete}
        onFileDeleted={form.handleFileDeleted}
        itemId={item.id}
        fileType="media"
        disabled={!hasDriveConnection}
      />

      <FileTypeCombobox
        label="Primary Artwork"
        description="The image used as the thumbnail."
        icon={faImage}
        files={files.artwork}
        selectedId={form.primaryArtworkId}
        onSelect={form.setPrimaryArtworkId}
        onUploadComplete={form.handleUploadComplete}
        onFileDeleted={form.handleFileDeleted}
        itemId={item.id}
        fileType="artwork"
        disabled={!hasDriveConnection}
      />

      <FileTypeCombobox
        label="Hero Image"
        description="The image used as the banner background."
        icon={faWandMagicSparkles}
        files={files.artwork}
        selectedId={form.heroArtworkId}
        onSelect={form.setHeroArtworkId}
        onUploadComplete={form.handleUploadComplete}
        onFileDeleted={form.handleFileDeleted}
        itemId={item.id}
        fileType="artwork"
        disabled={!hasDriveConnection}
      />

      <FileTypeCombobox
        label="Default Subtitle"
        description="The subtitle track that loads by default."
        icon={faFileLines}
        files={files.subtitles}
        selectedId={form.primarySubtitleId}
        onSelect={form.setPrimarySubtitleId}
        onUploadComplete={form.handleUploadComplete}
        onFileDeleted={form.handleFileDeleted}
        itemId={item.id}
        fileType="subtitle"
        disabled={!hasDriveConnection}
      />
    </div>
  );

  // TMDB tab content (only when item has TMDB metadata)
  const tmdbContent = item.tmdbId ? (
    <TmdbDisplayOptionsEditor
      displayOptions={form.displayOptions}
      onChange={form.handleDisplayOptionsChange}
    />
  ) : undefined;

  /**
   * Gets the header content for the current step.
   */
  const getStepHeader = () => {
    switch (form.currentStep) {
      case "main":
        return (
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-primary/10 ring-primary/20 ring-1"
                )}
              >
                <FontAwesomeIcon
                  icon={faGears}
                  aria-hidden="true"
                  className="text-primary size-5"
                />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg">Item Settings</DialogTitle>
                <DialogDescription className="text-sm">
                  {hasDriveConnection
                    ? "Configure display preferences and upload files"
                    : "Configure display preferences"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        );
      case "episode-picker":
        return (
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={form.handleEpisodePickerBack}
                className="hover:bg-muted/50 size-10 transition-all active:scale-95"
                aria-label="Back"
              >
                <FontAwesomeIcon
                  icon={faChevronLeft}
                  aria-hidden="true"
                  className="size-5"
                />
              </Button>
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-blue-500/10 ring-1 ring-blue-500/20"
                )}
              >
                <FontAwesomeIcon
                  icon={faTv}
                  aria-hidden="true"
                  className="size-5 text-blue-500"
                />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg">Select Season</DialogTitle>
                <DialogDescription className="truncate text-sm">
                  {form.displayTitle}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        );
      case "tmdb-wizard": {
        const wizardCurrentIndex = form.wizardHeaderProps
          ? form.wizardHeaderProps.steps.indexOf(
              form.wizardHeaderProps.currentStep
            )
          : 0;
        const wizardTotalSteps = form.wizardHeaderProps?.steps.length ?? 0;
        return (
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={form.handleWizardCancel}
                disabled={form.isApplyingMetadata}
                className="hover:bg-muted/50 size-10 transition-all active:scale-95"
                aria-label="Cancel"
              >
                <FontAwesomeIcon
                  icon={faChevronLeft}
                  aria-hidden="true"
                  className="size-5"
                />
              </Button>
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-brand/10 ring-brand/20 ring-1"
                )}
              >
                <FontAwesomeIcon
                  icon={faWandMagicSparkles}
                  aria-hidden="true"
                  className="text-brand size-5"
                />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg">Apply Metadata</DialogTitle>
                <DialogDescription className="text-sm">
                  {form.tmdbPreview?.name || "Select metadata to apply"}
                  {form.wizardHeaderProps && (
                    <span className="text-[var(--tertiary-foreground)]">
                      {" "}
                      · Step {wizardCurrentIndex + 1} of {wizardTotalSteps}
                    </span>
                  )}
                </DialogDescription>
              </div>
            </div>
            {form.wizardHeaderProps && (
              <>
                <div
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="sr-only"
                >
                  Step {wizardCurrentIndex + 1} of {wizardTotalSteps}:{" "}
                  {
                    form.wizardHeaderProps.stepLabels[
                      form.wizardHeaderProps.currentStep
                    ]
                  }
                </div>
                <div className="mt-3 flex gap-1.5" aria-hidden="true">
                  {form.wizardHeaderProps.steps.map((step, i) => (
                    <div
                      key={step}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-colors duration-300",
                        i <= wizardCurrentIndex ? "bg-brand" : "bg-white/10"
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </DialogHeader>
        );
      }
      default:
        return null;
    }
  };

  /**
   * Gets the footer content for the current step.
   */
  const getStepFooter = () => {
    switch (form.currentStep) {
      case "main":
        return (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={form.cancel}
              disabled={form.isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={form.save}
              disabled={!form.isDirty || form.isSaving}
            >
              {form.isSaving ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    aria-hidden="true"
                    className="size-4"
                    spin
                  />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        );
      case "episode-picker":
        return null;
      case "tmdb-wizard":
        if (!form.wizardFooterProps) return null;
        return (
          <DialogFooter>
            <div className="flex w-full justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={form.wizardFooterProps.onBack}
                disabled={form.wizardFooterProps.isDisabled}
              >
                <FontAwesomeIcon
                  icon={faChevronLeft}
                  className="mr-2 h-4 w-4"
                  aria-hidden="true"
                />
                Back
              </Button>
              <div className="flex gap-2">
                {form.wizardFooterProps.onSkipAll && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={form.wizardFooterProps.onSkipAll}
                    disabled={form.wizardFooterProps.isDisabled}
                  >
                    Skip All
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={form.wizardFooterProps.onNext}
                  disabled={form.wizardFooterProps.isDisabled}
                >
                  {form.wizardFooterProps.isLastStep ? "Apply" : "Next"}
                  {!form.wizardFooterProps.isLastStep && (
                    <FontAwesomeIcon
                      icon={faChevronRight}
                      className="ml-2 h-4 w-4"
                      aria-hidden="true"
                    />
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        );
      default:
        return null;
    }
  };

  /**
   * Gets the body content for the current step.
   */
  const getStepBody = () => {
    switch (form.currentStep) {
      case "main":
        return (
          <div className="min-w-0 py-2">
            {hasDriveConnection || tmdbContent ? (
              <ItemDialogTabs
                detailsContent={detailsContent}
                filesContent={hasDriveConnection ? filesContent : undefined}
                tmdbContent={tmdbContent}
              />
            ) : (
              <div className="space-y-4">{detailsContent}</div>
            )}
          </div>
        );
      case "episode-picker":
        if (!form.pendingTmdbResult) return null;
        return (
          <TVPicker
            initialData={{
              tmdbResult: form.pendingTmdbResult,
            }}
            onComplete={form.handleTVPickerComplete}
            onCancel={form.handleEpisodePickerCancel}
            onLevelChange={form.setTvPickerLevel}
            renderFooter={(props) => {
              form.tvPickerBackRef.current = props.onBack;
              return (
                <DialogFooter>
                  <Button
                    onClick={props.onUseSelection}
                    disabled={props.isDisabled}
                  >
                    {props.level === "show"
                      ? "Use This Show"
                      : "Use This Season"}
                  </Button>
                </DialogFooter>
              );
            }}
          />
        );
      case "tmdb-wizard":
        if (!form.tmdbPreview || !form.pendingTmdbResult) return null;
        return (
          <TMDBWizard
            initialData={{
              tmdbResult: form.pendingTmdbResult,
              preview: form.tmdbPreview,
              contentType: form.contentType,
            }}
            currentValues={form.currentValues}
            uploadMode={false}
            hasDriveConnection={hasDriveConnection}
            existingArtwork={files.artwork}
            existingHero={files.artwork}
            onComplete={form.handleTMDBWizardComplete}
            onHeaderChange={form.setWizardHeaderProps}
            onFooterChange={form.setWizardFooterProps}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatedDialogContent
        data-testid="dialog-item-settings"
        stepKey={form.currentStep}
        className="max-h-[90vh] sm:max-w-2xl"
        header={getStepHeader()}
        footer={getStepFooter()}
      >
        {getStepBody()}
      </AnimatedDialogContent>
    </Dialog>
  );
}
