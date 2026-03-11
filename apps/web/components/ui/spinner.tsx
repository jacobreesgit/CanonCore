import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

import { cn } from "@/lib/utils";

function Spinner({ className }: { className?: string }) {
  return (
    <FontAwesomeIcon
      icon={faSpinner}
      spin
      role="status"
      aria-label="Loading"
      className={cn("size-4", className)}
    />
  );
}

export { Spinner };
