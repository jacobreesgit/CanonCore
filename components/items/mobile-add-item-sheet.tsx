/**
 * Mobile bottom sheet for creating new items.
 * Mirrors MobileItemSheet architecture using useAddItemForm hook.
 * Supports step-based navigation for TV picker, TMDB wizard,
 * wizard summary (with artwork), and change poster/hero steps.
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faSpinner,
  faWandMagicSparkles,
  faChevronLeft,
  faChevronRight,
  faTv,
  faFilm,
  faImage,
  faFileLines,
  faTrashCan,
  faCircleExclamation,
  faArrowsRotate,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  MobileBottomSheet,
  MobileBottomSheetHeader,
  MobileBottomSheetTitle,
  MobileBottomSheetContent,
  MobileBottomSheetFooter,
} from "@/components/mobile/mobile-bottom-sheet";
import {
  SwipeableTabs,
  type SwipeableTab,
} from "@/components/mobile/swipeable-tabs";
import { DiscardChangesAlert } from "@/components/mobile/discard-changes-alert";
import { SheetHeaderIcon } from "@/components/mobile/sheet-header-icon";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileTypeCombobox } from "@/components/items/file-type-combobox";
import { MediaSearchCombobox } from "@/components/items/media-search-combobox";
import { PosterSelectionStep } from "./wizards/tmdb-wizard/poster-selection-step";
import { HeroSelectionStep } from "./wizards/tmdb-wizard/hero-selection-step";
import { TMDBWizard } from "./wizards/tmdb-wizard";

import { TVPicker } from "./wizards/tv-picker";
import { WizardProgressBar } from "@/components/wizards/wizard-progress-bar";
import { useAddItemForm } from "@/hooks/use-add-item-form";
import { getPosterUrl, getBackdropUrl } from "@/lib/tmdb-client";
import { cn } from "@/lib/utils";
import type {
  QueuedFile,
  TMDBMetadataSelection,
  ArtworkSelectionSource,
} from "@/lib/types";

export interface MobileAddItemSheetProps {
  /** Whether the sheet is open. */
  open: boolean;
  /** Callback when open state changes. */
  onOpenChange: (open: boolean) => void;
  /** Callback to create the item. Returns item ID on success, error on failure. */
  onAdd: (
    name: string,
    description?: string,
    tmdbSelection?: TMDBMetadataSelection
  ) => Promise<{ itemId?: string; error?: string }>;
  /** Callback after item and files are fully created. */
  onComplete?: () => Promise<void>;
  /** Parent item name for context. */
  parentName?: string;
  /** Whether user has Google Drive connected. */
  hasDriveConnection?: boolean;
}

/**
 * Mobile bottom sheet for creating items.
 * Uses SwipeableTabs for Details + Files, with step-based
 * navigation for TV picker, TMDB wizard, summary, and artwork changes.
 */
export function MobileAddItemSheet({
  open,
  onOpenChange,
  onAdd,
  onComplete,
  parentName,
  hasDriveConnection = false,
}: MobileAddItemSheetProps) {
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const form = useAddItemForm(
    onAdd,
    onComplete,
    onOpenChange,
    hasDriveConnection,
    parentName
  );

  // Reset form when sheet opens
  useEffect(() => {
    if (open) {
      form.resetForm();
      setActiveTab("details");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset on open change
  }, [open]);

  /**
   * Handles dismiss — prevents close during loading/upload.
   */
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && (form.isLoading || form.isUploading)) {
        setShowDiscardAlert(true);
        return;
      }
      onOpenChange(newOpen);
    },
    [form.isLoading, form.isUploading, onOpenChange]
  );

  const handleDiscard = useCallback(() => {
    setShowDiscardAlert(false);
    onOpenChange(false);
  }, [onOpenChange]);

  // Details tab content
  const detailsContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="mobile-add-item-name">Item name</Label>
        <div className="relative">
          <MediaSearchCombobox
            id="mobile-add-item-name"
            onSelect={form.handleMediaSelect}
            onChange={form.setName}
            value={form.name}
            placeholder="Search movies & TV shows…"
          />
          {form.isLoadingPreview && (
            <div className="bg-background/80 absolute inset-0 flex items-center justify-center gap-2 rounded-md">
              <FontAwesomeIcon
                icon={faSpinner}
                aria-hidden="true"
                className="text-muted-foreground size-4"
                spin
              />
              <span className="text-muted-foreground text-sm">Loading…</span>
            </div>
          )}
        </div>
        {form.selectedTmdbOptions && (
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <span className="bg-brand/20 text-brand rounded px-1.5 py-0.5 text-xs font-medium">
              TMDB
            </span>
            Metadata will be applied on create
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="mobile-add-item-description">
          Description{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="mobile-add-item-description"
          value={form.description}
          onChange={(e) => form.setDescription(e.target.value)}
          placeholder="Add a short description…"
          disabled={form.isLoading}
          maxLength={1000}
          className="min-h-[80px] resize-none"
        />
        <p className="text-muted-foreground text-xs tabular-nums">
          {form.description.length}/1000 characters
        </p>
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
        uploadOnly
        label="Primary Media"
        description="The file that plays when clicking on this item."
        icon={faFilm}
        fileType="media"
        queuedFiles={form.queuedFiles.media}
        onQueueFilesChange={form.updateCategory("media")}
        disabled={!hasDriveConnection}
      />

      <FileTypeCombobox
        uploadOnly
        label="Primary Artwork"
        description="The image used as the thumbnail."
        icon={faImage}
        fileType="artwork"
        queuedFiles={form.queuedFiles.artwork}
        onQueueFilesChange={form.updateCategory("artwork")}
        disabled={!hasDriveConnection}
      />

      <FileTypeCombobox
        uploadOnly
        label="Hero Image"
        description="The image used as the banner background."
        icon={faWandMagicSparkles}
        fileType="artwork"
        queuedFiles={form.queuedFiles.hero}
        onQueueFilesChange={form.updateCategory("hero")}
        disabled={!hasDriveConnection}
      />

      <FileTypeCombobox
        uploadOnly
        label="Default Subtitle"
        description="The subtitle track that loads by default."
        icon={faFileLines}
        fileType="subtitle"
        queuedFiles={form.queuedFiles.subtitle}
        onQueueFilesChange={form.updateCategory("subtitle")}
        disabled={!hasDriveConnection}
      />
    </div>
  );

  // Summary details content (wizard-summary step)
  const summaryDetailsContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="mobile-summary-item-name">Name</Label>
        <MediaSearchCombobox
          id="mobile-summary-item-name"
          value={form.name}
          onChange={form.setName}
          onSelect={form.handleMediaSelect}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mobile-summary-item-description">
          Description{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="mobile-summary-item-description"
          value={form.description}
          onChange={(e) => form.setDescription(e.target.value.slice(0, 1000))}
          placeholder="Optional description or notes…"
          rows={3}
          disabled={form.isLoading}
          className="resize-none"
        />
        <p className="text-muted-foreground text-xs tabular-nums">
          {form.description.length} / 1000
        </p>
      </div>

      {form.showArtworkSection && (
        <>
          <SummaryArtworkDropzone
            label="Poster"
            icon={faImage}
            value={form.posterValue}
            source={form.posterSource}
            queuedFiles={form.queuedFiles.artwork}
            type="poster"
            onClick={form.handleOpenChangePoster}
            onClear={form.handleClearPoster}
            disabled={form.isLoading}
            helpText="Used as the thumbnail in grid and tree views."
          />
          <SummaryArtworkDropzone
            label="Hero Banner"
            icon={faWandMagicSparkles}
            value={form.backdropValue}
            source={form.backdropSource}
            queuedFiles={form.queuedFiles.hero}
            type="hero"
            onClick={form.handleOpenChangeHero}
            onClear={form.handleClearBackdrop}
            disabled={form.isLoading}
            helpText="Displayed at the top of the item detail page."
          />
        </>
      )}
    </div>
  );

  // Upload progress UI for footer
  const uploadProgressUI = form.uploadState ? (
    <div
      className={cn(
        "mb-3 overflow-hidden rounded-lg border",
        form.hasUploadError
          ? "border-destructive/30 bg-destructive/5"
          : "bg-muted/30"
      )}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          {form.isUploading && form.uploadProgress && (
            <>
              <FontAwesomeIcon
                icon={faSpinner}
                spin
                aria-hidden="true"
                className="text-primary size-4"
              />
              <span className="flex items-center gap-2">
                <span>Uploading…</span>
                <span className="bg-primary/15 text-primary inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-xs font-medium tracking-tight tabular-nums">
                  <span>{form.uploadProgress.overallPercent}%</span>
                  {form.uploadProgress.totalSize > 0 && (
                    <>
                      <span className="text-primary/50">·</span>
                      <span>
                        {form.formatBytes(form.uploadProgress.totalLoaded)}/
                        {form.formatBytes(form.uploadProgress.totalSize)}
                      </span>
                    </>
                  )}
                </span>
                {form.uploadProgress.fileCount > 1 && (
                  <span className="text-muted-foreground text-xs">
                    ({form.uploadProgress.currentFileIndex + 1}/
                    {form.uploadProgress.fileCount})
                  </span>
                )}
              </span>
            </>
          )}

          {form.hasUploadError && (
            <div className="flex items-center gap-2">
              <FontAwesomeIcon
                icon={faCircleExclamation}
                aria-hidden="true"
                className="text-destructive size-4"
              />
              <span>
                {form.uploadState.successCount} uploaded,{" "}
                {form.failedFiles.length} failed
              </span>
            </div>
          )}
        </div>

        {form.hasUploadError && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={form.handleRetryUpload}
              className="h-7 gap-1 px-2 text-xs"
            >
              <FontAwesomeIcon
                icon={faArrowsRotate}
                aria-hidden="true"
                className="size-3"
              />
              Retry
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={form.handleDismissUpload}
              className="text-muted-foreground hover:text-foreground size-7 p-0"
              aria-label="Dismiss upload errors"
            >
              <FontAwesomeIcon
                icon={faXmark}
                aria-hidden="true"
                className="size-4"
              />
            </Button>
          </div>
        )}
      </div>
    </div>
  ) : null;

  // Build tabs for main step
  const mainTabs: SwipeableTab[] = [
    {
      id: "details",
      label: "Details",
      icon: faPlus,
      content: detailsContent,
    },
  ];
  if (hasDriveConnection) {
    mainTabs.push({
      id: "files",
      label: "Files",
      icon: faFilm,
      content: filesContent,
    });
  }

  // Build tabs for wizard-summary step
  const summaryTabs: SwipeableTab[] = [
    {
      id: "details",
      label: "Details",
      icon: faWandMagicSparkles,
      content: summaryDetailsContent,
    },
  ];
  if (hasDriveConnection) {
    summaryTabs.push({
      id: "files",
      label: "Files",
      icon: faFilm,
      content: filesContent,
    });
  }

  const dialogHint = parentName
    ? `Add a child item to "${parentName}"`
    : "Add a new item to your library";

  const discardAlert = (
    <DiscardChangesAlert
      open={showDiscardAlert}
      onOpenChange={setShowDiscardAlert}
      onDiscard={handleDiscard}
      title="Discard item?"
      description="An operation is in progress. Are you sure you want to discard?"
    />
  );

  // --- Step: Episode Picker ---
  if (form.currentStep === "episode-picker" && form.pendingTmdbResult) {
    return (
      <>
        <MobileBottomSheet
          open={open}
          onOpenChange={handleOpenChange}
          snapPoints={[0.85]}
          title="Select Season"
          description={form.displayTitle}
          className={cn(
            "glass-dialog",
            "border-t border-white/[0.08]",
            "text-foreground"
          )}
        >
          <MobileBottomSheetHeader>
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
              <SheetHeaderIcon icon={faTv} />
              <div className="min-w-0 flex-1">
                <MobileBottomSheetTitle>Select Season</MobileBottomSheetTitle>
                <p className="text-muted-foreground truncate text-sm">
                  {form.displayTitle}
                </p>
              </div>
            </div>
          </MobileBottomSheetHeader>
          <MobileBottomSheetContent>
            <TVPicker
              initialData={{ tmdbResult: form.pendingTmdbResult }}
              onComplete={form.handleTVPickerComplete}
              onCancel={form.handleEpisodePickerCancel}
              onLevelChange={form.setTvPickerLevel}
              renderFooter={(props) => {
                form.tvPickerBackRef.current = props.onBack;
                return (
                  <MobileBottomSheetFooter>
                    <Button
                      className="w-full"
                      onClick={props.onUseSelection}
                      disabled={props.isDisabled}
                    >
                      {props.level === "show"
                        ? "Use This Show"
                        : "Use This Season"}
                    </Button>
                  </MobileBottomSheetFooter>
                );
              }}
            />
          </MobileBottomSheetContent>
        </MobileBottomSheet>
        {discardAlert}
      </>
    );
  }

  // --- Step: TMDB Wizard ---
  if (
    form.currentStep === "tmdb-wizard" &&
    form.tmdbPreview &&
    form.pendingTmdbResult
  ) {
    return (
      <>
        <MobileBottomSheet
          open={open}
          onOpenChange={handleOpenChange}
          snapPoints={[0.85]}
          title="Apply Metadata"
          description={form.tmdbPreview.name || "Select metadata to apply"}
          className={cn(
            "glass-dialog",
            "border-t border-white/[0.08]",
            "text-foreground"
          )}
        >
          <MobileBottomSheetHeader>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={form.handleWizardCancel}
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
                <MobileBottomSheetTitle>Apply Metadata</MobileBottomSheetTitle>
                <p className="text-muted-foreground text-sm">
                  {form.tmdbPreview.name || "Select metadata to apply"}
                  {form.wizardHeaderProps &&
                    (() => {
                      const idx = form.wizardHeaderProps.steps.indexOf(
                        form.wizardHeaderProps.currentStep
                      );
                      return (
                        <span className="text-[var(--tertiary-foreground)]">
                          {" "}
                          · Step {idx + 1} of{" "}
                          {form.wizardHeaderProps.steps.length}
                        </span>
                      );
                    })()}
                </p>
              </div>
            </div>
            {form.wizardHeaderProps && (
              <WizardProgressBar
                steps={form.wizardHeaderProps.steps}
                currentStep={form.wizardHeaderProps.currentStep}
                stepLabels={form.wizardHeaderProps.stepLabels}
              />
            )}
          </MobileBottomSheetHeader>
          <MobileBottomSheetContent>
            <TMDBWizard
              initialData={{
                tmdbResult: form.pendingTmdbResult,
                preview: form.tmdbPreview,
                contentType: form.contentType,
                ...(form.selectedSeasonNumber !== null && {
                  seasonNumber: form.selectedSeasonNumber,
                }),
              }}
              currentValues={form.currentValues}
              uploadMode={true}
              hasDriveConnection={hasDriveConnection}
              queuedArtwork={form.queuedFiles.artwork}
              queuedHero={form.queuedFiles.hero}
              onArtworkQueue={form.updateCategory("artwork")}
              onHeroQueue={form.updateCategory("hero")}
              onComplete={form.handleTMDBWizardComplete}
              onCancel={form.handleWizardCancel}
              onHeaderChange={form.setWizardHeaderProps}
              onFooterChange={form.setWizardFooterProps}
            />
          </MobileBottomSheetContent>
          {form.wizardFooterProps && (
            <MobileBottomSheetFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
                  {form.wizardFooterProps.onSkipCurrent && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={form.wizardFooterProps.onSkipCurrent}
                      disabled={form.wizardFooterProps.isDisabled}
                      data-testid="tmdb-wizard-skip"
                    >
                      Skip
                    </Button>
                  )}
                  {form.wizardFooterProps.onSkipAll && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={form.wizardFooterProps.onSkipAll}
                      disabled={form.wizardFooterProps.isDisabled}
                      data-testid="tmdb-wizard-skip-all"
                    >
                      Skip All
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={form.wizardFooterProps.onNext}
                    disabled={form.wizardFooterProps.isDisabled}
                    data-testid="tmdb-wizard-next"
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
            </MobileBottomSheetFooter>
          )}
        </MobileBottomSheet>
        {discardAlert}
      </>
    );
  }

  // --- Step: Wizard Summary ---
  if (form.currentStep === "wizard-summary") {
    return (
      <>
        <MobileBottomSheet
          open={open}
          onOpenChange={handleOpenChange}
          snapPoints={[0.85]}
          repositionInputs
          swipeable
          title="Review & Create"
          description={form.displayTitle}
          className={cn(
            "glass-dialog",
            "border-t border-white/[0.08]",
            "text-foreground"
          )}
        >
          <MobileBottomSheetHeader>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => form.setCurrentStep("tmdb-wizard")}
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
                <MobileBottomSheetTitle>Review & Create</MobileBottomSheetTitle>
                <p className="text-muted-foreground truncate text-sm">
                  {form.displayTitle}
                </p>
              </div>
            </div>
          </MobileBottomSheetHeader>

          <MobileBottomSheetContent className="flex flex-col overflow-hidden pb-0">
            {hasDriveConnection ? (
              <SwipeableTabs
                tabs={summaryTabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                ariaLabel="Review tabs"
              />
            ) : (
              summaryDetailsContent
            )}
          </MobileBottomSheetContent>

          <MobileBottomSheetFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {uploadProgressUI}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={form.handleWizardCancel}
                disabled={form.isLoading || form.isUploading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={form.handleSubmit}
                disabled={
                  !form.name.trim() || form.isLoading || form.isUploading
                }
                className="flex-1"
                data-testid="wizard-summary-create"
              >
                {form.isLoading ? (
                  <>
                    <FontAwesomeIcon
                      icon={faSpinner}
                      aria-hidden="true"
                      className="size-4"
                      spin
                    />
                    Creating…
                  </>
                ) : form.isUploading ? (
                  <>
                    <FontAwesomeIcon
                      icon={faSpinner}
                      aria-hidden="true"
                      className="size-4"
                      spin
                    />
                    Uploading…
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </MobileBottomSheetFooter>
        </MobileBottomSheet>
        {discardAlert}
      </>
    );
  }

  // --- Step: Change Poster ---
  if (form.currentStep === "change-poster") {
    return (
      <>
        <MobileBottomSheet
          open={open}
          onOpenChange={handleOpenChange}
          snapPoints={[0.85]}
          title="Change Poster"
          description="Select a different poster image"
          className={cn(
            "glass-dialog",
            "border-t border-white/[0.08]",
            "text-foreground"
          )}
        >
          <MobileBottomSheetHeader>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={form.handleCancelArtworkChange}
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
                  "bg-violet-500/10 ring-1 ring-violet-500/20"
                )}
              >
                <FontAwesomeIcon
                  icon={faImage}
                  aria-hidden="true"
                  className="size-5 text-violet-500"
                />
              </div>
              <div className="min-w-0 flex-1">
                <MobileBottomSheetTitle>Change Poster</MobileBottomSheetTitle>
                <p className="text-muted-foreground text-sm">
                  Select a different poster image
                </p>
              </div>
            </div>
          </MobileBottomSheetHeader>
          <MobileBottomSheetContent>
            <PosterSelectionStep
              posters={form.tmdbImages?.posters || []}
              uploadMode={true}
              queuedArtwork={form.queuedFiles.artwork}
              onQueueArtworkChange={form.updateCategory("artwork")}
              hasDriveConnection={hasDriveConnection}
              selectedValue={form.tempPosterValue}
              selectedSource={form.tempPosterSource}
              onSelect={form.handleTempPosterSelect}
              isSkipped={form.tempPosterSkipped}
              onSkipChange={form.setTempPosterSkipped}
              disabled={false}
            />
          </MobileBottomSheetContent>
          <MobileBottomSheetFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={form.handleCancelArtworkChange}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={form.handleSavePosterChange} className="flex-1">
                Save
              </Button>
            </div>
          </MobileBottomSheetFooter>
        </MobileBottomSheet>
        {discardAlert}
      </>
    );
  }

  // --- Step: Change Hero ---
  if (form.currentStep === "change-hero") {
    return (
      <>
        <MobileBottomSheet
          open={open}
          onOpenChange={handleOpenChange}
          snapPoints={[0.85]}
          title="Change Hero"
          description="Select a different hero/backdrop image"
          className={cn(
            "glass-dialog",
            "border-t border-white/[0.08]",
            "text-foreground"
          )}
        >
          <MobileBottomSheetHeader>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={form.handleCancelArtworkChange}
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
                  "bg-violet-500/10 ring-1 ring-violet-500/20"
                )}
              >
                <FontAwesomeIcon
                  icon={faImage}
                  aria-hidden="true"
                  className="size-5 text-violet-500"
                />
              </div>
              <div className="min-w-0 flex-1">
                <MobileBottomSheetTitle>Change Hero</MobileBottomSheetTitle>
                <p className="text-muted-foreground text-sm">
                  Select a different hero/backdrop image
                </p>
              </div>
            </div>
          </MobileBottomSheetHeader>
          <MobileBottomSheetContent>
            <HeroSelectionStep
              backdrops={form.tmdbImages?.backdrops || []}
              uploadMode={true}
              queuedHero={form.queuedFiles.hero}
              onQueueHeroChange={form.updateCategory("hero")}
              hasDriveConnection={hasDriveConnection}
              selectedValue={form.tempBackdropValue}
              selectedSource={form.tempBackdropSource}
              onSelect={form.handleTempBackdropSelect}
              isSkipped={form.tempBackdropSkipped}
              onSkipChange={form.setTempBackdropSkipped}
              disabled={false}
            />
          </MobileBottomSheetContent>
          <MobileBottomSheetFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={form.handleCancelArtworkChange}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={form.handleSaveHeroChange} className="flex-1">
                Save
              </Button>
            </div>
          </MobileBottomSheetFooter>
        </MobileBottomSheet>
        {discardAlert}
      </>
    );
  }

  // --- Main Step ---
  return (
    <>
      <MobileBottomSheet
        open={open}
        onOpenChange={handleOpenChange}
        snapPoints={[0.85]}
        repositionInputs
        swipeable
        title="Create Item"
        description={dialogHint}
        className={cn(
          "glass-dialog",
          "border-t border-white/[0.08]",
          "text-foreground"
        )}
      >
        <MobileBottomSheetHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                "bg-primary/10 ring-primary/20 ring-1"
              )}
            >
              <FontAwesomeIcon
                icon={faPlus}
                aria-hidden="true"
                className="text-primary size-5"
              />
            </div>
            <div className="min-w-0">
              <MobileBottomSheetTitle>Create Item</MobileBottomSheetTitle>
              <p className="text-muted-foreground truncate text-sm">
                {dialogHint}
              </p>
            </div>
          </div>
        </MobileBottomSheetHeader>

        <MobileBottomSheetContent className="flex flex-col overflow-hidden pb-0">
          {hasDriveConnection ? (
            <SwipeableTabs
              tabs={mainTabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              ariaLabel="Create item tabs"
            />
          ) : (
            detailsContent
          )}
        </MobileBottomSheetContent>

        <MobileBottomSheetFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {uploadProgressUI}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={form.isLoading || form.isUploading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={form.handleSubmit}
              disabled={!form.name.trim() || form.isLoading || form.isUploading}
              className="flex-1"
            >
              {form.isLoading ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    aria-hidden="true"
                    className="size-4"
                    spin
                  />
                  Creating…
                </>
              ) : form.isUploading ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    aria-hidden="true"
                    className="size-4"
                    spin
                  />
                  Uploading…
                </>
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </MobileBottomSheetFooter>
      </MobileBottomSheet>

      {discardAlert}
    </>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Summary artwork dropzone for selecting poster or hero images.
 * Click navigates to the selection wizard step.
 */
function SummaryArtworkDropzone({
  label,
  icon,
  value,
  source,
  queuedFiles,
  type,
  onClick,
  onClear,
  disabled,
  helpText,
}: {
  label: string;
  icon: IconDefinition;
  value: string | null;
  source: ArtworkSelectionSource | null;
  queuedFiles: QueuedFile[];
  type: "poster" | "hero";
  onClick: () => void;
  onClear: () => void;
  disabled: boolean;
  helpText: string;
}) {
  const [hasError, setHasError] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const queuedFile = useMemo(() => {
    if (source !== "queued" || !value) return null;
    return queuedFiles.find((f) => f.id === value) ?? null;
  }, [source, value, queuedFiles]);

  // Create object URL for queued file preview.
  useEffect(() => {
    if (queuedFile) {
      const url = URL.createObjectURL(queuedFile.file);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URL cleanup requires effect
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setObjectUrl(null);
  }, [queuedFile]);

  // Reset error state when selection changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived state reset
    setHasError(false);
  }, [value, source]);

  const imageUrl = useMemo(() => {
    if (!value || hasError) return null;
    if (source === "tmdb") {
      return type === "poster"
        ? getPosterUrl(value, "w342")
        : getBackdropUrl(value, "w780");
    }
    if (source === "queued" && objectUrl) {
      return objectUrl;
    }
    return null;
  }, [value, source, type, objectUrl, hasError]);

  const hasSelection = value !== null && source !== null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-lg",
            "bg-primary/10"
          )}
        >
          <FontAwesomeIcon
            icon={icon}
            aria-hidden="true"
            className="text-primary size-3.5"
          />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "relative h-24 w-full overflow-hidden p-0",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external TMDB URLs not in next.config
          <img
            src={imageUrl}
            alt={`${label} preview`}
            width={type === "poster" ? 342 : 780}
            height={type === "poster" ? 513 : 439}
            loading="lazy"
            className="size-full object-cover"
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1">
            <FontAwesomeIcon
              icon={icon}
              aria-hidden="true"
              className="text-muted-foreground/50 size-6"
            />
            <p className="text-muted-foreground text-xs">
              Click to choose {label.toLowerCase()}
            </p>
          </div>
        )}
      </Button>

      {hasSelection && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClear}
          disabled={disabled}
        >
          <FontAwesomeIcon
            icon={faTrashCan}
            aria-hidden="true"
            className="mr-1.5 size-3.5"
          />
          Clear
        </Button>
      )}

      <p className="text-muted-foreground text-xs">{helpText}</p>
    </div>
  );
}

export default MobileAddItemSheet;
