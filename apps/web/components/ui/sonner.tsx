/**
 * Toast notification component using Sonner.
 * Provides success, error, info, warning, and loading toast styles.
 */

"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleInfo,
  faCircleXmark,
  faSpinner,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toast container that renders all toast notifications.
 * Add this component once in your root layout.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      richColors
      position="top-right"
      duration={4000}
      icons={{
        success: <FontAwesomeIcon icon={faCircleCheck} className="size-4" />,
        info: <FontAwesomeIcon icon={faCircleInfo} className="size-4" />,
        warning: (
          <FontAwesomeIcon icon={faTriangleExclamation} className="size-4" />
        ),
        error: <FontAwesomeIcon icon={faCircleXmark} className="size-4" />,
        loading: <FontAwesomeIcon icon={faSpinner} spin className="size-4" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
