/**
 * React Error Boundary for graceful error handling.
 * Catches JavaScript errors in child components and displays fallback UI.
 */

"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTriangleExclamation,
  faRotate,
} from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  /** Child components to render. */
  children: ReactNode;
  /** Custom fallback UI (optional). */
  fallback?: ReactNode;
  /** Callback when error occurs (optional). */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary that catches errors in child components.
 * Logs errors and displays a fallback UI.
 *
 * @example
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error with browser console (pino not available in client components)
    console.error("React error boundary caught error:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Call optional callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex min-h-[400px] flex-1 flex-col items-center justify-center gap-4 p-8">
          <div className="bg-destructive/10 flex size-16 items-center justify-center rounded-full">
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              className="text-destructive size-8"
            />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              An error occurred while rendering this section.
            </p>
          </div>
          <Button onClick={this.handleRetry} variant="outline" size="sm">
            <FontAwesomeIcon icon={faRotate} className="mr-2 size-4" />
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
