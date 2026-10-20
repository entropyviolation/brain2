# `components/Home/dash/` — Dash style of the Visual dashboard

_Last mapped: 2026-10-20_

Dash is the second style of the Visual dashboard (the Home widget row). Milled,
today's satin handhelds, stays as the other style and is untouched by this
folder. The look and its rules are in
[`docs/DESIGN_STYLE.md` → Dash](../../../docs/DESIGN_STYLE.md#dash). The plan
is the Visual dashboard redesign doc (`docs/WIDGETS_REDESIGN.md` once committed).

## Files

| File | Purpose |
|------|---------|
| `dash-primitives.tsx` | The parts, with no data: `SegDigits` (seven-segment digits with unlit ghost segments, `:`, `.`, `/`), `DashReading` (digits as segments, units as small printed legends), `ArcGauge` (arc of separate blocks, `marker` lights one block for a position), `BarMeter`, `StairMeter` (Prius fuel stair), `DashSelector` (P R N D column, live choice boxed), `DashLamp`, `DashWord` (DotGothic16 LCD words), `DashPicto` (16px line pictograms), `DashPet`, `DashMoon`, `DashTrace`. |
| `dash-faces.tsx` | One face per kind, exported as `DASH_FACES` and registered with `registerDashFaces` (`components/Home/widgets/dash-face-registry.ts`) when the module loads; `app/layout.tsx` imports it for that side effect. Sizes come from `lib/widgets/kinds.ts`. A face reads the same stores and lib helpers as the Milled tile, so both styles show the same number. A face has no keys and opens nothing; the cell around it is the button and the detail is the tile's own dialog. |
| `dash.css` | Every rule is scoped to `[data-style="dash"]` (the dashboard root and the detail dialog) or `.dash-sample` (gallery samples). Panel, pods, faces, edit mode, detail popup, gear, settings view, first-run guide. Imported in `app/layout.tsx` after `../visual-dashboard.css`. Scoped rules use `:is(body, body.win95-app .home95)` so they out-rank the Milled skin without `!important`. The detail hood is set through `--fascia-dialog-face` and `--fascia-dialog-ring`, the tokens the house dialog rule in `app/win95.css` paints from. |
| `../visual-dashboard.css` | The new chrome in Milled: `.vd-cell.is-auto` is `display: contents` (today's footprint), a picked size makes the tile fill its cell (one-row sizes drop the foot), the edit banner, grip, resize corner, drop marks, the gear as a close-key twin, the settings panel, lamp chips, and the guide. |
| `dash-faces.test.tsx` | Every kind renders every size `kinds.ts` lists, with no keys and no foot at `1x1`. Each setting changes the rendered face. |

To look at the faces without the app, render them with Testing Library into a page that inlines `dash.css` (and `visual-dashboard.css`, `home-chrome.css`, `home-widget-face.css`, `app/win95.css` for the whole dashboard) and screenshot it with Playwright using `executablePath: "/opt/pw-browsers/chromium"`. Server rendering shows only store defaults (zustand's server snapshot), so use a client render.

## Contract with the dashboard

The backend side (copies, edit mode, gear, gallery logic) owns
`components/Home/widgets/` and `lib/widgets/`. The DOM it hands this folder is
written down in the project file `visual-dashboard/dom-contract.md`. In short:

- `.home-overview[data-style][data-editing]` holds `.vd-cell[data-kind][data-size][data-lamp][data-foot]`.
- On Dash the cell renders `DASH_FACES[kind]` inside a button. Props:
  `{ size, currentDate, settings, copy }`, with `copy = { id, kind, key?, title, lamp, showFoot }`.
- The detail dialog carries `data-style`, the gear is `.vd-gear`, and the
  views are `.home-widget-detail[data-view="detail"|"settings"|"guide"]`.

## Copy settings each face reads

Copy level, every kind: `title` replaces the legend, `lamp`
(`phosphor|blue|violet|white`) tints the whole face, `showFoot` hides the foot
line. Saved `amber` reads as violet.

| Kind | Settings | What changes |
|------|----------|--------------|
| `progress` (Today's Progress) | `periods` today, week, all | Today alone splits into To do and Habits bars; week and all add W and M bars. `1x1` is today's percent. |
| `review` (Rituals) | — | Count due; `keys` has no Dash effect (faces have no keys). |
| `points` | `period` day, week, month, all; `chart`; `keys` | Period picks the total and the boxed D W M A; `chart` draws the trace at `2x2` / `3x1`; `keys` shows the D W M A column. |
| `award` (Latest award) | — | Latest positive row, reason on the foot. |
| `pet` (Screen pet) | `caption` clock, name, mood; `name` | The readout beside the pet: clock, its name, or its mood. |
| `moon` | `readout` phase, countdown, light; `sprite` | Phase name, days to the next full or new, or percent lit; `sprite` shows the disk. |
| `daysuntil` (Countdown) | `markId` | Picks the mark. The face comes from `countdownFace` (`lib/countdown.ts`), so the mark's `format` (unit, decimal, days, weeks, sleeps, workdays), `repeat`, `start`, `milestones`, and `whenPassed` all show: whole units get a printed unit, a start date draws a span bar, a milestone glows. |
| `vocab` (Language study) | `copy.key` language, `role`, `cefr`, `face` word or level | Word face: today's word, reading, definition. Level face: CEFR (studied) or word level (native) with a known-word stair. |
| `affirmation` | `pips` | Lamps for each of today's lines said. `keys` has no Dash effect. |
| `weather` | `place`, `units` f or c, `foot` glance, range, rain | City, °F or °C, and the foot line. `2x2` is a low-to-high arc. |
| `next` | `sources` both, events, todos | What is picked; the legend names it. |
| `daylamp` (Day lamp) | `bars` both, habits, todos | Which completion bars set the word and the four-bar meter. |
| `harvest` (Harvest leftover) | `readout` points, percent | Points left or percent unpaid. |
| `inbox` (Inbox mill) | `foot` newest, oldest | Which title the foot shows. |
| `night` (Night well) | `format` hm, decimal | `7h 40m` or `7.7h`. |
| `flow` (Already flowing) | `readout` word, counts | The boxed word among Quiet Flowing Mixed Pushed, or `already-new`. |
| `paint` (Plan and lived) | `readout` word, plan, lived | The boxed Short Close Over, or minutes. |
| `tracking` (Tracking now) | `lane` activity, location, mood, company | The lane on the glass; the others on the foot. `update` has no Dash effect. |
| `solar` (Solar remainder) | `place`, `target` auto, sunset, sunrise | Time to the chosen event; `2x1` adds a sunrise-to-sunset arc with the sun's block lit. |

**Planned:** Widget gallery page visuals (samples at each size in a
`.dash-sample` strip) once the gallery's class names are in the contract file.
