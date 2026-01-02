# Connection Detail Page Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create SFTP connection detail pages that display folder contents with sync/upload capabilities, and address all code review issues.

**Architecture:** Connection-scoped URLs (`/dashboard/connections/[id]` and `/dashboard/connections/[id]/[itemId]`) with thin server components that render the existing `ItemsView` with `connectionId` prop to enable SFTP functionality.

**Tech Stack:** Next.js App Router, React Server Components, existing SFTP actions and components.

---

## Overview

When a user clicks on a connection card in `/dashboard/connections`, they navigate to a detail page showing the SFTP server's folder contents. Users can:

- Click **Sync** to pull files/folders from the SFTP server
- Click **Upload** to upload files to the SFTP server
- Click folders to navigate deeper into the hierarchy
- Use breadcrumbs to navigate back up

## URL Structure

```
/dashboard/connections                    → List all connections
/dashboard/connections/[id]               → Root of SFTP server (basePath contents)
/dashboard/connections/[id]/[itemId]      → Subfolder within that connection
```

## File Changes

### New Files

| File                                                           | Purpose                          |
| -------------------------------------------------------------- | -------------------------------- |
| `app/(dashboard)/dashboard/connections/[id]/page.tsx`          | Connection root view             |
| `app/(dashboard)/dashboard/connections/[id]/[itemId]/page.tsx` | Subfolder view within connection |

### Modified Files

| File                                         | Change                                         |
| -------------------------------------------- | ---------------------------------------------- |
| `components/sftp/connection-card.tsx`        | Wrap with Link, add click handlers             |
| `components/items/items-view.tsx`            | Update breadcrumb links for connection context |
| `lib/sftp-actions.ts`                        | Add `getItemsByConnection()` action            |
| `lib/env.ts`                                 | Add ENCRYPTION_KEY validation                  |
| `app/api/sftp/download/[itemId]/route.ts`    | Remove unused streaming logic                  |
| `components/sftp/connection-test-button.tsx` | Extract timeout constants                      |

---

## Task 1: Add ENCRYPTION_KEY to env.ts

**Files:**

- Modify: `lib/env.ts`

**Steps:**

1. Open `lib/env.ts`
2. Add `ENCRYPTION_KEY` to the Zod schema:
   ```typescript
   ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY is required"),
   ```
3. Run `pnpm run type-check` to verify no type errors

**Verification:** App should fail fast with clear error if ENCRYPTION_KEY is missing.

---

## Task 2: Simplify Download Route

**Files:**

- Modify: `app/api/sftp/download/[itemId]/route.ts`

**Steps:**

1. Remove the `BUFFER_THRESHOLD` constant (line ~11)
2. Remove the conditional streaming logic
3. Simplify to single response:
   ```typescript
   const uint8Array = new Uint8Array(buffer);
   return new NextResponse(uint8Array, { headers });
   ```
4. Run `pnpm run type-check` to verify

**Verification:** Download still works correctly.

---

## Task 3: Extract Timeout Constants

**Files:**

- Modify: `components/sftp/connection-test-button.tsx`

**Steps:**

1. Add constants at top of file:
   ```typescript
   /** Duration to show success state before resetting (ms). */
   const SUCCESS_DISPLAY_MS = 5000;
   /** Duration to show error state before resetting (ms). */
   const ERROR_DISPLAY_MS = 3000;
   ```
2. Replace magic numbers in setTimeout calls with constants
3. Run `pnpm run type-check`

---

## Task 4: Add getItemsByConnection Action

**Files:**

- Modify: `lib/sftp-actions.ts`

**Steps:**

1. Add new server action:

   ```typescript
   /**
    * Gets items for a specific connection, optionally filtered by parent.
    *
    * @param connectionId - SFTP connection ID
    * @param parentId - Parent item ID (null for root level)
    * @returns Items belonging to the connection
    */
   export async function getItemsByConnection(
     connectionId: string,
     parentId: string | null
   ): Promise<ActionResult<Item[]>> {
     try {
       const userId = await requireAuth();

       // Verify connection ownership
       const connection = await prisma.sftpConnection.findFirst({
         where: { id: connectionId, userId },
       });
       if (!connection) {
         return { success: false, error: "Connection not found" };
       }

       const items = await prisma.item.findMany({
         where: {
           userId,
           connectionId,
           parentId,
         },
         orderBy: { order: "asc" },
       });

       return { success: true, data: items };
     } catch (error) {
       console.error("[SFTP] Get items by connection error:", error);
       return { success: false, error: "Failed to load items" };
     }
   }
   ```

2. Run `pnpm run type-check`

---

## Task 5: Create Connection Root Page

**Files:**

- Create: `app/(dashboard)/dashboard/connections/[id]/page.tsx`

**Steps:**

1. Create the directory structure if needed
2. Create page with:

   ```typescript
   /**
    * Connection detail page displaying SFTP folder contents.
    * Shows root-level items for the connection with sync/upload capabilities.
    */

   import { notFound } from "next/navigation";
   import { ItemsView } from "@/components/items";
   import { getSftpConnection, getItemsByConnection } from "@/lib/sftp-actions";

   interface ConnectionDetailPageProps {
     params: Promise<{ id: string }>;
   }

   /**
    * Renders the SFTP connection root folder view.
    * Displays items at the connection's base path.
    */
   export default async function ConnectionDetailPage({
     params,
   }: ConnectionDetailPageProps) {
     const { id } = await params;

     // Verify connection exists and user owns it
     const connectionResult = await getSftpConnection(id);
     if (!connectionResult.success || !connectionResult.data) {
       notFound();
     }

     // Get root-level items for this connection
     const itemsResult = await getItemsByConnection(id, null);
     const items = itemsResult.success ? (itemsResult.data ?? []) : [];

     // Breadcrumbs: just the connection name at root level
     const breadcrumbs = [{ id, name: connectionResult.data.name }];

     return (
       <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
         <ItemsView
           items={items}
           parentId={null}
           connectionId={id}
           breadcrumbs={breadcrumbs}
         />
       </div>
     );
   }
   ```

3. Run `pnpm run type-check`

---

## Task 6: Create Connection Subfolder Page

**Files:**

- Create: `app/(dashboard)/dashboard/connections/[id]/[itemId]/page.tsx`

**Steps:**

1. Create the file:

   ```typescript
   /**
    * Connection subfolder page displaying SFTP folder contents.
    * Shows children of the specified folder within a connection.
    */

   import { notFound } from "next/navigation";
   import { ItemsView } from "@/components/items";
   import { getItem } from "@/lib/item-actions";
   import { getSftpConnection, getItemsByConnection } from "@/lib/sftp-actions";

   interface ConnectionItemPageProps {
     params: Promise<{ id: string; itemId: string }>;
   }

   /**
    * Renders a subfolder view within an SFTP connection.
    * Builds breadcrumb path from connection root to current folder.
    */
   export default async function ConnectionItemPage({
     params,
   }: ConnectionItemPageProps) {
     const { id: connectionId, itemId } = await params;

     // Verify connection exists and user owns it
     const connectionResult = await getSftpConnection(connectionId);
     if (!connectionResult.success || !connectionResult.data) {
       notFound();
     }

     // Get current item with ancestors for breadcrumbs
     const itemResult = await getItem(itemId);
     if (!itemResult.success || !itemResult.data) {
       notFound();
     }

     const { item, ancestors } = itemResult.data;

     // Security: verify item belongs to this connection
     if (item.connectionId !== connectionId) {
       notFound();
     }

     // Get children of current item
     const childrenResult = await getItemsByConnection(connectionId, itemId);
     const children = childrenResult.success ? (childrenResult.data ?? []) : [];

     // Build breadcrumbs: Connection > Ancestors > Current
     const breadcrumbs = [
       { id: connectionId, name: connectionResult.data.name },
       ...ancestors.map((a) => ({ id: a.id, name: a.name })),
       { id: item.id, name: item.name },
     ];

     return (
       <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
         <ItemsView
           items={children}
           parentId={itemId}
           connectionId={connectionId}
           breadcrumbs={breadcrumbs}
         />
       </div>
     );
   }
   ```

2. Run `pnpm run type-check`

---

## Task 7: Update ItemsView Breadcrumb Links

**Files:**

- Modify: `components/items/items-view.tsx`

**Steps:**

1. Find the breadcrumb rendering section
2. Update link generation to handle connection context:

   ```typescript
   // Helper to generate breadcrumb href
   const getBreadcrumbHref = (crumbId: string, index: number) => {
     if (!connectionId) {
       // Regular items
       return index === 0 ? "/dashboard" : `/dashboard/${crumbId}`;
     }
     // Connection items: first crumb is connection, rest are folders
     if (index === 0) {
       return `/dashboard/connections/${connectionId}`;
     }
     return `/dashboard/connections/${connectionId}/${crumbId}`;
   };
   ```

3. Add a "back to connections" link when at connection root
4. Run `pnpm run type-check`

---

## Task 8: Make Connection Card Clickable

**Files:**

- Modify: `components/sftp/connection-card.tsx`

**Steps:**

1. Import Link from next/link
2. Wrap the Card component with Link:

   ```typescript
   <Link
     href={`/dashboard/connections/${connection.id}`}
     className="block"
   >
     <Card className="... cursor-pointer">
       ...
     </Card>
   </Link>
   ```

3. Add `e.preventDefault()` to DropdownMenuTrigger to prevent navigation when opening menu
4. Update ConnectionTestButton to stop propagation:

   ```typescript
   <div onClick={(e) => e.stopPropagation()}>
     <ConnectionTestButton ... />
   </div>
   ```

5. Run `pnpm run type-check`

---

## Task 9: Run All Checks

**Steps:**

1. Run `pnpm run format` to format code
2. Run `pnpm run check` to run all checks (format, lint, type-check, knip, build)
3. Fix any issues that arise

---

## Task 10: Run E2E Tests

**Steps:**

1. Ensure Docker is running
2. Run `pnpm run test:e2e` to run all E2E tests
3. The SFTP tests should now pass since the connection detail page exists
4. Fix any failing tests

---

## Testing Strategy

**Unit Tests:** Not needed - pages are thin server components calling tested actions.

**Integration Tests:** Covered by existing `tests/integration/sftp/sftp-connection.test.ts`.

**E2E Tests:** Existing tests in `e2e/journeys/sftp/*.spec.ts` validate:

- Connection card click → detail page navigation
- Sync button functionality
- File/folder display after sync
- Nested folder navigation
- Upload functionality

---

## Security Considerations

1. **Connection ownership:** Both pages verify the connection belongs to the authenticated user
2. **Item ownership:** Subfolder page verifies the item belongs to the specified connection
3. **Path traversal:** Already protected by `sanitizePath()` in sftp-utils.ts
4. **Credential encryption:** ENCRYPTION_KEY validation ensures encryption works

---

## Success Criteria

1. Clicking a connection card navigates to `/dashboard/connections/[id]`
2. Sync button appears and triggers `syncFromSftp`
3. Upload button appears and allows file uploads
4. Clicking folders navigates to `/dashboard/connections/[id]/[itemId]`
5. Breadcrumbs correctly link back within connection context
6. All E2E tests in `e2e/journeys/sftp/*.spec.ts` pass
7. `pnpm run check` passes with no errors
