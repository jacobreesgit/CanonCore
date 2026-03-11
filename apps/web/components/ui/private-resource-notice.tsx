import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";

interface PrivateResourceNoticeProps {
  /** Type of resource (item, playlist, profile). */
  resourceType: "item" | "playlist" | "profile";
  /** URL to the authenticated settings view for this resource. */
  settingsUrl?: string;
}

export function PrivateResourceNotice({
  resourceType,
  settingsUrl,
}: PrivateResourceNoticeProps) {
  return (
    <div
      data-testid="private-resource-notice"
      className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center"
    >
      <div className="bg-muted/50 mb-6 flex size-16 items-center justify-center rounded-full">
        <FontAwesomeIcon
          icon={faLock}
          className="text-muted-foreground size-6"
          aria-hidden="true"
        />
      </div>
      <h1 className="text-foreground mb-2 text-xl font-semibold">
        This {resourceType} is private
      </h1>
      <p className="text-muted-foreground mb-8 max-w-sm text-sm">
        Only you can see this. Make it public in {resourceType} settings to
        share it with others.
      </p>
      <div className="flex gap-3">
        {settingsUrl && (
          <Button asChild>
            <Link href={settingsUrl}>Open settings</Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href="/explore">Go to Explore</Link>
        </Button>
      </div>
    </div>
  );
}
