# `components/ui/` — shadcn/ui primitives

Vendored [shadcn/ui](https://ui.shadcn.com/) components: thin styled wrappers around Radix UI primitives, configured via `components.json` at the repo root.

> These are application building blocks. Prefer composing them in module folders over editing them directly. If behavior must change, consider a wrapper in the consuming module first.

## Currently in tree

Only the primitives actively imported by the app are kept. As of the current codebase:

| File | Role |
|------|------|
| `alert.tsx` | Alert messages |
| `badge.tsx` | Status badges, counts |
| `button.tsx` | Buttons (variants: default, outline, ghost, destructive, …) |
| `color-swatch.tsx` | Win95 beveled `<input type="color">` so the chip fills the control (Tracking new-pen, tags, pen settings) |
| `card.tsx` | Card, CardHeader, CardTitle, CardContent |
| `checkbox.tsx` | Checkboxes |
| `collapsible.tsx` | Expand/collapse sections (Scheduler filters) |
| `dialog.tsx` | Modal dialogs (`hideClose` drops the Lucide X when a window has its own caption ×; `overlayClassName` lifts the scrim; `container` portals a dialog inside one already open so it is not marked hidden) |
| `window-sand-close.tsx` | Opt-in close: `useWindowSandClose` + `WindowSandClose`. From the ×, the window becomes tiny lit grains (~2px), which tumble with their own little depth, bounce, and heap into a dune in the colors of its pixels. The frame becomes sand too. The dune rests; a click blows it off in the wind, or the wind comes on its own (~4.8s). Escape and the skip × close immediately. A second `start()` while it plays does not restart the pour. Any captioned window can use it. Reduced motion snaps shut. The live window stays hidden through close; the host kills the Radix zoom/fade. |
| `window-sand-sim.ts` | Grain bodies, not a powder grid. A ragged front releases them from the × (0.9s to the far corner). Each grain falls, bounces, and rolls into a steep dune (heightfield columns, a little depth toward the camera). Nothing stays solid as a frame. After the dune rests (~3.1s, or sooner on dismiss) wind lifts the windward crest and carries the pile off to the right. |
| `window-sand-capture.ts` | Synchronous clone of the live window, decoded through an SVG `foreignObject` data URL into `ImageData`. Grains are recolored from their home pixel when it arrives, including ones that have already let go. A blob URL is not used — it taints the canvas and the sand would stay flat navy and gray. |
| `window-sand-close.css` | `.window-sand-source` hides the live window while the canvas plays. `.window-sand-host[data-state=closed]` is opacity 0, visibility hidden, animation none. `.window-sand-skip` is the small × (top right) that closes immediately. Imported from the root layout so the skip control stays clickable. |
| `unsaved-changes-guard.tsx` | House dirty-close confirm: Save changes / Cancel / Exit without saving. Milled fascia look via `unsaved-changes.css`. Pair with `lib/unsaved-changes.ts`. |
| `unsaved-changes.css` | `.w95-confirm` milled fascia confirm (~24.5rem): CRT title, brushed bay, metal keys |
| `dropdown-menu.tsx` | Menus (Reviews header, etc.) |
| `input.tsx` | Text and number inputs |
| `label.tsx` | Form labels |
| `progress.tsx` | Progress bars (supports `indicatorClassName`) |
| `select.tsx` | Select dropdowns |
| `separator.tsx` | Visual dividers |
| `switch.tsx` | Toggle switches |
| `table.tsx` | Table layout (Lists details view) |
| `tabs.tsx` | Tab navigation |
| `textarea.tsx` | Multi-line text |
| `tooltip.tsx` | Hover tooltips |

## Removed (not present)

Many default shadcn components were deleted as unused, including: `accordion`, `alert-dialog`, `avatar`, `breadcrumb`, `calendar`, `carousel`, `chart`, `command`, `context-menu`, `drawer`, `form`, `hover-card`, `input-otp`, `menubar`, `navigation-menu`, `pagination`, `popover`, `radio-group`, `resizable`, `scroll-area`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `toast`, `toaster`, `toggle`, `toggle-group`, and associated hooks.

Charts in Analytics import **recharts** directly, not `ui/chart.tsx`.

## Styling

- Theme variables in `app/globals.css`
- Tailwind config at `tailwind.config.ts`
- Win98 Lists skin is separate: `components/Lists/filemanager98.css` (not part of `ui/`)
- Product look: skin primitives as a vintage instrument (quoted bevels are fine;
  glass and default shadcn are not). Do not restyle Brain2 around default
  shadcn. Gold standard: [`docs/DESIGN_STYLE.md`](../../docs/DESIGN_STYLE.md)

## Usage pattern

```tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
```

All modules (Home, Lists, Scheduler, Analytics, etc.) import from this folder.
