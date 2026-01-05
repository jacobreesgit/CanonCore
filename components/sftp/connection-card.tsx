/**
 * Connection card component for displaying SFTP connection details.
 * Shows connection info, status, and actions.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConnectionTestButton } from "./connection-test-button";
import {
  Server,
  MoreVertical,
  Pencil,
  Trash2,
  FolderOpen,
  Key,
  Lock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteSftpConnection } from "@/lib/sftp-actions";
import { toast } from "sonner";

interface ConnectionCardProps {
  connection: {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    authType: "PASSWORD" | "PRIVATE_KEY";
    basePath: string;
    isActive: boolean;
    lastConnectedAt: Date | null;
    lastError: string | null;
  };
  onDelete?: () => void;
}

/**
 * Displays an SFTP connection with status and actions.
 *
 * @param connection - Connection details
 * @param onDelete - Callback after successful deletion
 */
export function ConnectionCard({ connection, onDelete }: ConnectionCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (
      !confirm(`Delete connection "${connection.name}"? This cannot be undone.`)
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteSftpConnection(connection.id);
      if (result.success) {
        toast.success("Connection deleted");
        onDelete?.();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to delete connection");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Link
      href={`/dashboard/connections/${connection.id}`}
      className="focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <Card
        className={cn(
          "group relative overflow-hidden transition-all duration-200",
          "hover:border-primary/20 cursor-pointer hover:shadow-md",
          connection.lastError && "border-destructive/30"
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-lg transition-colors",
                connection.lastError
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              )}
            >
              <Server className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="truncate text-base">
                  {connection.name}
                </CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={(e) => e.preventDefault()}
                    >
                      <MoreVertical className="size-4" />
                      <span className="sr-only">Connection actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/dashboard/connections/${connection.id}/edit`}
                      >
                        <Pencil className="mr-2 size-4" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      <Trash2 className="mr-2 size-4" />
                      {isDeleting ? "Deleting..." : "Delete"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <CardDescription className="flex items-center gap-1.5 font-mono text-xs">
                <span className="truncate">
                  {connection.host}:{connection.port}
                </span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Connection details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="text-muted-foreground flex items-center gap-2">
              <span className="bg-muted flex size-6 items-center justify-center rounded">
                @
              </span>
              <span className="truncate font-mono text-xs">
                {connection.username}
              </span>
            </div>
            <div className="text-muted-foreground flex items-center gap-2">
              {connection.authType === "PASSWORD" ? (
                <Lock className="size-4" />
              ) : (
                <Key className="size-4" />
              )}
              <span className="text-xs">
                {connection.authType === "PASSWORD" ? "Password" : "SSH Key"}
              </span>
            </div>
            <div className="text-muted-foreground col-span-2 flex items-center gap-2">
              <FolderOpen className="size-4" />
              <span className="truncate font-mono text-xs">
                {connection.basePath}
              </span>
            </div>
          </div>

          {/* Status and last connected */}
          <div className="text-muted-foreground flex items-center justify-between border-t pt-3 text-xs">
            <div className="flex items-center gap-1.5">
              {connection.lastError ? (
                <>
                  <XCircle className="text-destructive size-3.5" />
                  <span className="text-destructive max-w-[150px] truncate">
                    {connection.lastError}
                  </span>
                </>
              ) : connection.lastConnectedAt ? (
                <>
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span>
                    Connected{" "}
                    {formatDistanceToNow(new Date(connection.lastConnectedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </>
              ) : (
                <span>Never connected</span>
              )}
            </div>

            <div onClick={(e) => e.preventDefault()}>
              <ConnectionTestButton
                connectionId={connection.id}
                variant="ghost"
                size="sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
