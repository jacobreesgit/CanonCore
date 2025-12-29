# Deployment Summary: Stack Auth Integration

**Branch:** `development`
**Date:** 2025-12-28

## What's changing

This deployment adds complete authentication to CanonCore using Stack Auth with custom UI.

### New routes

| Route              | Purpose                                                         |
| ------------------ | --------------------------------------------------------------- |
| `/`                | Public landing page with sign-up/sign-in CTAs                   |
| `/sign-in`         | Email/password sign in                                          |
| `/sign-up`         | Account creation with password confirmation                     |
| `/forgot-password` | Request password reset email                                    |
| `/reset-password`  | Set new password from email link                                |
| `/dashboard`       | Protected dashboard (redirects to sign-in if not authenticated) |

### Route protection

The dashboard route group uses server-side auth checking:

```typescript
await stackServerApp.getUser({ or: "redirect" });
```

This redirects unauthenticated people to `/sign-in` before rendering the page.

### Environment variables required

Before deploying, set these in your Vercel project:

- `DATABASE_URL` - Neon PostgreSQL connection string
- `NEXT_PUBLIC_STACK_PROJECT_ID` - From Stack Auth dashboard
- `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY` - From Stack Auth dashboard
- `STACK_SECRET_SERVER_KEY` - From Stack Auth dashboard

### UI changes

Auth pages follow the shadcnblocks signup10 design pattern:

- Rounded-full inputs and buttons
- Side image panel on desktop
- Muted background inputs
- Consistent "C" logo branding

The landing page uses the hero8 pattern with sign-up/sign-in buttons.

### Dependencies added

- `@stackframe/stack` - Authentication
- `server-only` - Server component protection
- `@prisma/client` and `prisma` - Database (configured but not yet used)

## Pre-deployment checklist

1. Set all environment variables in Vercel
2. Configure Stack Auth project settings:
   - Enable email/password authentication
   - Set redirect URLs to match your domain
3. Run `pnpm run check` locally to verify build passes

## Post-deployment verification

1. Visit `/` - Landing page loads
2. Click **Get started now** - Redirects to `/sign-up`
3. Create an account - Redirects to `/dashboard`
4. Click user menu → **Log out** - Returns to `/`
5. Visit `/dashboard` directly while logged out - Redirects to `/sign-in`
