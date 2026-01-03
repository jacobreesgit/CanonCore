/**
 * SFTP connection form component.
 * Handles creating and editing connection configurations.
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createSftpConnection, updateSftpConnection } from "@/lib/sftp-actions";
import { toast } from "sonner";
import {
  Server,
  Key,
  Lock,
  FolderOpen,
  Loader2,
  ChevronDown,
  Play,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ConnectionFormProps {
  mode: "create" | "edit";
  initialData?: {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    authType: "PASSWORD" | "PRIVATE_KEY";
    basePath: string;
    webdavUrl?: string | null;
    webdavUsername?: string | null;
  };
}

/**
 * Form for creating or editing SFTP connections.
 *
 * @param mode - Create or edit mode
 * @param initialData - Existing connection data for edit mode
 */
export function ConnectionForm({ mode, initialData }: ConnectionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    name: initialData?.name ?? "",
    host: initialData?.host ?? "",
    port: initialData?.port ?? 22,
    username: initialData?.username ?? "",
    authType: initialData?.authType ?? ("PASSWORD" as const),
    credential: "",
    basePath: initialData?.basePath ?? "/",
    webdavUrl: initialData?.webdavUrl ?? "",
    webdavUsername: initialData?.webdavUsername ?? "",
    webdavPassword: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [streamingOpen, setStreamingOpen] = useState(
    Boolean(initialData?.webdavUrl)
  );

  const handleChange = (
    field: keyof typeof formData,
    value: string | number
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is edited
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    if (!formData.host.trim()) {
      newErrors.host = "Host is required";
    }
    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    }
    if (mode === "create" && !formData.credential.trim()) {
      newErrors.credential =
        formData.authType === "PASSWORD"
          ? "Password is required"
          : "Private key is required";
    }
    if (formData.port < 1 || formData.port > 65535) {
      newErrors.port = "Port must be between 1 and 65535";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    startTransition(async () => {
      try {
        if (mode === "create") {
          const result = await createSftpConnection({
            name: formData.name,
            host: formData.host,
            port: formData.port,
            username: formData.username,
            authType: formData.authType,
            credential: formData.credential,
            basePath: formData.basePath || "/",
            webdavUrl: formData.webdavUrl || undefined,
            webdavUsername: formData.webdavUsername || undefined,
            webdavPassword: formData.webdavPassword || undefined,
          });

          if (result.success) {
            toast.success("Connection created");
            router.push("/dashboard/connections");
          } else {
            toast.error(result.error);
          }
        } else if (initialData) {
          const updateData: Parameters<typeof updateSftpConnection>[1] = {
            name: formData.name,
            host: formData.host,
            port: formData.port,
            username: formData.username,
            authType: formData.authType,
            basePath: formData.basePath || "/",
            webdavUrl: formData.webdavUrl || null,
            webdavUsername: formData.webdavUsername || null,
          };

          // Only include credential if changed
          if (formData.credential.trim()) {
            updateData.credential = formData.credential;
          }

          // Only include WebDAV password if changed
          if (formData.webdavPassword.trim()) {
            updateData.webdavPassword = formData.webdavPassword;
          }

          const result = await updateSftpConnection(initialData.id, updateData);

          if (result.success) {
            toast.success("Connection updated");
            router.push("/dashboard/connections");
          } else {
            toast.error(result.error);
          }
        }
      } catch {
        toast.error("An error occurred");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
              <Server className="size-5" />
            </div>
            <div>
              <CardTitle>
                {mode === "create" ? "New Connection" : "Edit Connection"}
              </CardTitle>
              <CardDescription>
                {mode === "create"
                  ? "Configure your SFTP server connection"
                  : "Update connection settings"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Connection name */}
          <div className="space-y-2">
            <Label htmlFor="name">Connection Name</Label>
            <Input
              id="name"
              placeholder="My SFTP Server"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className={cn(errors.name && "border-destructive")}
            />
            {errors.name && (
              <p className="text-destructive text-xs">{errors.name}</p>
            )}
          </div>

          {/* Host and Port */}
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                placeholder="sftp.example.com"
                value={formData.host}
                onChange={(e) => handleChange("host", e.target.value)}
                className={cn("font-mono", errors.host && "border-destructive")}
              />
              {errors.host && (
                <p className="text-destructive text-xs">{errors.host}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                min={1}
                max={65535}
                value={formData.port}
                onChange={(e) =>
                  handleChange("port", parseInt(e.target.value) || 22)
                }
                className={cn("font-mono", errors.port && "border-destructive")}
              />
              {errors.port && (
                <p className="text-destructive text-xs">{errors.port}</p>
              )}
            </div>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="sftp-user"
              value={formData.username}
              onChange={(e) => handleChange("username", e.target.value)}
              className={cn(
                "font-mono",
                errors.username && "border-destructive"
              )}
            />
            {errors.username && (
              <p className="text-destructive text-xs">{errors.username}</p>
            )}
          </div>

          {/* Auth Type */}
          <div className="space-y-2">
            <Label>Authentication Method</Label>
            <Select
              value={formData.authType}
              onValueChange={(value: "PASSWORD" | "PRIVATE_KEY") =>
                handleChange("authType", value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PASSWORD">
                  <div className="flex items-center gap-2">
                    <Lock className="size-4" />
                    <span>Password</span>
                  </div>
                </SelectItem>
                <SelectItem value="PRIVATE_KEY">
                  <div className="flex items-center gap-2">
                    <Key className="size-4" />
                    <span>SSH Private Key</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Credential (Password or Private Key) */}
          <div className="space-y-2">
            <Label htmlFor="credential">
              {formData.authType === "PASSWORD" ? "Password" : "Private Key"}
              {mode === "edit" && (
                <span className="text-muted-foreground ml-2 text-xs">
                  (leave empty to keep current)
                </span>
              )}
            </Label>
            {formData.authType === "PASSWORD" ? (
              <Input
                id="credential"
                type="password"
                placeholder="••••••••"
                value={formData.credential}
                onChange={(e) => handleChange("credential", e.target.value)}
                className={cn(errors.credential && "border-destructive")}
              />
            ) : (
              <Textarea
                id="credential"
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                value={formData.credential}
                onChange={(e) => handleChange("credential", e.target.value)}
                className={cn(
                  "min-h-[120px] font-mono text-xs",
                  errors.credential && "border-destructive"
                )}
              />
            )}
            {errors.credential && (
              <p className="text-destructive text-xs">{errors.credential}</p>
            )}
          </div>

          {/* Base Path */}
          <div className="space-y-2">
            <Label htmlFor="basePath" className="flex items-center gap-2">
              <FolderOpen className="text-muted-foreground size-4" />
              Base Path
            </Label>
            <Input
              id="basePath"
              placeholder="/"
              value={formData.basePath}
              onChange={(e) => handleChange("basePath", e.target.value)}
              className="font-mono"
            />
            <p className="text-muted-foreground text-xs">
              The root directory for file operations
            </p>
          </div>

          {/* Streaming Configuration (WebDAV) */}
          <Collapsible open={streamingOpen} onOpenChange={setStreamingOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border p-4",
                  "bg-muted/30 hover:bg-muted/50 transition-colors",
                  "group focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-md">
                    <Play className="size-4" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-medium">
                      Streaming Configuration
                    </span>
                    <p className="text-muted-foreground text-xs">
                      Optional WebDAV settings for media playback
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "text-muted-foreground size-4 transition-transform duration-200",
                    streamingOpen && "rotate-180"
                  )}
                />
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent className="pt-4">
              <div className="bg-muted/20 space-y-4 rounded-lg border p-4">
                {/* WebDAV URL */}
                <div className="space-y-2">
                  <Label
                    htmlFor="webdavUrl"
                    className="flex items-center gap-2"
                  >
                    <Globe className="text-muted-foreground size-4" />
                    WebDAV URL
                  </Label>
                  <Input
                    id="webdavUrl"
                    type="url"
                    placeholder="https://webdav.example.com/"
                    value={formData.webdavUrl}
                    onChange={(e) => handleChange("webdavUrl", e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-muted-foreground text-xs">
                    HTTP endpoint for streaming media files
                  </p>
                </div>

                {/* WebDAV Username */}
                <div className="space-y-2">
                  <Label htmlFor="webdavUsername">WebDAV Username</Label>
                  <Input
                    id="webdavUsername"
                    placeholder="webdav-user"
                    value={formData.webdavUsername}
                    onChange={(e) =>
                      handleChange("webdavUsername", e.target.value)
                    }
                    className="font-mono"
                  />
                  <p className="text-muted-foreground text-xs">
                    Often same as SFTP username, but can differ
                  </p>
                </div>

                {/* WebDAV Password */}
                <div className="space-y-2">
                  <Label htmlFor="webdavPassword">
                    WebDAV Password
                    {mode === "edit" && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        (leave empty to keep current)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="webdavPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.webdavPassword}
                    onChange={(e) =>
                      handleChange("webdavPassword", e.target.value)
                    }
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>

        <CardFooter className="flex justify-between border-t pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/dashboard/connections")}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {mode === "create" ? "Create Connection" : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
