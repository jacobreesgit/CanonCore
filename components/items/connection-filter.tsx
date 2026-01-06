/**
 * Dropdown filter for SFTP connections.
 * Allows users to filter items by connection source.
 */

"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Server } from "lucide-react";

interface ConnectionFilterProps {
  /** Available SFTP connections */
  connections: Array<{ id: string; name: string }>;
  /** Currently selected connection ID (null for all items) */
  selectedConnectionId: string | null;
  /** Callback when selection changes */
  onConnectionChange?: (connectionId: string | null) => void;
  /** Whether the filter is disabled (e.g., on item detail pages) */
  disabled?: boolean;
}

/**
 * Dropdown to filter items by SFTP connection.
 * When multiple connections exist, shows "All Items" option.
 * When only one connection exists, shows just that connection (no "All Items").
 *
 * @param connections - Available SFTP connections
 * @param selectedConnectionId - Currently selected connection ID (null for all)
 * @param onConnectionChange - Callback when selection changes
 */
export function ConnectionFilter({
  connections,
  selectedConnectionId,
  onConnectionChange,
  disabled = false,
}: ConnectionFilterProps) {
  const hasConnections = connections.length > 0;
  const hasSingleConnection = connections.length === 1;

  // For single connection, always use that connection's ID
  const effectiveValue = hasSingleConnection
    ? connections[0].id
    : (selectedConnectionId ?? "all");

  // Disabled when: explicitly disabled, no connections, or single connection (no choice)
  const isDisabled = disabled || !hasConnections || hasSingleConnection;

  return (
    <Select
      value={effectiveValue}
      onValueChange={(value) =>
        onConnectionChange?.(value === "all" ? null : value)
      }
      disabled={isDisabled}
    >
      <SelectTrigger className="w-[200px]">
        <div className="flex items-center gap-2">
          <Server className="text-muted-foreground size-4" />
          <SelectValue placeholder="All Items" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {/* Only show "All Items" when multiple connections exist */}
        {!hasSingleConnection && <SelectItem value="all">All Items</SelectItem>}
        {connections.map((connection) => (
          <SelectItem key={connection.id} value={connection.id}>
            {connection.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
