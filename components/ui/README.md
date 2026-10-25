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
| `clock-picker/` | Shared clock (`ClockPicker`). Cream field you can type (`1pm` → `13:00` on blur or Enter). Clock mark opens the panel. CRT hour / minute / AM–PM drums, Now inside the popup (writes at once), Confirm writes a drum time, Cancel / Escape / click-outside leave the field. Cream ceramic face with ornate silver hands. Ceramic is the default dial; other paintings switch, shuffle, and hide for this browser. The popup keeps its own clicks inside a dialog. An armed hour or minute holds page scroll. Not the platform time popup. |
| `card.tsx` | Card, CardHeader, CardTitle, CardContent |
| `checkbox.tsx` | Checkboxes |
| `collapsible.tsx` | Expand/collapse sections (Scheduler filters) |
| `dialog.tsx` | Modal dialogs. The default close is `KeycapClose` (grey keycap ×, brick on hover). `hideClose` drops it when a window draws its own caption ×. `overlayClassName` lifts the scrim; `container` portals a dialog inside one already open so it is not marked hidden |
| `window-sand-close.tsx` | Opt-in close: `useWindowSandClose` + `WindowSandClose`. From the ×, the window becomes tiny lit grains (~1px), which tumble with their own little depth, bounce, and heap into a dune in the colors of its pixels. The frame becomes sand too. A click on the background, Escape, or the skip × closes immediately; left alone, the wind comes on its own (~4.8s). A second `start()` while it plays does not restart the pour. Any captioned window can use it. Reduced motion snaps shut. The live window stays hidden through close; the host kills the Radix zoom/fade. |
| `window-sand-sim.ts` | Grain bodies, not a powder grid. A ragged front releases them from the × (0.9s to the far corner). Each grain falls, bounces, and rolls into a steep dune (heightfield columns, a little depth toward the camera). Nothing stays solid as a frame. After the dune rests (~3.1s) wind lifts the windward crest and carries the pile off to the right. |
| `window-sand-capture.ts` | Synchronous clone of the live window, decoded through an SVG `foreignObject` data URL into `ImageData`. Grains are recolored from their home pixel when it arrives, including ones that have already let go. A blob URL is not used — it taints the canvas and the sand would stay flat navy and gray. |
| `window-sand-close.css` | `.window-sand-source` hides the live window while the canvas plays. `.window-sand-host[data-state=closed]` is opacity 0, visibility hidden, animation none. `.window-sand-skip` is the small × (top right) that closes immediately. Imported from the root layout so the skip control stays clickable. |
| `unsaved-changes-guard.tsx` | House dirty-close confirm: Save changes / Cancel / Exit without saving. Milled fascia look via `unsaved-changes.css`. Pair with `lib/unsaved-changes.ts`. |
| `unsaved-changes.css` | `.w95-confirm` milled fascia confirm (~24.5rem): CRT title, brushed bay, three keycaps centered in the bay |
| `menu-layer.ts` | Shared menu layer. Select and dropdown lists portal to `document.body` on this z-index so a sheet, frozen header, bar, or dialog cannot cover them |
| `dropdown-menu.tsx` | Menus (Reviews header, etc.). Same menu layer as select |
| `input.tsx` | Text and number inputs |
| `address-suggest-input.tsx` | _Last mapped: 2026-10-16._ `AddressSuggestInput`: an isolated text field (local text, `onLive` per key, commit on blur / Enter) with live map search. 3+ characters, 300ms, `searchAddresses` (`lib/geo-address.ts`); ↑ ↓ Enter Esc; a pick fills parts (`withParts`) and goes to `onPick`, which returns the text to show. Used by the person Address field. Styles in `address-suggest-input.css`. |
| `label.tsx` | Form labels |
| `progress.tsx` | Progress bars (supports `indicatorClassName`) |
| `select.tsx` | Select dropdowns. The list portals to `document.body` on the shared menu layer |
| `native-select.tsx` | _Last mapped: 2026-10-16._ `NativeSelect`: drop-in for `<select>` + `<option>` children. The list is `select.tsx` content, so it matches the app, not the OS popup. The trigger is the bare Radix trigger (not `SelectTrigger`, so no shadcn field classes) with class `native-select`; base layout is in `native-select.css`. House CSS that styles `select` has a `.native-select` twin on each selector (24 stylesheets, `app/win95.css` included), so new `select` rules need the twin too. `onChange` gets `{ target: { value } }` (no real event, so no `stopPropagation`). `""` values are encoded. `<optgroup label>` becomes a labelled group. Each item carries `data-value`. Clicks, pointer and key events inside the portaled list stop there, so a clickable row or dialog behind it does not react (a native popup does not either). Props: `value`, `defaultValue`, `onChange`, `onClick`, `className`, `style`, `id`, `name`, `title`, `disabled`, `aria-label`, `aria-labelledby`, `data-testid`. No `ref`, `multiple`, `size`, `autoFocus` or `onBlur`. Every JSX select in `components/` uses it now. Still native: `components/spreadsheet/SheetGrid.tsx` (~1620, the in-cell editor needs `autoFocus` and `onBlur` to cancel; opening the list would blur it), and the HTML string in `components/Modules/workspace/gradsearch/shell.ts` (not React). Tests: `pickOption(trigger, value)` in `tests/native-select.ts` opens the list and clicks the option by value or label; check the shown choice with `toHaveTextContent`, not `toHaveValue`. Options are only in the DOM while the list is open (jsdom shims in `vitest.setup.ts`). Short enums only. A list or item from the vault uses `ListPicker` / `ItemPicker` (`components/Lists/list-picker.tsx`, `item-picker.tsx`) — see `docs/DESIGN_STYLE.md` “Choosing a list or an item”. |
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
  shadcn. Gold standard: [`docs/DESIGN_STYLE.md`](../../docs/DESIGN_STYLE.md).
  [The screen stays pleasing](../../docs/DESIGN_STYLE.md#the-screen-stays-pleasing)
  overrides a local packing note.

## Usage pattern

```tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
```

All modules (Home, Lists, Scheduler, Analytics, etc.) import from this folder.
