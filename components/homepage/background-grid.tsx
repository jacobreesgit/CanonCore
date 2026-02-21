import { cn } from "@/lib/utils";

const LINE_POSITIONS = ["16.67%", "33.33%", "50%", "66.67%", "83.33%"];

interface BackgroundGridProps {
  className?: string;
}

export function BackgroundGrid({ className }: BackgroundGridProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
      aria-hidden="true"
    >
      {LINE_POSITIONS.map((left) => (
        <div
          key={left}
          className="absolute top-0 h-full w-px"
          style={{
            left,
            background:
              "linear-gradient(to bottom, transparent 0px, rgba(255, 255, 255, 0.125) 240px)",
          }}
        />
      ))}
    </div>
  );
}
