# Deployment 0.6.0: JSDoc Standardization and Frontend Design Skill

This release adds comprehensive JSDoc documentation to all custom code and introduces a frontend design skill.

## What changed

### JSDoc documentation added (21 files)

Every custom file now has file headers and function documentation following consistent standards.

**lib/ files (5):**

- `auth.ts` - NextAuth configuration with handlers export
- `auth-actions.ts` - Server actions with `@example` blocks for signUp, forgotPassword, resetPassword
- `email.ts` - Resend helper with usage example
- `prisma.ts` - Singleton pattern documentation
- `utils.ts` - cn() utility with param/returns

**components/ (7 files, excluding ui/):**

- `app-sidebar.tsx` - Main navigation sidebar
- `nav-documents.tsx` - Document navigation with action dropdowns
- `nav-main.tsx` - Primary navigation items
- `nav-secondary.tsx` - Utility navigation
- `nav-user.tsx` - User dropdown with sign-out
- `section-cards.tsx` - Dashboard metric cards
- `site-header.tsx` - Top header bar

**app/ pages (8 files):**

- `page.tsx` - Landing page
- `layout.tsx` - Root layout with SessionProvider
- `(auth)/sign-in/page.tsx` - Sign in form
- `(auth)/sign-up/page.tsx` - Registration form
- `(auth)/forgot-password/page.tsx` - Password reset request
- `(auth)/reset-password/page.tsx` - Set new password
- `(dashboard)/dashboard/page.tsx` - Main dashboard
- `(dashboard)/layout.tsx` - Protected dashboard layout

**hooks/ (1 file):**

- `use-mobile.ts` - Mobile breakpoint detection hook

### New skill: frontend-design

Added `skills/frontend-design/SKILL.md` for creating distinctive, production-grade frontend interfaces. Guides:

- Bold aesthetic direction choices
- Typography and font pairing
- Color and theme decisions
- Motion and animations
- Spatial composition and layout

### CLAUDE.md updated

Added "Documentation Standards" section with:

- File header format requirements
- Function JSDoc conventions
- When to include `@example` blocks
- Guidelines for React components vs utilities

### Other changes

- Added design plan: `docs/plans/2025-12-29-jsdoc-standardization-design.md`
- Updated `docs/help.md` with JSDoc references
- Removed `.DS_Store` from repository

## Documentation standards

All custom code follows these conventions:

```typescript
/**
 * File header describing purpose.
 */

/**
 * Function description.
 *
 * @param name - Parameter description
 * @returns What the function returns
 *
 * @example
 * const result = await functionName("input");
 */
```

**Include `@example` for:**

- Server actions with success/error returns
- Complex utilities
- Public APIs

**Skip `@example` for:**

- Simple one-liner utilities
- React components (props are self-documenting)

## Files affected

| Category   | Count | Files                                             |
| ---------- | ----- | ------------------------------------------------- |
| lib/       | 5     | auth, auth-actions, email, prisma, utils          |
| components | 7     | app-sidebar, nav-\*, section-cards, site-header   |
| app/       | 8     | page, layout, auth pages (4), dashboard pages (2) |
| hooks      | 1     | use-mobile                                        |
| skills     | 1     | frontend-design/SKILL.md                          |
| docs       | 2     | CLAUDE.md, help.md                                |
| **Total**  | 24    |                                                   |

## No breaking changes

Documentation-only additions. All existing functionality unchanged.
