import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { cn } from "@/lib/utils";

interface SheetHeaderIconProps {
  icon: IconDefinition;
  className?: string;
}

/** Decorative icon badge used in mobile bottom sheet headers. */
export function SheetHeaderIcon({ icon, className }: SheetHeaderIconProps) {
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl",
        "bg-primary/10 ring-primary/20 ring-1",
        className
      )}
    >
      <FontAwesomeIcon
        icon={icon}
        aria-hidden="true"
        className="text-primary size-5"
      />
    </div>
  );
}
