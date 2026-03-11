import { cn } from "@/lib/utils";

interface BackgroundScanlineProps {
  className?: string;
}

export function BackgroundScanline({ className }: BackgroundScanlineProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 opacity-[0.08]",
        className
      )}
      aria-hidden="true"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.03) 1px, rgba(255,255,255,0.03) 2px)",
      }}
    />
  );
}
