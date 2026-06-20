# `app/` — Next.js App Router entry

The Next.js App Router root. The whole UI is client-side and exported statically
(`output: "export"`), so these files mostly set up the shell and mount the single
page.

## Files

| File | Purpose |
|------|---------|
| `layout.tsx` | Root HTML layout. Loads the Karla Google font, imports `globals.css` and **`win95.css`**, sets metadata (title "COGS Task Management"), and applies `win95-app` on `<body>` for the retro skin. Server component (no `"use client"`). |
| `page.tsx` | The single application page. Renders the global header and top-level tab bar, lazy-loading each module panel. When a task is selected (from Lists), swaps to the full-screen `EnhancedTaskDetail` view. |
| `globals.css` | Tailwind base/components/utilities + CSS variables for theme colors/radii and custom utility classes. Imported first by `layout.tsx`. |
| `win95.css` | Global Windows 95 skin layered on Tailwind/shadcn. Bevels, retro tabs, scrollbars, and pixel font (`w95fa`) scoped under `body.win95-app`. Additive rules use `:where(...)` so module-specific chrome (e.g. Lists `.fm98`) wins. |
| `loading.tsx` | Next.js route-level loading boundary for the root route. Renders `null` — the app mounts quickly and uses per-panel Suspense fallbacks instead. |

## Shell layout (`page.tsx`)

**Global header** (visible on every tab):

| Control | Component | Purpose |
|---------|-----------|---------|
| Review | `Reviews/reviews.tsx` | End-of-period review ritual (day/week/month/quarter/year) |
| Tracking | `cognitive-state.tsx` | Opens TimeGrid dialog |
| Inbox | `inbox.tsx` | Inbox dialog + clarification flow |
| Bulk Add | `enhanced-bulk-add.tsx` | Multi-line capture |
| Quick Add | `quick-add.tsx` | Single-field capture |

**Top-level tabs** (5 columns, lazy-loaded):

| Tab | Panel | Folder |
|-----|-------|--------|
| Home | `HomeDashboard` | `components/Home/` |
| Lists | `EnhancedCategoryView` | `components/Lists/` |
| Scheduler | `EnhancedScheduler` | `components/Scheduler/` |
| Modules | `ModulesPanel` | `components/Modules/` |
| Analytics | `EnhancedAnalytics` | `components/Analytics/` |

Task detail: selecting a task from Lists sets `selectedTaskId` and replaces the
main view with `EnhancedTaskDetail` until the user navigates back.

## Spec

Implements the application shell that hosts every module (§2.2, §8 Home Dashboard
top bar). There are no API routes or server components — consistent with the local-first,
client-only architecture today. A future **MongoDB** connection (via Electron IPC)
will provide durable storage, text/vector search indexes, and aggregation-based
routing without changing this shell layout.

See also `components/README.md` for module-level UI documentation and `lib/README.md`
for the stores the page's children read/write.
