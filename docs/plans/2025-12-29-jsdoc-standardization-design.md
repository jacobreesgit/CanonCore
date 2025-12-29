# JSDoc Standardization Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add JSDoc documentation to all custom code exports while keeping current project structure.

**Architecture:** Documentation-only changes - no restructuring, no new files.

**Scope:** 21 files (excluding `components/ui/*` shadcn components)

---

## Decisions Log

| Decision     | Choice              | Rationale                                                              |
| ------------ | ------------------- | ---------------------------------------------------------------------- |
| Approach     | Documentation focus | Add JSDoc without disrupting working codebase                          |
| JSDoc style  | Standard            | `@description`, `@param`, `@returns`, `@example` for complex functions |
| File headers | Descriptive         | Brief description of file purpose, no metadata                         |
| Scope        | Custom code only    | Skip `components/ui/*` (generated/third-party)                         |

---

## Files to Document (21 total)

### lib/ (5 files)

- `auth.ts` - NextAuth configuration
- `auth-actions.ts` - Server actions for auth flows
- `email.ts` - Resend email helper
- `prisma.ts` - Prisma client singleton
- `utils.ts` - Utility functions (cn)

### components/ excluding ui/ (8 files)

- `app-sidebar.tsx` - Main navigation sidebar
- `nav-documents.tsx` - Document navigation
- `nav-main.tsx` - Main navigation items
- `nav-secondary.tsx` - Secondary navigation
- `nav-user.tsx` - User dropdown menu
- `section-cards.tsx` - Dashboard metric cards
- `site-header.tsx` - Top header bar

### app/ pages (7 files)

- `page.tsx` - Landing page
- `layout.tsx` - Root layout
- `(auth)/sign-in/page.tsx`
- `(auth)/sign-up/page.tsx`
- `(auth)/forgot-password/page.tsx`
- `(auth)/reset-password/page.tsx`
- `(dashboard)/dashboard/page.tsx`
- `(dashboard)/layout.tsx`

### hooks/ (1 file)

- `use-mobile.ts` - Mobile breakpoint hook

### Excluded

- `components/ui/*` (11 shadcn files)
- `app/api/*` (auto-generated route)

---

## JSDoc Standards

### File Header Format

```typescript
/**
 * Brief description of file purpose.
 * Optional second line for additional context.
 */
```

### Function Documentation Format

```typescript
/**
 * Brief description of what the function does.
 *
 * @param paramName - Description of parameter
 * @returns Description of return value
 *
 * @example
 * const result = await functionName("input");
 */
```

### When to include `@example`

- Functions with non-obvious usage
- Functions with multiple return types (success/error)
- Public APIs that other developers will call

### When to skip `@example`

- Simple one-liner utilities
- React components (props are self-documenting)
- Internal/private helpers

### Component Documentation Format

```typescript
/**
 * Brief description of component purpose.
 * Describes what it renders and key behavior.
 */
export function ComponentName({ prop1, prop2 }: Props) {
```

### Props

Document inline with TypeScript types, not JSDoc (cleaner for React).

---

## CLAUDE.md Addition

Add to CLAUDE.md under a new "## Code Documentation Standards" section:

```markdown
## Code Documentation Standards

### File Headers

Every custom file (not `components/ui/*`) should start with a JSDoc header:

\`\`\`typescript
/\*\*

- Brief description of file purpose.
  \*/
  \`\`\`

### Function Documentation

Use JSDoc for exported functions in `lib/`:

\`\`\`typescript
/\*\*

- Brief description of what the function does.
-
- @param paramName - Description of parameter
- @returns Description of return value
-
- @example
- const result = await functionName("input");
  \*/
  \`\`\`

Include `@example` for:

- Functions with non-obvious usage
- Functions with success/error return types
- Public APIs

### Component Documentation

React components get a brief header describing purpose:

\`\`\`typescript
/\*\*

- Renders the user dropdown menu in the sidebar.
- Handles sign-out and navigation to account settings.
  \*/
  export function NavUser({ user }: Props) {
  \`\`\`

### What NOT to document

- `components/ui/*` (shadcn/ui generated)
- Simple type definitions
- Re-exports
```

---

## Implementation Order

1. **lib/ files** (5 files) - Core logic, most important
2. **hooks/** (1 file) - Quick win
3. **components/** (8 files) - App-specific components
4. **app/ pages** (7 files) - Page components
5. **CLAUDE.md** - Add Documentation Standards section
6. **Validation** - Run `pnpm run check` and tests

---

## Validation Checklist

- [ ] All 21 files have file headers
- [ ] All exported functions in lib/ have JSDoc
- [ ] Complex functions have `@example`
- [ ] CLAUDE.md updated with standards
- [ ] `pnpm run check` passes
- [ ] All tests pass
