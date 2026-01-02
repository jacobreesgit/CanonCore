/**
 * SFTP path and filename utilities.
 * Provides security validation to prevent directory traversal attacks.
 */

/**
 * Sanitizes a path to prevent directory traversal attacks.
 * Ensures the resolved path stays within the allowed base path.
 *
 * @param basePath - The allowed root directory
 * @param userPath - The user-provided path segment
 * @returns Sanitized absolute path
 * @throws If path attempts to escape basePath
 *
 * @example
 * sanitizePath("/home/user", "docs/file.txt") // "/home/user/docs/file.txt"
 * sanitizePath("/home/user", "../etc/passwd") // throws Error
 */
export function sanitizePath(basePath: string, userPath: string): string {
  const normalizedBase =
    basePath.replace(/\/+/g, "/").replace(/\/+$/, "") || "/";
  const normalizedUser = userPath.replace(/^\/+/, "");

  const segments = normalizedUser.split("/").filter((s) => s && s !== ".");

  const resolvedSegments: string[] = [];
  for (const segment of segments) {
    if (segment === "..") {
      throw new Error("Path traversal not allowed");
    }
    resolvedSegments.push(segment);
  }

  const resolvedPath =
    `${normalizedBase}/${resolvedSegments.join("/")}`.replace(/\/+/g, "/");

  if (!resolvedPath.startsWith(normalizedBase)) {
    throw new Error("Path traversal not allowed");
  }

  return resolvedPath;
}

/**
 * Validates a filename against safe characters.
 *
 * @param name - Filename to validate
 * @throws If filename contains invalid characters
 */
export function validateFileName(name: string): void {
  // eslint-disable-next-line no-control-regex
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(name)) {
    throw new Error("Filename contains invalid characters");
  }
  if (name === "." || name === "..") {
    throw new Error("Invalid filename");
  }
  if (name.length > 255) {
    throw new Error("Filename too long");
  }
}

/**
 * Wraps an async operation with a timeout.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param operation - Operation name for error message
 * @returns The promise result
 * @throws If operation times out
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}
