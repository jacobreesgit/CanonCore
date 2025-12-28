- if you need to, use claude.md, and the mcp servers: sequential thinking, context7, neon, and shadcn to ensure best pratice. also if you like, use the front-end design skill but match the current design system, or the superpower skills. if doing tests, be clever and see if you can add/remove/edit any existing, if not make new ones and at the end of it, confirm you've done everthing.

- dont code, scope, and dont make a document. research best practices by using mcp servers: sequential thinking, context7; ESPECIALLY use apple-docs-mcp for any help with developixng

- if you need to, use claude.md, and the mcp servers: sequential thinking, context7, to ensure best pratice. use the front-end design skill and/or the superpower skills. always use XcodeBuildMCP for building/xcode operations and apple-docs-mcp for any help with developing. if doing tests, be clever and see if you can add/remove/edit any existing, if not make new ones and at the end of it, confirm you've done everthing. make sure to use apple-docs-mcp to research everything before doing any coding

- dont code, scope, and dont make a document.

- dont code, scope. write a prompt for claude code to complete using /Users/jacobrees/canoncore/docs/PROMPT-ENGINEERING.md. add to docs/prompts

- use git difference of current commmit to update claude.md and architecture.md got updated, update it with new changes since. only update claude.md but only with thats necccesary as claude.md is for claude code's own use for develpoment. im cutious of the 40k claude.md limit so don't overdo it. actually do it. look at all git history. take your time sequential thinking.

- scan across ALL e2e files for any anti patterns and bad playwright cases; and scan for any cases for more ~/nextjs-boilerplate/tests/helpers/e2e-helpers.ts.

- for each failing test run independantly that specific test. if they pass succesfully, mark as flaky and move on, if not
- and for ones that fail
- fix. look at images vs. errors.
- also if you like, use the superpower skills and ensure no anti patterns and bad playwright cases; and use all e2e helpers you can think of, or make new ones

Key Patterns:

- UniverseTree owns ALL item CRUD operations (no duplication)
- Parent can trigger tree's create dialog via triggerCreate prop
- NEVER use router.refresh() in client components - use explicit refetch
- After Server Action mutations: call refetchItems() to update UI
- Universe description: optional field, validated client AND server
- Progress refetch: after item status changes, refetch progress data
- URL-driven state: Active sheet derived from params.sheetId (no redundant state)
- Sheet navigation: router.push() updates URL, triggers re-render automatically

```

```
