# `hooks/` — Shared React hooks

App-wide reusable hooks. These are the canonical copies the application imports
(the `components/ui/` folder also contains shadcn-bundled duplicates).

**Module-specific hooks** live next to their UI instead of here — e.g.
`components/Lists/hooks/` (`useListsNavigation`, `useListsSearch`,
`useListsDragDrop`, `useListsSelection`, `useListsTaskActions`).

## Files

| File | Purpose |
|------|---------|
| `use-toast.ts` | Toast state management hook (shadcn/Radix toast queue): `useToast()` + `toast()` to enqueue/update/dismiss notifications. |
| `use-mobile.tsx` | `useIsMobile()` — returns whether the viewport is below the mobile breakpoint, via a `matchMedia` listener. Used for responsive layout switches. |
