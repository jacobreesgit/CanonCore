/**
 * Storybook stories for the SyncHistory component.
 * Uses a mock component since the real one relies on server actions.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  FolderPlus,
  Pencil,
  Trash2,
  Upload,
  Download,
  RefreshCw,
  MoveRight,
  History,
  Loader2,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { SyncLogAction, SyncLogStatus } from "@/lib/sync-utils";
import { SyncHistory } from "./sync-history";

/** Icon mapping for each action type */
const ACTION_ICONS: Record<SyncLogAction, LucideIcon> = {
  [SyncLogAction.CREATE]: FolderPlus,
  [SyncLogAction.RENAME]: Pencil,
  [SyncLogAction.DELETE]: Trash2,
  [SyncLogAction.MOVE]: MoveRight,
  [SyncLogAction.UPLOAD]: Upload,
  [SyncLogAction.DOWNLOAD]: Download,
  [SyncLogAction.SYNC]: RefreshCw,
};

/** Human-readable labels for each action type */
const ACTION_LABELS: Record<SyncLogAction, string> = {
  [SyncLogAction.CREATE]: "Created",
  [SyncLogAction.RENAME]: "Renamed",
  [SyncLogAction.DELETE]: "Deleted",
  [SyncLogAction.MOVE]: "Moved",
  [SyncLogAction.UPLOAD]: "Uploaded",
  [SyncLogAction.DOWNLOAD]: "Downloaded",
  [SyncLogAction.SYNC]: "Synced",
};

/** Cached number formatter for locale-aware duration formatting */
const durationFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

const durationWholeFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

function formatDuration(ms: number): string {
  if (ms < 1000) return `${durationWholeFormatter.format(ms)}ms`;
  if (ms < 60000) return `${durationFormatter.format(ms / 1000)}s`;
  return `${durationFormatter.format(ms / 60000)}m`;
}

interface MockLog {
  id: string;
  action: SyncLogAction;
  status: SyncLogStatus;
  itemName: string | null;
  fileName: string | null;
  error: string | null;
  duration: number;
  createdAt: Date;
}

interface MockSyncHistoryProps {
  logs: MockLog[];
  loading?: boolean;
  error?: string | null;
}

/**
 * Mock component that renders the sync history UI with provided data.
 * The real component fetches via server action which can't be mocked in Storybook.
 */
function MockSyncHistory({ logs, loading, error }: MockSyncHistoryProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8">
        <Loader2 className="text-muted-foreground size-4 animate-spin" />
        <span className="text-muted-foreground text-sm">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-muted-foreground py-4 text-center text-sm">
        {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="space-y-3 py-4 text-center">
        <div className="bg-muted/50 mx-auto flex size-10 items-center justify-center rounded-full">
          <History className="text-muted-foreground size-5" />
        </div>
        <p className="text-muted-foreground text-sm">No sync activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">Recent activity</span>
      </div>

      <div className="space-y-1.5">
        {logs.map((log) => {
          const Icon: LucideIcon = ACTION_ICONS[log.action] ?? RefreshCw;
          const label = ACTION_LABELS[log.action] ?? log.action;
          const name = log.itemName || log.fileName || "Sync operation";
          const isSuccess = log.status === SyncLogStatus.SUCCESS;
          const isFailed = log.status === SyncLogStatus.FAILED;

          return (
            <div
              key={log.id}
              className={cn(
                "flex items-start gap-2.5 rounded-md border p-2.5",
                "transition-colors",
                isFailed
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border/50 hover:bg-muted/30"
              )}
            >
              {/* Status icon */}
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md",
                  isSuccess && "bg-emerald-500/10 text-emerald-600",
                  isFailed && "bg-destructive/10 text-destructive",
                  !isSuccess && !isFailed && "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="size-3.5" />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{name}</span>
                  {isSuccess && (
                    <CheckCircle2 className="size-3 shrink-0 text-emerald-600" />
                  )}
                  {isFailed && (
                    <XCircle className="text-destructive size-3 shrink-0" />
                  )}
                </div>

                <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
                  <span
                    className={cn(
                      isFailed && "text-destructive",
                      isSuccess && "text-emerald-600"
                    )}
                  >
                    {isFailed ? "Failed" : label}
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span>
                    {formatDistanceToNow(new Date(log.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                  {log.duration !== null && log.duration > 0 && (
                    <>
                      <span className="text-muted-foreground/50">·</span>
                      <span className="tabular-nums">
                        {formatDuration(log.duration)}
                      </span>
                    </>
                  )}
                </div>

                {/* Error message */}
                {isFailed && log.error && (
                  <p className="text-destructive/80 mt-1 text-xs leading-snug">
                    {log.error}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Creates mock sync log entries for stories.
 */
function createMockLogs(): MockLog[] {
  const now = Date.now();

  return [
    {
      id: "log-1",
      action: SyncLogAction.CREATE,
      status: SyncLogStatus.SUCCESS,
      itemName: "Breaking Bad",
      fileName: null,
      error: null,
      duration: 245,
      createdAt: new Date(now - 5 * 60 * 1000),
    },
    {
      id: "log-2",
      action: SyncLogAction.UPLOAD,
      status: SyncLogStatus.SUCCESS,
      itemName: null,
      fileName: "poster.jpg",
      error: null,
      duration: 1250,
      createdAt: new Date(now - 15 * 60 * 1000),
    },
    {
      id: "log-3",
      action: SyncLogAction.RENAME,
      status: SyncLogStatus.SUCCESS,
      itemName: "Season 1",
      fileName: null,
      error: null,
      duration: 120,
      createdAt: new Date(now - 30 * 60 * 1000),
    },
    {
      id: "log-4",
      action: SyncLogAction.DELETE,
      status: SyncLogStatus.FAILED,
      itemName: "Old Item",
      fileName: null,
      error: "Permission denied: Cannot delete folder",
      duration: 89,
      createdAt: new Date(now - 60 * 60 * 1000),
    },
    {
      id: "log-5",
      action: SyncLogAction.SYNC,
      status: SyncLogStatus.SUCCESS,
      itemName: null,
      fileName: null,
      error: null,
      duration: 3500,
      createdAt: new Date(now - 2 * 60 * 60 * 1000),
    },
  ];
}

const meta = {
  title: "Google Drive/SyncHistory",
  component: SyncHistory,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Displays recent sync operations with status indicators, timestamps, and error messages.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[400px] rounded-lg border p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SyncHistory>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Mixed sync operations showing various action types and statuses.
 */
export const Default: Story = {
  render: () => <MockSyncHistory logs={createMockLogs()} />,
};

/**
 * Empty state when no sync activity exists.
 */
export const Empty: Story = {
  render: () => <MockSyncHistory logs={[]} />,
};

/**
 * Multiple failed operations with error messages.
 */
export const WithFailures: Story = {
  render: () => {
    const now = Date.now();
    const failedLogs: MockLog[] = [
      {
        id: "log-1",
        action: SyncLogAction.UPLOAD,
        status: SyncLogStatus.FAILED,
        itemName: null,
        fileName: "large_video.mkv",
        error: "Quota exceeded: Not enough storage space",
        duration: 5200,
        createdAt: new Date(now - 2 * 60 * 1000),
      },
      {
        id: "log-2",
        action: SyncLogAction.DELETE,
        status: SyncLogStatus.FAILED,
        itemName: "Protected Folder",
        fileName: null,
        error: "Permission denied: Cannot modify system folder",
        duration: 45,
        createdAt: new Date(now - 15 * 60 * 1000),
      },
      {
        id: "log-3",
        action: SyncLogAction.SYNC,
        status: SyncLogStatus.FAILED,
        itemName: null,
        fileName: null,
        error: "Network error: Connection timed out",
        duration: 30000,
        createdAt: new Date(now - 60 * 60 * 1000),
      },
    ];
    return <MockSyncHistory logs={failedLogs} />;
  },
};
