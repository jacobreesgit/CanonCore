/**
 * User thumbnail component for search results and public profiles.
 * Shows profile picture, initials derived from name, or icon fallback.
 * Memoized to prevent unnecessary re-renders during search filtering.
 */

"use client";

import { memo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

interface UserThumbnailProps {
  /** User ID for avatar loading */
  userId: string;
  /** User's display name for initials generation */
  name: string | null;
  /** Size variant: sm (24px), md (32px), lg (40px). Defaults to md. */
  size?: "sm" | "md" | "lg";
  /** Whether to load the profile picture from API. Defaults to false. */
  showImage?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const SIZE_CLASSES = {
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
} as const;

const ICON_CLASSES = {
  sm: "size-3",
  md: "size-4",
  lg: "size-5",
} as const;

/**
 * Gets initials from a name (up to 2 characters).
 *
 * @param name - Full name to extract initials from
 * @returns Uppercase initials (1-2 characters)
 */
function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return words[0][0].toUpperCase();
}

/**
 * User avatar thumbnail with profile picture, initials, or icon fallback.
 * Memoized per react-best-practices rerender-memo rule.
 *
 * @param props - Component props
 * @param props.userId - User ID for avatar loading
 * @param props.name - Display name for initials generation
 * @param props.size - Size variant (sm, md, lg)
 * @param props.showImage - Whether to load profile picture from API
 * @param props.className - Additional CSS classes
 */
export const UserThumbnail = memo(function UserThumbnail({
  userId,
  name,
  size = "md",
  showImage = false,
  className,
}: UserThumbnailProps) {
  const [imageError, setImageError] = useState(false);
  const initials = name ? getInitials(name) : "";
  const avatarSrc = `/api/user/avatar?userId=${userId}`;
  const shouldShowImage = showImage && !imageError;

  return (
    <div
      className={cn(
        "bg-muted text-muted-foreground relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium",
        SIZE_CLASSES[size],
        className
      )}
    >
      {shouldShowImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      )}
      {(!shouldShowImage || imageError) &&
        (initials || (
          <FontAwesomeIcon
            icon={faUser}
            className={ICON_CLASSES[size]}
            aria-hidden="true"
          />
        ))}
    </div>
  );
});
