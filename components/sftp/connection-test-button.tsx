/**
 * Connection test button with latency display.
 * Tests SFTP connection and shows result with timing.
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { testSftpConnection } from "@/lib/sftp-actions";
import { Zap, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Duration to show success state before resetting (ms). */
const SUCCESS_DISPLAY_MS = 5000;
/** Duration to show error state before resetting (ms). */
const ERROR_DISPLAY_MS = 3000;

interface ConnectionTestButtonProps {
  connectionId: string;
  variant?: "default" | "ghost" | "outline" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

type TestState = "idle" | "testing" | "success" | "error";

/**
 * Button to test SFTP connection with visual feedback.
 *
 * @param connectionId - ID of connection to test
 * @param variant - Button variant
 * @param size - Button size
 */
export function ConnectionTestButton({
  connectionId,
  variant = "outline",
  size = "default",
  className,
}: ConnectionTestButtonProps) {
  const [state, setState] = useState<TestState>("idle");
  const [latency, setLatency] = useState<number | null>(null);

  const handleTest = async () => {
    setState("testing");
    setLatency(null);

    try {
      const result = await testSftpConnection(connectionId);

      if (result.success) {
        setState("success");
        setLatency(result.data?.latencyMs ?? null);
        toast.success(`Connected in ${result.data?.latencyMs ?? 0}ms`);

        // Reset after success display duration
        setTimeout(() => {
          setState("idle");
          setLatency(null);
        }, SUCCESS_DISPLAY_MS);
      } else {
        setState("error");
        toast.error(result.error);

        // Reset after error display duration
        setTimeout(() => {
          setState("idle");
        }, ERROR_DISPLAY_MS);
      }
    } catch {
      setState("error");
      toast.error("Connection test failed");

      setTimeout(() => {
        setState("idle");
      }, ERROR_DISPLAY_MS);
    }
  };

  const getIcon = () => {
    switch (state) {
      case "testing":
        return <Loader2 className="size-4 animate-spin" />;
      case "success":
        return <CheckCircle2 className="size-4 text-emerald-500" />;
      case "error":
        return <XCircle className="text-destructive size-4" />;
      default:
        return <Zap className="size-4" />;
    }
  };

  const getLabel = () => {
    switch (state) {
      case "testing":
        return "Testing...";
      case "success":
        return latency ? `${latency}ms` : "Connected";
      case "error":
        return "Failed";
      default:
        return "Test";
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleTest}
      disabled={state === "testing"}
      className={cn(
        "gap-1.5 transition-all",
        state === "success" && "text-emerald-600 dark:text-emerald-400",
        state === "error" && "text-destructive",
        className
      )}
    >
      {getIcon()}
      <span className={cn(size === "sm" && "text-xs")}>{getLabel()}</span>
    </Button>
  );
}
