/**
 * Combined mobile bottom sheet for sort/filter and item settings.
 * Merges MobileOptionsSheet functionality with ItemSettingsDialog form
 * into a single entry point on mobile. Uses SwipeableTabs for tabbed
 * settings and useItemSettingsForm for shared state management.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSliders,
  faArrowsUpDown,
  faFilter,
  faCheck,
  faXmark,
  faSpinner,
  faImage,
  faFileLines,
  faFilm,
  faSignature,
  faWandMagicSparkles,
  faChevronLeft,
  faChevronRight,
  faTv,
  faTableCells,
  faList,
  faGears,
} from "@fortawesome/free-solid-svg-icons";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileTypeCombobox } from "@/components/items/file-type-combobox";
import { MediaSearchCombobox } from "@/components/items/media-search-combobox";
import { TmdbMetadataSection } from "@/components/items/tmdb-metadata-section";
import { TmdbSourceField } from "@/components/items/tmdb-source-field";
import { VisibilityToggle } from "@/components/items/visibility-toggle";
import { TMDBWizard } from "./wizards/tmdb-wizard";

import { TVPicker } from "./wizards/tv-picker";
import { WizardProgressBar } from "@/components/wizards/wizard-progress-bar";
import {
  useItemSettingsForm,
  type ItemSettingsFormItem,
  type ItemSettingsFormFiles,
} from "@/hooks/use-item-settings-form";
import { cn } from "@/lib/utils";
import type { SortOption, ContentFilter, ViewMode } from "@/lib/types";
import {
  CONTENT_FILTER_OPTIONS,
  type SortOptionConfig,
} from "@/lib/item-utils";

/** File status filter options. */
const FILE_OPTIONS = CONTENT_FILTER_OPTIONS.filter((o) => o.group === "file");

/** Sync status filter options. */
const SYNC_OPTIONS = CONTENT_FILTER_OPTIONS.filter((o) => o.group === "sync");

export interface MobileItemSheetProps {
  // --- Sort/filter (from MobileOptionsSheet) ---
  /** Current sort option. Omit to hide sort section. */
  sortBy?: SortOption;
  /** Callback when sort option changes. */
  onSortChange?: (value: SortOption) => void;
  /** Active content filters. */
  filters?: ContentFilter[];
  /** Toggle a single filter on/off. */
  toggleFilter?: (filter: ContentFilter) => void;
  /** Clear all active filters. */
  clearFilters?: () => void;
  /** Custom sort options. */
  sortOptions?: SortOptionConfig[];
  /** Default sort for active indicator. */
  defaultSort?: SortOption;

  // --- View mode (optional) ---
  /** Current view mode. Omit to hide view section. */
  viewMode?: ViewMode;
  /** Callback when view mode changes. */
  onViewChange?: (value: ViewMode) => void;

  // --- Settings ---
  /** The item being configured. */
  item: ItemSettingsFormItem;
  /** Files attached to this item. */
  files: ItemSettingsFormFiles;
  /** Whether user has Google Drive connected. */
  hasDriveConnection?: boolean;
  /** Callback when settings change. */
  onSettingsChange?: () => Promise<void>;

  // --- General ---
  /** Whether the sheet is open. */
  open: boolean;
  /** Callback when open state changes. */
  onOpenChange: (open: boolean) => void;
  /** Whether controls are disabled. */
  disabled?: boolean;
}

/**
 * Combined bottom sheet for mobile item management.
 * Provides sort/filter options (immediate apply) and settings tabs
 * (Details/Files/TMDB) with atomic save. Supports wizard flows for
 * TMDB metadata and TV episode picking.
 *
 * @param sortBy - Current sort option (omit to hide sort)
 * @param filterBy - Current filter value
 * @param item - Item being configured
 * @param files - Files grouped by type
 * @param open - Whether sheet is visible
 * @param onOpenChange - Callback for visibility changes
 */
export function MobileItemSheet({
  sortBy,
  onSortChange,
  filters,
  toggleFilter,
  clearFilters,
  sortOptions,
  defaultSort: _defaultSort = "custom",
  viewMode,
  onViewChange,
  item,
  files,
  hasDriveConnection = false,
  onSettingsChange,
  open,
  onOpenChange,
  disabled: _disabled,
}: MobileItemSheetProps) {
  const [activeSettingsTab, setActiveSettingsTab] = useState("details");
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);
  const sortRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const form = useItemSettingsForm(item, files, onSettingsChange, () =>
    onOpenChange(false)
  );

  const {
    resetForm,
    isDirty,
    cancel,
    isSaving,
    name,
    setName,
    description,
    setDescription,
    isPublic,
    setIsPublic,
    inheritVisibility,
    setInheritVisibility,
    primaryMediaId,
    setPrimaryMediaId,
    primaryArtworkId,
    setPrimaryArtworkId,
    heroArtworkId,
    setHeroArtworkId,
    logoArtworkId,
    setLogoArtworkId,
    primarySubtitleId,
    setPrimarySubtitleId,
    isLoadingPreview: _isLoadingPreview,
    isApplyingMetadata,
    handleMediaSelect,
    displayOptions,
    handleDisplayOptionsChange,
    save,
    handleUploadComplete,
    handleFileDeleted,
    currentStep,
    pendingTmdbResult,
    handleEpisodePickerBack,
    handleEpisodePickerCancel,
    setTvPickerLevel,
    tvPickerBackRef,
    displayTitle,
    tmdbPreview,
    wizardHeaderProps,
    setWizardHeaderProps,
    wizardFooterProps,
    setWizardFooterProps,
    handleWizardCancel,
    contentType,
    currentValues,
    handleTVPickerComplete,
    handleTMDBWizardComplete,
    handleOpenTmdbSearch,
    handleTmdbSearchBack,
  } = form;

  // Reset form when sheet opens
  useEffect(() => {
    if (open) {
      resetForm();
      setActiveSettingsTab("details");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset on open change
  }, [open]);

  const showView = viewMode !== undefined && onViewChange !== undefined;
  const showSort = sortBy !== undefined && onSortChange !== undefined;
  const showFilter = filters !== undefined && toggleFilter !== undefined;
  const hasActiveFilter = filters !== undefined && filters.length > 0;

  /**
   * Handles dismiss with dirty state check.
   */
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && isDirty) {
        setShowDiscardAlert(true);
        return;
      }
      onOpenChange(newOpen);
    },
    [isDirty, onOpenChange]
  );

  /**
   * Handles discard confirmation.
   */
  const handleDiscard = useCallback(() => {
    setShowDiscardAlert(false);
    cancel();
  }, [cancel]);

  /**
   * Handles keyboard navigation within option lists.
   */
  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLButtonElement>,
      refs: React.RefObject<(HTMLButtonElement | null)[]>,
      currentIndex: number
    ) => {
      const items = refs.current?.filter(Boolean) as HTMLButtonElement[];
      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          break;
        case "ArrowUp":
          e.preventDefault();
          nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          break;
      }

      if (nextIndex !== null) {
        items[nextIndex]?.focus();
      }
    },
    []
  );

  // Settings tab content - Details
  const detailsContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="mobile-item-name">Item name</Label>
          {item.tmdbId !== null && (
            <Badge variant="destructive">Managed by TMDB</Badge>
          )}
        </div>
        <div className="relative">
          <Input
            id="mobile-item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={item.tmdbId !== null}
            placeholder="Enter item name\u2026"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mobile-item-description">
          Description{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="mobile-item-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a short description\u2026"
          maxLength={1000}
          className="min-h-[80px] resize-none"
        />
        <p className="text-muted-foreground text-xs tabular-nums">
          {description.length}/1000 characters
        </p>
      </div>

      <div className="space-y-2 pt-2">
        <Label>Visibility</Label>
        <VisibilityToggle
          itemId={item.id}
          itemName={name}
          isPublic={isPublic}
          inheritVisibility={inheritVisibility}
          hasParent={item.hasParent}
          hasChildren={item.hasChildren}
          onVisibilityChange={(newIsPublic) => {
            setIsPublic(newIsPublic);
            onSettingsChange?.().catch((err) => {
              console.warn(
                "[MobileItemSheet] Refetch failed after visibility change:",
                err
              );
            });
          }}
          onInheritChange={(newInherit) => {
            setInheritVisibility(newInherit);
            onSettingsChange?.().catch((err) => {
              console.warn(
                "[MobileItemSheet] Refetch failed after inherit change:",
                err
              );
            });
          }}
        />
      </div>

      {/* TMDB Source field */}
      <TmdbSourceField
        item={item}
        onChange={handleOpenTmdbSearch}
        onSettingsChange={onSettingsChange ?? (async () => {})}
      />
    </div>
  );

  // Settings tab content - Files
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
        selectedId={primaryMediaId}
        onSelect={setPrimaryMediaId}
        onUploadComplete={handleUploadComplete}
        onFileDeleted={handleFileDeleted}
        itemId={item.id}
        fileType="media"
        disabled={!hasDriveConnection}
      />

      <FileTypeCombobox
        label="Primary Artwork"
        description="The image used as the thumbnail."
        icon={faImage}
        files={files.artwork}
        selectedId={primaryArtworkId}
        onSelect={setPrimaryArtworkId}
        onUploadComplete={handleUploadComplete}
        onFileDeleted={handleFileDeleted}
        itemId={item.id}
        fileType="artwork"
        disabled={!hasDriveConnection}
        note={
          item.tmdbPosterPath ? (
            <Badge variant="destructive">
              Currently using TMDB poster. Upload to override.
            </Badge>
          ) : undefined
        }
      />

      <FileTypeCombobox
        label="Hero Image"
        description="The image used as the banner background."
        icon={faWandMagicSparkles}
        files={files.artwork}
        selectedId={heroArtworkId}
        onSelect={setHeroArtworkId}
        onUploadComplete={handleUploadComplete}
        onFileDeleted={handleFileDeleted}
        itemId={item.id}
        fileType="artwork"
        disabled={!hasDriveConnection}
        note={
          item.tmdbBackdropPath ? (
            <Badge variant="destructive">
              Currently using TMDB backdrop. Upload to override.
            </Badge>
          ) : undefined
        }
      />

      <FileTypeCombobox
        label="Logo"
        description="Transparent logo image displayed over the hero."
        icon={faSignature}
        files={files.artwork}
        selectedId={logoArtworkId}
        onSelect={setLogoArtworkId}
        onUploadComplete={handleUploadComplete}
        onFileDeleted={handleFileDeleted}
        itemId={item.id}
        fileType="artwork"
        disabled={!hasDriveConnection}
        note={
          item.tmdbLogoPath ? (
            <Badge variant="destructive">
              Currently using TMDB logo. Upload to override.
            </Badge>
          ) : undefined
        }
      />

      <FileTypeCombobox
        label="Default Subtitle"
        description="The subtitle track that loads by default."
        icon={faFileLines}
        files={files.subtitles}
        selectedId={primarySubtitleId}
        onSelect={setPrimarySubtitleId}
        onUploadComplete={handleUploadComplete}
        onFileDeleted={handleFileDeleted}
        itemId={item.id}
        fileType="subtitle"
        disabled={!hasDriveConnection}
      />
    </div>
  );

  // Settings tab content - TMDB
  const tmdbContent = item.tmdbId ? (
    <TmdbMetadataSection
      item={item}
      displayOptions={displayOptions}
      onDisplayOptionsChange={handleDisplayOptionsChange}
      onSettingsChange={onSettingsChange ?? (async () => {})}
      hasUploadedPoster={!!primaryArtworkId}
      hasUploadedHero={!!heroArtworkId}
      hasUploadedLogo={!!logoArtworkId}
    />
  ) : null;

  // Build tabs array
  const settingsTabs: SwipeableTab[] = [
    {
      id: "details",
      label: "Details",
      icon: faGears,
      content: detailsContent,
    },
  ];
  if (hasDriveConnection) {
    settingsTabs.push({
      id: "files",
      label: "Files",
      icon: faFilm,
      content: filesContent,
    });
  }
  if (tmdbContent) {
    settingsTabs.push({
      id: "tmdb",
      label: "TMDB",
      icon: faFilm,
      content: tmdbContent,
    });
  }

  // TMDB search step
  if (currentStep === "tmdb-search") {
    return (
      <>
        <MobileBottomSheet
          open={open}
          onOpenChange={handleOpenChange}
          snapPoints={[0.85]}
          title="Search TMDB"
          description="Find a movie or TV show to link"
          className={cn(
            "bg-[#1a1a1a]/95 backdrop-blur-xl",
            "border-t border-white/[0.08]",
            "text-foreground"
          )}
        >
          <MobileBottomSheetHeader className="border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleTmdbSearchBack}
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
                  icon={faFilm}
                  aria-hidden="true"
                  className="text-brand size-5"
                />
              </div>
              <div className="min-w-0 flex-1">
                <MobileBottomSheetTitle>Search TMDB</MobileBottomSheetTitle>
                <p className="text-muted-foreground text-sm">
                  Find a movie or TV show to link
                </p>
              </div>
            </div>
          </MobileBottomSheetHeader>
          <MobileBottomSheetContent>
            <div className="py-4">
              <MediaSearchCombobox
                id="mobile-tmdb-search-input"
                onSelect={handleMediaSelect}
                placeholder="Search movies & TV shows\u2026"
              />
            </div>
          </MobileBottomSheetContent>
        </MobileBottomSheet>
        <DiscardChangesAlert
          open={showDiscardAlert}
          onOpenChange={setShowDiscardAlert}
          onDiscard={handleDiscard}
        />
      </>
    );
  }

  // Wizard step rendering
  if (currentStep === "episode-picker" && pendingTmdbResult) {
    return (
      <>
        <MobileBottomSheet
          open={open}
          onOpenChange={handleOpenChange}
          snapPoints={[0.85]}
          title="Select Season"
          description={displayTitle}
          className={cn(
            "bg-[#1a1a1a]/95 backdrop-blur-xl",
            "border-t border-white/[0.08]",
            "text-foreground"
          )}
        >
          <MobileBottomSheetHeader className="border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEpisodePickerBack}
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
                <MobileBottomSheetTitle>Select Season</MobileBottomSheetTitle>
                <p className="text-muted-foreground truncate text-sm">
                  {displayTitle}
                </p>
              </div>
            </div>
          </MobileBottomSheetHeader>
          <MobileBottomSheetContent>
            <TVPicker
              initialData={{ tmdbResult: pendingTmdbResult }}
              onComplete={handleTVPickerComplete}
              onCancel={handleEpisodePickerCancel}
              onLevelChange={setTvPickerLevel}
              renderFooter={(props) => {
                tvPickerBackRef.current = props.onBack;
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
        <DiscardChangesAlert
          open={showDiscardAlert}
          onOpenChange={setShowDiscardAlert}
          onDiscard={handleDiscard}
        />
      </>
    );
  }

  if (currentStep === "tmdb-wizard" && tmdbPreview && pendingTmdbResult) {
    return (
      <>
        <MobileBottomSheet
          open={open}
          onOpenChange={handleOpenChange}
          snapPoints={[0.85]}
          title="Apply Metadata"
          description={tmdbPreview.name || "Select metadata to apply"}
          className={cn(
            "bg-[#1a1a1a]/95 backdrop-blur-xl",
            "border-t border-white/[0.08]",
            "text-foreground"
          )}
        >
          <MobileBottomSheetHeader className="border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleWizardCancel}
                disabled={isApplyingMetadata}
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
                  {tmdbPreview.name || "Select metadata to apply"}
                  {wizardHeaderProps &&
                    (() => {
                      const idx = wizardHeaderProps.steps.indexOf(
                        wizardHeaderProps.currentStep
                      );
                      return (
                        <span className="text-[var(--tertiary-foreground)]">
                          {" "}
                          · Step {idx + 1} of {wizardHeaderProps.steps.length}
                        </span>
                      );
                    })()}
                </p>
              </div>
            </div>
            {wizardHeaderProps && (
              <WizardProgressBar
                steps={wizardHeaderProps.steps}
                currentStep={wizardHeaderProps.currentStep}
                stepLabels={wizardHeaderProps.stepLabels}
              />
            )}
          </MobileBottomSheetHeader>
          <MobileBottomSheetContent>
            <TMDBWizard
              initialData={{
                tmdbResult: pendingTmdbResult,
                preview: tmdbPreview,
                contentType,
              }}
              currentValues={currentValues}
              uploadMode={false}
              hasDriveConnection={hasDriveConnection}
              existingArtwork={files.artwork}
              existingHero={files.artwork}
              onComplete={handleTMDBWizardComplete}
              onHeaderChange={setWizardHeaderProps}
              onFooterChange={setWizardFooterProps}
            />
          </MobileBottomSheetContent>
          {wizardFooterProps && (
            <MobileBottomSheetFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="flex w-full justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={wizardFooterProps.onBack}
                  disabled={wizardFooterProps.isDisabled}
                >
                  <FontAwesomeIcon
                    icon={faChevronLeft}
                    className="mr-2 h-4 w-4"
                    aria-hidden="true"
                  />
                  Back
                </Button>
                <div className="flex gap-2">
                  {wizardFooterProps.onSkipAll && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={wizardFooterProps.onSkipAll}
                      disabled={wizardFooterProps.isDisabled}
                    >
                      Skip All
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={wizardFooterProps.onNext}
                    disabled={wizardFooterProps.isDisabled}
                  >
                    {wizardFooterProps.isLastStep ? "Apply" : "Next"}
                    {!wizardFooterProps.isLastStep && (
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
        <DiscardChangesAlert
          open={showDiscardAlert}
          onOpenChange={setShowDiscardAlert}
          onDiscard={handleDiscard}
        />
      </>
    );
  }

  // Main view (sort/filter + settings tabs)
  return (
    <>
      <MobileBottomSheet
        open={open}
        onOpenChange={handleOpenChange}
        snapPoints={[0.85]}
        repositionInputs
        swipeable
        title="Item Options"
        description="Sort, filter, and configure your item"
        data-testid="sheet-item-options"
        className={cn(
          "bg-[#1a1a1a]/95 backdrop-blur-xl",
          "border-t border-white/[0.08]",
          "text-foreground"
        )}
      >
        <MobileBottomSheetHeader className="border-b border-white/[0.08] pb-4">
          <MobileBottomSheetTitle className="text-foreground">
            Item Options
          </MobileBottomSheetTitle>
        </MobileBottomSheetHeader>

        <MobileBottomSheetContent className="flex flex-col gap-6 overflow-hidden pb-0">
          {/* View Mode Section */}
          {showView && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-[var(--tertiary-foreground)] uppercase">
                <FontAwesomeIcon
                  icon={faTableCells}
                  aria-hidden="true"
                  className="size-4"
                />
                <span>View</span>
              </div>
              <div
                className="-mx-2 space-y-1"
                role="listbox"
                aria-label="View mode"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={viewMode === "grid"}
                  onClick={() => onViewChange!("grid")}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-4 py-3",
                    "text-sm font-medium",
                    "transition-colors duration-150",
                    "min-h-[44px]",
                    viewMode === "grid"
                      ? "text-foreground bg-white/20"
                      : "text-muted-foreground hover:bg-white/10",
                    "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <FontAwesomeIcon
                      icon={faTableCells}
                      aria-hidden="true"
                      className="size-4"
                    />
                    Grid
                  </span>
                  {viewMode === "grid" && (
                    <FontAwesomeIcon
                      icon={faCheck}
                      aria-hidden="true"
                      className="size-4"
                    />
                  )}
                </button>
                <button
                  type="button"
                  role="option"
                  aria-selected={viewMode === "tree"}
                  onClick={() => onViewChange!("tree")}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-4 py-3",
                    "text-sm font-medium",
                    "transition-colors duration-150",
                    "min-h-[44px]",
                    viewMode === "tree"
                      ? "text-foreground bg-white/20"
                      : "text-muted-foreground hover:bg-white/10",
                    "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <FontAwesomeIcon
                      icon={faList}
                      aria-hidden="true"
                      className="size-4"
                    />
                    Tree
                  </span>
                  {viewMode === "tree" && (
                    <FontAwesomeIcon
                      icon={faCheck}
                      aria-hidden="true"
                      className="size-4"
                    />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Sort Section */}
          {showSort && sortOptions && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-[var(--tertiary-foreground)] uppercase">
                <FontAwesomeIcon
                  icon={faArrowsUpDown}
                  aria-hidden="true"
                  className="size-4"
                />
                <span>Sort By</span>
              </div>
              <div
                className="-mx-2 space-y-1"
                role="radiogroup"
                aria-label="Sort options"
              >
                {sortOptions.map((option, index) => (
                  <button
                    key={option.value}
                    ref={(el) => {
                      sortRefs.current[index] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={sortBy === option.value}
                    onClick={() => onSortChange?.(option.value)}
                    onKeyDown={(e) => handleKeyDown(e, sortRefs, index)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-4 py-3",
                      "text-sm font-medium",
                      "transition-colors duration-150",
                      "min-h-[44px]",
                      sortBy === option.value
                        ? "text-foreground bg-white/20"
                        : "text-muted-foreground hover:bg-white/10",
                      "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                    )}
                  >
                    <span>{option.label}</span>
                    {sortBy === option.value && (
                      <FontAwesomeIcon
                        icon={faCheck}
                        aria-hidden="true"
                        className="size-4"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filter Section - multi-select checkboxes grouped by type */}
          {showFilter && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-[var(--tertiary-foreground)] uppercase">
                  <FontAwesomeIcon
                    icon={faFilter}
                    aria-hidden="true"
                    className="size-4"
                  />
                  <span>
                    Filter{hasActiveFilter ? ` (${filters!.length})` : ""}
                  </span>
                </div>
                {hasActiveFilter && clearFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    aria-label="Clear all filters"
                    className={cn(
                      "flex items-center gap-1 text-xs",
                      "text-muted-foreground hover:text-foreground",
                      "transition-colors"
                    )}
                  >
                    <FontAwesomeIcon
                      icon={faXmark}
                      aria-hidden="true"
                      className="size-3"
                    />
                    Clear all
                  </button>
                )}
              </div>

              {/* File Status Group */}
              <div
                className="-mx-2 space-y-1"
                role="group"
                aria-label="File status filters"
              >
                <span className="text-muted-foreground px-4 text-[11px] font-medium tracking-wider uppercase">
                  File Status
                </span>
                {FILE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="checkbox"
                    aria-checked={filters!.includes(option.value)}
                    onClick={() => toggleFilter!(option.value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-4 py-3",
                      "text-sm font-medium",
                      "transition-colors duration-150",
                      "min-h-[44px]",
                      filters!.includes(option.value)
                        ? "text-foreground bg-white/20"
                        : "text-muted-foreground hover:bg-white/10",
                      "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                    )}
                  >
                    <span>{option.label}</span>
                    {filters!.includes(option.value) && (
                      <FontAwesomeIcon
                        icon={faCheck}
                        aria-hidden="true"
                        className="size-4"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Sync Status Group */}
              <div
                className="-mx-2 space-y-1 pt-1"
                role="group"
                aria-label="Sync status filters"
              >
                <span className="text-muted-foreground px-4 text-[11px] font-medium tracking-wider uppercase">
                  Sync Status
                </span>
                {SYNC_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="checkbox"
                    aria-checked={filters!.includes(option.value)}
                    onClick={() => toggleFilter!(option.value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-4 py-3",
                      "text-sm font-medium",
                      "transition-colors duration-150",
                      "min-h-[44px]",
                      filters!.includes(option.value)
                        ? "text-foreground bg-white/20"
                        : "text-muted-foreground hover:bg-white/10",
                      "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                    )}
                  >
                    <span>{option.label}</span>
                    {filters!.includes(option.value) && (
                      <FontAwesomeIcon
                        icon={faCheck}
                        aria-hidden="true"
                        className="size-4"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Settings Section */}
          <SwipeableTabs
            tabs={settingsTabs}
            activeTab={activeSettingsTab}
            onTabChange={setActiveSettingsTab}
            ariaLabel="Item settings tabs"
          />
        </MobileBottomSheetContent>

        {/* Footer - always visible, save disabled when not dirty */}
        <MobileBottomSheetFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={cancel}
              disabled={isSaving}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={!isDirty || isSaving}
              className="flex-1"
              aria-busy={isSaving}
            >
              {isSaving ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    aria-hidden="true"
                    className="size-4"
                    spin
                  />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </MobileBottomSheetFooter>
      </MobileBottomSheet>

      <DiscardChangesAlert
        open={showDiscardAlert}
        onOpenChange={setShowDiscardAlert}
        onDiscard={handleDiscard}
      />
    </>
  );
}

/** Trigger button for the MobileItemSheet. */
export function MobileItemSheetTrigger({
  onClick,
  disabled,
  hasActiveOptions,
}: {
  onClick: () => void;
  disabled?: boolean;
  hasActiveOptions?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-2 rounded-md px-3 py-1.5",
        "min-h-[44px]",
        "text-sm",
        "text-muted-foreground",
        "hover:bg-white/5",
        "transition-colors",
        "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      <FontAwesomeIcon icon={faSliders} aria-hidden="true" className="size-4" />
      <span>Options</span>
      {hasActiveOptions && (
        <span className="bg-primary absolute -top-1 -right-1 size-2 rounded-full">
          <span className="sr-only">(active filters)</span>
        </span>
      )}
    </button>
  );
}

export default MobileItemSheet;
