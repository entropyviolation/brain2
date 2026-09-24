# `components/UiNames/` — Overlay modes (`data-ui-mode`)

Thin overlay kernel. **Names** is the first `data-ui-mode`: outline every
`[data-ui-name]` seam and float a cabinet nameplate on hover. Clicks are not
walled — Tracking paint, drag, and Willpower physics keep working. The host
lives in `app/layout.tsx` next to `CompletionPopupHost` so Names survives
task-detail (the header unmounts there).

The nameplate does **not** render inside the layout host’s tree. On hover it
**portals to `document.body`** in `.ui-names-layer` (`z-index: 310` in CSS and
inline, `pointer-events: none`). That sits above Radix Dialog overlay/content (`z-50`),
Sheet fullscreen (`z-45`), Just Start (`z-[100]`), and From Notes
(`z-[200]`). Document `pointerover` already sees portaled dialog nodes; the
bug was the plate painting *under* the dim overlay. The layer is not a pointer
wall.

A matching `.ui-name-outline` box (from `getBoundingClientRect`) paints in the
same layer so overflow-clipped dialog outlines still read. CSS
`html[data-ui-mode="names"] [data-ui-name]` outlines remain for in-flow desks.

Help / Inspect would reuse this store, this host, and the same `data-ui-*`
attributes. They must **point at living markdown** (colocated READMEs, `docs/`,
screenshot sidecars) — never a parallel blurb table. The in-app **Docs** tab is
user notes and is the wrong door.

## Attribute contract

Stamp these on an existing outer root (the element that already has
`data-testid` / `data-control-panel` / a stable class). Do not wrap paint cells,
LEDs, or Recharts series. For popups, stamp **`DialogContent`** (or the overlay
root), not every field.

| Attribute | Role |
|-----------|------|
| `data-ui-name` | Human noun on the nameplate |
| `data-ui-help` | Optional one-liner under the name on the nameplate. Do not put essays here. Plan inner desks (Month Plan, calendars, Planned tasks) use this so hover is not only the outer **Plan** window. |
| `data-ui-docs` | Repo-relative path to the README that `update-docs-after-each-step` already keeps current |
| `data-ui-docs-anchor` | Optional existing `##` heading slug. Do not invent headings for this. |

New major panel **or popup**: add these attrs in the **same step** as the README update.
Deepest `[data-ui-name]` wins (`Element.closest`), so stamp inner roots (Month Plan composer, Month calendar, Planned tasks) inside a named window. Hovering the **Month Plan — September 2026** cabinet must read **Month Plan**, not **Plan**.

## Files

| File | Purpose |
|------|---------|
| `UiNamesHost.tsx` | Document listeners + `createPortal(..., document.body)` nameplate/outline. Layer `z-index: 310` is set in CSS and inline so HMR/stale CSS cannot drop it under dialogs. Stamps `data-ui-mode` on `<html>` (absent when off). Names click `console.info`s name + docs path + anchor. `handleNamedActivate` is the Help/Inspect extension point. |
| `ui-names.css` | Outlines keyed off `html[data-ui-mode="names"]` with `!important` so Radix tablists (`style="outline: none"`) still paint; `.ui-names-layer` at z-index 310. Later `inspect` can share this file. |
| `UiNamesHost.test.tsx` | Mode flag, nameplate + help line, deepest-ancestor (Plan → Month Plan → Plan log), click log without `preventDefault`, portaled overlay hit + body layer z-index. |
| `ui-names-stamps.test.ts` | Desk roots and popup/modal roots carry `data-ui-name` + `data-ui-docs`. |

Store: `lib/ui-names-store.ts` (`{ mode: "off" \| "names" }`, `setMode`, `toggle("names")`, persist `brain2-ui-names`). Included in the Settings full backup.

Header **Names** sits in the System group after Settings and Tracking so a later Help / Inspect key can sit beside it. The caption stays **Names**; it latches sunken (`aria-pressed`) while on, and the tooltip reads **Stop naming**. Mobile chrome is skipped in v1.

This is not Lists `fm-inspector`.
