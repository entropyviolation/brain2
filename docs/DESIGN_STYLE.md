# Brain2 design style — gold standard

This is the **visual and interface north star** for Brain2. Product features live
in the spec mapping; this file is about *how the app should look and feel*.

Brain2 is a **vintage machine that knows it is a painting**. It draws on
late-90s and Y2K tech the way an 8-bit game remembers a device you held:
phosphor, chunky silver, stylus glass, patch cables, pixel cursors, navy
captions, inset wells. It is not a Windows replica and it is not a costume of
the decade. The proof is motion and material a 1997 OS could not ship — a
window that melts or dissolves, cursors that flock into a figure, a trace that
grows into a snowflake — while the verbs stay plain and the packing stays
tight. It stays **alive** because mechanics (auto-organize, paint, installable
rooms, that one impossible gesture) actually move, and **infinite** because
new rooms can look unlike anything else in the house without leaving it.
Beauty is the machine itself, not a theme pack on a gray dialog.

Handling is part of the method. Painting the day, turning a bezel, confirming
an **est.** chip: the person sees which order they are on, and the reaction
waits. Copy does the same work. A sentence describes an event, a date, and a
count. “Pushed 9 times since Jul 3” is the voice. The build that spreads it is
[`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md).

**Three layers, every screen:**

| Layer | What it is | What it must feel like |
|-------|------------|------------------------|
| **Motif** | Bevels, navy captions, pixel type, phosphor, milled keys, stylus-era silver, CRT bezels | A quoted ancestor. Recognizable as vintage tech-in-a-game. One register among others, not the whole product. |
| **Cabinet** | Icons, orbs, gems, velvet, lace, living pictures, personal photographs | Small precious things. Shells, marbles, jade, opal, a kitten in a nest. Whimsy in the objects. |
| **Impossible** | One signature motion or material transformation on a real verb | Of course this could not have been made in the 90s. Rare, beautiful, tied to close / complete / organize / open. Not a looping sticker. |

**Home → Habits is the favorite interior** — the most developed instrument in
the house. Before changing Plan, To Do, Goals, Tracking, Lists interiors, or a
new room: open Habits Daily. Steal its *language* (Habits Tab Control Panel,
analog furniture, Willpower gems, CRT phosphor, skeuomorph from
[`designrefs/`](../designrefs/)) — not the CSS selectors, not a second `.hab95`
pasted everywhere. How to extend: [Look at Habits](#look-at-habits--how-to-extend).

**Lists Icons** is the favorite cabinet (velvet + orbs + auto-organize). The
**shell** (header, tabs, window frames) is in bounds for the same three
layers. A gray dialog that could only be Windows is the look to leave. Do not
smash Lists into a single pixel-game skin, and do not ignore Habits when
packing an interior.

> Brain2 looks like a beloved weird machine from a video game, opened to show
> a curiosity cabinet, and then — once — the whole window dissolves like it
> was never only plastic.
>
> Motif, cabinet, impossible. That is the whole aesthetic.

**Never SaaS the frame. Never plain the contents. Never costume the whole app as one still.**

Window furniture may be beautiful when the beauty is skeuomorphic, pixel,
engraved, or surreal: milled silver, a black-mirror well, TENO throws, a
circuit sigil, a melt. It is wrong when the beauty is a modern product
(glassmorphism, 24px radii, brand gradients, ghost-icon toolbars, illustrated
mascot empty states). **Object chrome** — a milled silver rim around a
black-mirror well, with a photograph sitting in that well — is the Willpower
gems language. Copy it onto other jewels and instruments. See
[Chrome and black mirror](#chrome-and-black-mirror).

The two picture-registers may meet. A photoreal window may dissolve into
pixels. Pixels may melt into a photograph. Uniform Win95 and uniform 8-bit
are both the wrong ending. Win95 bevels, the pixel UI font, and navy focus
stay in the house as **quoted ancestors** (`app/win95.css`), not as a law
that the frame must keep looking like Explorer.

---

## Chrome and black mirror

The Willpower gems plate is the reference object. Steal this, not a card kit:

- **Rim:** photoreal **silver chrome** — stacked silver / pewter rings, a
  specular highlight on the top arc, a raised outer bevel that presses in.
  Milled, not a 1px CSS outline on a gray pill.
- **Well:** **black lacquer / black mirror**. A dark radial glass, not empty
  gray and not a white card. The object reads as sitting *in* a cavity.
- **Object:** a photograph (crystal, gem, orb), not Lucide. Y-sort and physics
  treat it as a solid in the well.

Keep pushing this photoreal black-mirror + silver-chrome language. The
Willpower gems plate is the object to copy: chrome that looks machined,
lacquer that looks like a mirror, photograph seated in the well. Encourage
**more** of this wherever a precious object is the point: a jewel button, a
crystal well, a gauge face, a set stone. Do not flatten those into a plain
gray bevel. Do not invent a second language (neumorphism,
glassmorphism, soft drop-shadowed discs).

The tension stays: **vintage instrument, luminous object in a chrome well, and one motion the decade could not render.**

---

## Milled fascia

This is the **common shell** for anything that is a row of instruments: the
pinned header, the app tabs, the Home date plate, the Home overview tiles,
Home → To Do, Home → Goals, Operations, Settings dialogs, the Inbox dialog,
header pin-bar popups (Quick Add / Reviews / Metrics / …), Item detail, and the Week grade / Perfect output
detail sheets. New tabs, title plates, and overview modules should start here. Do
not invent a second flat gray bevel for the same job.

Live sources: `components/shell-chrome.css` (header bays), `app/win95.css`
(App tabs), `components/Home/home-chrome.css` (date plate + overview tiles),
`components/Home/ToDo/todo-chrome.css`, `components/Home/Goals/goals-chrome.css`,
`components/Home/Plan/plan-chrome.css`,
`components/Home/Tracking/tracking-chrome.css` (CRT title, view keys, period
nameplate, now bay, plot bezel — white plot + pen photographs untouched),
`components/Home/Habits/habit-chrome.css` (header, Daily/Weekly/Monthly keys,
Habits Tab Control Panel, `.hab-grade-sheet`),
`components/Operations/operations-chrome.css` (Operations board + workspace),
`components/Settings/settings-chrome.css` (Settings dialogs),
`components/inbox.css` (Inbox dialog `.inbox-dialog`),
`components/header-popup-chrome.css` (pin-bar capture / review / metrics dialogs `.hpp95`),
`components/ItemDetail/item-detail-chrome.css` (Item detail page + popup),
`components/Lists/filemanager98.css` (Lists Explorer frame — milled toolbars /
view keys / CRT title; velvet + orbs stay cabinet),
`components/Docs/docs.css` (Docs outer chrome — milled caption / menubar keys /
status counts; white paper untouched),
`components/Scheduler/scheduler-chrome.css` (CRT title, Funnel/Gantt/Dependencies
+ Always→Day equal keys with power lamps, Address nameplate — funnel contents untouched).

| Piece | What it is |
|-------|------------|
| **Bay** | Brushed mill (1px horizontal hairlines) on cool silver. Stacked ring: outer `#5c6064` stroke, white top lip, inset pewter, a soft inner shadow. Radius 2–3px. Not a flat `#c0c0c0` slab. |
| **Nameplate** | 9–12px, weight 700, tracking ~0.14em, uppercase, ink `#2a2c2e`, engraved highlight `0 1px 0 rgba(255,255,255,0.78)`. Sits on the rim or as its own chip. A **round power lamp** (radial phosphor, gunmetal ring) leads the label. Not a square pixel pip. |
| **CRT** | The value lives in black glass (`#040a08`–`#070c0a`) with a faint phosphor bloom at the top, a gunmetal outer ring, and an inner shadow. One green: `--hab-crt-green` (`#7dffc4`) and `--hab-crt-glow`. Pad the glyphs (about 8px 14px). Do not paint phosphor straight on the mill. |
| **Label** | Secondary copy is a padded silver chip (about 6px 9px), two lines at most, same engraved ink. Sibling labels share one height. |
| **Key** | Actions (Widgets, inactive app tabs) are raised metal keys: specular top lip, mill, pressed foot, tracking on the word. A row of sibling keys **shares the bay equally** — each key flexes, the label sits in the center, and the padding around the row is even. Active mode is the CRT, not a sunken gray folder tab. |

Padding is part of the material. A nameplate, a CRT, and a label each need air inside the bay so type does not touch the ring. Gaps between sibling bays stay near the header (about 8–14px), not a 1px crush and not a marketing card’s 24px.

**Globals carry the fascia for anything that has not skinned itself.**
`app/win95.css` `:root` exposes `--fascia-*` + `--hab-crt-green` / `--hab-crt-glow`, and the default dialog / menu / button / nested-tab rules use them so an unskinned shadcn sheet is already a brushed bay with metal keys (and a CRT-ish title when the global caption rule can apply). Module CSS imported after `win95.css` still wins; portaled private skins (`.set95`, `.inbox-dialog`, `.id95`, `.hab-grade-sheet`, `.hpp95`, `.ops95-dialog`, …) stay excluded from the global dialog face. App tabs keep their equal-fill CRT keys.

Reference captures: `docs/screenshots/01-home-daily-habits.png` (Habits Daily —
look here first), `docs/screenshots/05-lists.png` (folder Icons / velvet),
`05-lists-content-*` (list interiors, including the orb icon grid). Live
Habits: `components/Home/Habits/` + `habit-chrome.css`. Live Lists:
`components/Lists/` + `components/Lists/filemanager98.css`.

---

## Fascia rollout

Bring remaining instrument rows and window chrome onto the
[milled fascia](#milled-fascia) (brushed bays, engraved nameplates, metal keys,
CRT hero, round power lamp). Phosphor stays `#7dffc4` (`--hab-crt-green`).

**Looks only. Never change behavior.** Same verbs, filters, hotkeys, saves,
and data paths — only materials, bevels, and type style. Do not invent a
second flat gray bevel for a job the fascia already owns.

### Already on the fascia

| Surface | Where |
|---------|--------|
| Unskinned dialogs / menus / buttons / nested tabs (house default) | `app/win95.css` (`--fascia-*`, `--hab-crt-*`) |
| App tabs | `app/win95.css` |
| Pinned header bays | `components/shell-chrome.css` |
| Home date plate + overview tiles | `components/Home/home-chrome.css` |
| Home → Plan | `components/Home/Plan/plan-chrome.css` |
| Home → Tracking | `components/Home/Tracking/tracking-chrome.css` |
| Home → To Do | `components/Home/ToDo/todo-chrome.css` |
| Home → Goals | `components/Home/Goals/goals-chrome.css` |
| Operations | `components/Operations/operations-chrome.css` |
| Settings | `components/Settings/settings-chrome.css` (`.set95`) |
| Inbox dialog | `components/inbox.css` (`.inbox-dialog`) |
| Header pin-bar popups | `components/header-popup-chrome.css` (`.hpp95` — Quick Add, Bulk Add, Ingest, From Notes, Phone Notes, Metrics, Reviews / Morning / Affirmations / Post-mortem; Tracking compact dialog shell only) |
| Item detail | `components/ItemDetail/item-detail-chrome.css` (`.id95` / `.id95-dialog`) |
| Lists Explorer frame | `components/Lists/filemanager98.css` (`.fm98` — velvet/orbs untouched) |
| Docs outer chrome | `components/Docs/docs.css` (`.docs95` — CRT caption, metal menubar keys, CRT status counts; white paper / editor untouched) |
| Week grade / Perfect output sheets | `components/Home/Habits/habit-chrome.css` (`.hab-grade-sheet`) |
| Analytics chrome | `components/Analytics/analytics-chrome.css` (range + left index keys only; studio canvases stay light-instrument) |
| Scheduler | `components/Scheduler/scheduler-chrome.css` (`.sch95` — CRT title, view/period keys, Address nameplate; funnel/Gantt/graph contents untouched) |

### In progress (other agents — do not restyle here)

| Surface | Note |
|---------|------|
| Home → Habits | Interior + console; leave alone while in flight |

Do not specify or invent their next CSS in this section — when they land,
list them under **Already on the fascia** if they match the bay / nameplate /
CRT / key language.

### Still plain — survey (priority order)

One sentence each on what is still ugly. Ship in this order unless a room
must wait on Habits.

1. **Modules catalog / workspace chrome** — `components/Modules/modules-chrome.css`,
   `modules-panel.tsx`, `workspace/ModuleWorkspace.tsx`: raised flat gray desk
   head and legend chips; phosphor token is `#3dff8a` instead of `#7dffc4`
   (feral module interiors stay feral — chrome only).
2. **Completion popup** — `components/Completion/CompletionDialog.tsx`,
   `CompletionPopupHost.tsx`: Lucide + `rounded-full` objective chips and
   muted card wells inside a soft dialog — not metal keys or CRT readouts.
3. **Search palette** — `components/Search/GlobalSearch.tsx`: modern command
   palette (`rounded-md` rows, `bg-accent` hover, primary/10 kind pills) with
   no Win95 caption or milled result well.
4. **Bare `components/ui/dialog.tsx` sheets** outside the pin bar — house
   defaults in `app/win95.css` may still read flatter than `.hpp95` /
   `.set95` / `.inbox-dialog` when a module opens an unskinned dialog.

Friend instrument (`components/friend-details/friend-details.css`) and Home
Needs Attention (`home-chrome.css` / `NeedsAttention.tsx`) are already on a
machine / mill language — leave them out of this queue unless a regression
appears.

---

## Look at Habits — how to extend

This is the operational example. Lists still owns the file-manager *frame*.
Habits owns how far a *room* may go.

Open Home → **Habits** Daily and stay there until the new surface can sit
beside it without looking like a different product. Copy these beats:

| Beat | What to take | Where it lives |
|------|----------------|----------------|
| **Habits Tab Control Panel** | Related gauges, sort, rockers, and Willpower gems share one beveled column beside the document — not a toolbar of Lucide and not a second island below. Compact 196px; Physics enlarges the plate, not a seam. | `habits-control-panel.tsx`, `.hab-desk` (`1fr + auto`) |
| **Analog furniture** | Cockpit rockers, metal sort plate, recessed panel lamps, 10-pip loading channel, noble-gas finger-tubes. Nested bevels, 4–8px pack | `cockpit-switch.tsx`, `habit-sort-control.tsx`, `habit-led-lamp.tsx`, `percent-led-bar.tsx`, `noble-gas-tube.tsx` |
| **Willpower gems** | Small photographed central willpower crystal in a photoreal **chrome + black-mirror** oval well; **one habit gem per weekday completion**; invert while any hit this week; plate-click bouncing-ball physics (grab does not stir; stir is a short whirl); crystal is a solid (no tunneling) and a PNG occluder; Settings-only photograph; Physics popup lab (mapped twin plate, live knobs, CRT wells) | [Willpower gems](#willpower-gems--example-of-perfect-design) |
| **Chrome + black mirror** | Milled silver rim, concentric chrome rings, black-lacquer well, photographed object seated in the well. Repeat this for jewels, crystals, gauges — not a PNG dropped on gray. The object gets the realistic chrome; the frame may share that silver when it is being a machine. | [Chrome and black mirror](#chrome-and-black-mirror) |
| **CRT phosphor** | One green (`--hab-crt-green: #7dffc4`), slight glow, readable. Overlay off by default. Never a chart that fakes precision | `habit-chrome.css`, Home overview wells |
| **Skeuomorph from designrefs** | Materials, lamps, CRTs, metal, weather instruments, equal-height modules — steal language, show a photo when it is an object | [`DESIGN_REFS.md`](DESIGN_REFS.md) |

Do not extract Habits chrome into `components/ui/` “for consistency.” Other
Home tabs share the TOP strip; they do not clone `.hab95`. File packing stays
with each room’s README.

---

## The three layers

Treat every screen as **motif**, **cabinet**, and **impossible**. The table
at the top of this file is the law. Frame and cabinet still both have to
show up: a screen of only gray bevels feels like an admin tool, and a screen
of only pretty objects feels like a lifestyle app.

If a change makes the window look like a modern SaaS product (soft shadows,
huge radii, gradient glass, “delightful” empty states with illustrated
mascots), it is wrong. If a change makes the objects look like generic Lucide
glyphs on a white canvas, it is also wrong. If a change freezes the frame as
a literal Windows 95 dialog — gray for its own sake, forbidden to melt, forbidden
to speak pixel or silver — it is wrong too. The ancestor is a quote. The
machine is allowed to be beautiful.

Fine grooves, pinstripes, engraved rules, hatch, and inset hairlines on the
gray furniture are **wanted**. They add texture, depth, and beauty. Do not sand
them off as clutter. That is detail *on* the furniture — analog/skeuomorphic
controls (rocker switches, guarded buttons, jewel lamps) are encouraged on
Habits / Home interiors — not glassmorphism and not “prettying the chrome.”

---

## Gold-standard surfaces

Habits Daily is the instrument. Lists Icons is the cabinet. New work should
sit beside both without looking like a SaaS product or like a different game.
Interiors: [Look at Habits](#look-at-habits--how-to-extend). The shell may
leave pure gray Windows; it may not leave the three layers.

### 1. File-manager motif (a quoted ancestor, not the costume)

Lists is a **cabinet you can file things in**, not a “lists page” and not a
Windows replica to protect. The Explorer verbs stay; the frame is milled fascia:

- CRT title caption (`Lists — File Manager`) on a brushed silver bay, metal
  caption keys (`_`, `□`, `×`).
- Brushed toolbar bay: raised metal keys for **↑ Up**, **New List**,
  **New Folder**, Settings, Select; Icons / List / Details / Cards as equal-fill
  view keys (active = CRT + round power lamp); Search on the same strip.
- Address nameplate + path well (`All \ wanted`).
- Left tree: Quick Access + Folders nameplates, classic explorer indent
  (selection blue stays the quote for the active row).
- Right inspector: milled bay, engraved fact labels, CRT count, metal action keys.
- Status bar: CRT folder/list counts and a **Smart lists** checkbox.

Keep the 1px highlights, shadows, and cool `#c0c0c0` family where a bevel is
the quote. No rounded marketing cards. The frame may then go further — silver
rim, pixel throw, a dissolve on close — without becoming glass. Do **not** sand
velvet or replace orbs. The face gray is one
`--chrome-face` token (`app/win95.css`): true cool/neutral gunmetal (chroma 0,
never brown). Settings → Window gray sets the persisted set-point; the live
value drifts a few RGB units around it over minutes (`lib/chrome-patina.ts`).
Global skin: `app/win95.css` (`body.win95-app`). Lists-specific
layer: `components/Lists/filemanager98.css` (`.fm98` milled fascia).

### 2. Velvet + orbs (the curiosity cabinet)

Folder **Icons** view is a crushed-velvet desktop (`public/newvelv.jpg`, class
`.fm-desktop.velvet`). Lists and folders sit on it as **orbs** — cut-out
photographs of small objects (`public/orbs-removebackground/`,
`lib/orbs-manifest.ts`, picker in `components/Icons/`).

That is the surreal half. The labels stay utilitarian (blue underlined names,
tiny count badges). The *objects* carry the beauty.

Inside a list, **Default** and **Icons** repeat the same contract: personal orbs
on a plain working surface, not a Pinterest moodboard and not a flat emoji grid.
Default also shows a complete checkbox when the list is a checklist — not a lone
blue hyperlink on white.

### 3. Technical whimsy (auto-organize and kin)

Fun lives in **mechanics**, not in decorative UI. Some of those mechanics are
what a haunted 1997 file cabinet might have done (icons sweeping into a grid).
Some are the impossible layer: the same sweep can leave a trace of snowflakes
or cursors, and a window may melt when it closes. Both earn their keep by
being tied to a real verb.

Canonical example: **Auto-organize** on the velvet desktop — icons sweep into a
deterministic grid (`FolderViewIcons.tsx`, `lib/lists-icon-grid.ts`,
`lists-ui-store`). It is a real layout tool *and* a little animation. Keep
that spirit: useful, slightly theatrical, never a Lottie sticker on a white
card.

The other canonical example is **Willpower gems** on Home → Habits Daily —
one habit gem per weekday completion, invert while any hit this week remains,
plate-click bouncing-ball physics, crystal-PNG occlusion, Settings-only crystal. See
[Willpower gems — example of perfect design](#willpower-gems--example-of-perfect-design).

Other Lists behaviors that fit: freeform icon dragging, orb gallery edit/hide,
custom uploads with background removal so new photos blend onto velvet like
the built-in orbs (`lib/remove-background.ts`).

---

## Rules for every new section

1. **Preserve the three layers.** A new tab that is only gray bevels with no
   luminous objects feels like an admin tool. A new tab that is only pretty
   objects with no instrument feels like a lifestyle app. A new tab that is
   only a Windows dialog, forbidden to do anything the decade could not, feels
   like the wrong nostalgia. Ship motif, cabinet, and — where a verb deserves
   it — one impossible gesture.
2. **Do not SaaS the chrome.** No glassmorphism, no 24px radii, no drop
   shadows-as-brand, no “refined” navy-to-purple title bars, no replacing
   caption buttons with ghost icons. Beauty that is milled, pixel, engraved,
   or surreal is wanted, including on the frame. Hairline grooves, pinstripes,
   engraved rules, and analog throws stay. `win95.css` is the quoted ancestor
   (bevel, inset field, pixel font, navy focus), not a ban on leaving it.
3. **Do not plain the contents.** Default item/list/folder marks should be
   orbs (or equally specific photographed objects), not generic line icons.
   Empty folders can still be velvet. Spreadsheets and tables may be austere
   — they are *documents inside the cabinet* — but the surrounding window
   stays file-manager furniture.
4. **Whimsy is in objects and motion, not copy.** Status text stays plain
   (`43 folder(s), 133 list(s)`). Don’t write cutesy empty-state essays.
5. **Animations earn their keep.** Prefer layout physics (auto-organize,
   drag, snap, WILLPOWER plate bounce) and **one impossible gesture** on a
   real verb (a window dissolving or melting on close, a sweep that leaves
   cursors or snowflakes) over ornamental loops. Skip a Lottie sticker on a
   white card. Do not skip a motion only because Explorer.exe could not have
   done it — that impossibility is the point, when it is rare and tied to
   the action. Honor `prefers-reduced-motion` by cutting to the end state.
6. **Personal, not stock.** Orbs should look like *this person’s* cabinet —
   specific stones, toys, shells — not a unified icon *set* designed as a
   brand system. Uploads with knocked-out backgrounds are first-class.
7. **Look at Habits first; match Lists chrome when the window is Explorer.**
   Open Home → Habits Daily (Habits Tab Control Panel, analog furniture, Willpower gems,
   CRT). Then open Lists → folder Icons and the All Items orb grid. If the new
   UI would look embarrassing next to Habits’ console *or* Lists Icons, revise
   the new UI — not Habits, not Lists.
8. **Label what the app made up.** The app fills in data the user never typed
   (how long a habit took, when in the day it happened). Never render that as
   though it were observed. The convention: a leading `~` on the number and a
   dashed amber **est.** chip whose tooltip states the basis in plain words
   ("4 pages × 10 min each"), clickable to confirm or correct. Same treatment
   anywhere else derived values surface — the copy stays plain on purpose,
   and a record that quietly guesses is worse than one that admits it.
   Implementation: `components/Home/ToDo/CompletionTimeLine.tsx`,
   `lib/estimated-values.ts`.
9. **Analytics studio exception.** Keep the `.fm98` **title bar** and **status
   bar** so Analytics still lives in Brain2 next to Lists. **Range and left-index
   chrome** use the [milled fascia](#milled-fascia); **every canvas** stays a light
   instrument studio (`analytics-chrome.css`):
   **Karla only** (the app typeface — no second display serif), tabular numbers
   on readouts, **ink `#000000` on Win95 face gray** (`#c0c0c0` paper / raised
   wells, `#a8a8a8` recesses) so the studio matches the rest of the app chrome
   instead of cream paper. Dark labels, not gray-on-gray.
   Nested metal packing, oscilloscope wells for **line series** (phosphor is
   *data*, not a dark CRT theme). Pies, treemaps (area ∝ count), density, mosaics,
   hour×day heat, small multiples, linked highlighting, honest empty frames.
   One shared window: 7 / 14 / 30 / 90 **or** a custom inclusive from–to
   (labeled as the dates). **Not all Analytics charts have to be Win95 style.**
   Do not restyle Lists / Plan / Scheduler / Tracking / Habits interiors to match
   this studio. Item Types belongs in Analytics as the **library / browse**
   surface; Settings still edits types.
10. **Tooltips and instructions.** Whenever a control, number, or canvas would
    leave a person guessing, say what it is. Prefer a native `title`, a `?`
    help, and a one-sentence kicker together. Always create as many tooltips
    and provide as many clear instructions as possible if applicable and needed.
    Do not hide the law of a chart (what 100% means, why a cell is blank, that
    r is not a cause) behind a pretty glyph. Analytics views carry
    `ANALYTICS_TAB_HELP` plus per-control titles; other modules should match
    that density of explanation.
11. **Plan contents may shimmer.** Home → Plan keeps a milled instrument frame
    (CRT title, brushed silver bay, Month/Week/Day keys with round power lamps,
    period nameplate, metal action keys — `.plan95` in `plan-chrome.css`) and may
    leave pure Windows — silver rim, pixel throw, a dissolve — without becoming a
    dark-slate SaaS calendar. Event *contents* may use mint / lilac / teal
    opalescence and transparency (glass wash + left stripe, user-defined
    `CalendarEvent.color`, default `#8cd4a5`). That is cabinet, not chrome —
    do not sand chips back to gray faceplates, and do not restore the
    dark-slate SaaS calendar or *“Schedule and organize your time with
    elegance.”* Avoid orange event defaults. Month / week / day cells must
    breathe. Period nav is a nameplate date with metal prev/next/today keys.
    Fieldset legends are engraved nameplates, not links. Text-field
    focus is navy `#000080` on **every** input in the app (`win95.css` /
    `--ring`), never WebKit orange — Gallery name fields, Lists, Plan
    `--p-focus`, shadcn inputs included. Amber **est.** chips
    elsewhere are a different convention.
12. **Cool gray only.** Face furniture is `--chrome-face` (`#c0c0c0` family,
    chroma 0). Never `#c5c3bc` or any warm/brown mix. Settings → Window gray
    is the set-point; the live value may drift over 24 minutes, still gray.
13. **Unsaved-changes house law.** If a popup can save edits, cancel / close /
    × / overlay-click must prompt a Win95 confirm when the draft differs from
    the open baseline: **Save changes** (persist then close), **Cancel** (stay
    in the editor), **Exit without saving** (discard and close). A clean
    editor closes immediately — no prompt. Do not copy-paste this: use
    `lib/unsaved-changes.ts` (snapshot compare) +
    `components/ui/unsaved-changes-guard.tsx` (hook + confirm). Auto-saving
    surfaces (Docs, Tracking view prefs, global Settings fields) stay clean
    and close at once.

---

## Depth & spacing

The chrome half is not a stack of cards. It is **nested metal**: one instrument
built from a raised cabinet, sunken wells, and small raised controls. Home →
Habits Daily is a worked example, not a private skin — copy the *language*, not
the selectors.

**Pack one instrument.** Related numbers, navigation, and tools share a beveled
console. Do not float each metric in its own white card on the PCB desktop.
Isolation is for different *rooms* (a new tab, a dialog), not for sibling stats
on the same screen.

**Equal-height modules.** Sibling wells of one instrument share **one height**.
Stack or tile leftover space as squares; do not stretch one pane (`fr` +
`align-items: stretch`) to eat the row. Canonical still: `designrefs/designref1.jpg`
(**IRIX cattle**) — matching beige wells down the right and along the bottom.
Kin: TENO panel rows, Flower CRTs’ three screens, noble-gas ampoules on one
shelf. Home leftover widgets (review, affirmation, weather, user add) are
those modules. Catalog: [`DESIGN_REFS.md`](DESIGN_REFS.md#equal-height-modules).

**Nest bevels.** The outer case is raised (`--w95-raised`: inset highlight, then
shadow). Inside that, a sunken well (`--w95-sunken`) holds the document or the
readout. Controls sitting on a sunken strip are raised again. Input fields use
`--w95-field`. That three-step hierarchy *is* the 3D. Drop-shadow “elevation”
and soft card rings are the SaaS substitute — do not use them for furniture.
Instrument rows (tabs, date plates, overview tiles) go one step further: the
[milled fascia](#milled-fascia), not another plain bevel.

**Tighten the pack.** Gaps between panes of one instrument stay in the 4–8px
range. Padding inside a well is a few pixels, not a marketing card’s 24px.
Four related totals share a compact quadrant; they do not each get a hero
tile. A progress readout belongs *beside* those totals in the same overview
row, not in a fifth card below.

**Home dashboard TOP strip (all five tabs — landed).** Date
caption + Review due + one Points tile + **Today's Progress** is one shared
instrument on **every** Home sub-tab (Habits / Plan / To Do / Goals /
Tracking). It is house chrome, not a Habits Daily trick. File packing stays
with the Home implementer (`components/Home/README.md`). Do not restyle Plan
or Tracking *interiors* to match this strip.

| Beat | Intent | Peek (working tree) |
|------|--------|---------------------|
| Shared strip | Same analog overview on all five Home tabs. Do not keep phosphor wells / CRT for Habits and white Cards for the rest. | **Landed.** `HomeOverview` mounts wells on every tab. |
| Narrow wells | Stats wells stay compact and share one height. They grow together up to 200px so the row fills; they wrap only when the window is narrow. | **Landed.** `--home-tile-h` (156px); flex `1 1 132px`; max-width 200px. Milled bays echo the header fieldsets. |
| Square widgets | Review, one Points tile, progress, the screen pet, and Days Until share caption + CRT + footer. Affirmation, weather, Next, Day lamp, Solar remainder, Tracking now, Night well, Harvest leftover, and Inbox mill are optional. × asks Are you sure? before hide. The weekday plate is the clock's date; Widgets sits in its corner. Click a tile for a silver handheld: dark wells, nixie digits, chunky keys. | **Landed.** `home-overview.tsx` + `home-widgets-menu.tsx` + `home-widget-dialog.tsx` + `home-chrome.css`. |
| Value-bar numerals | Center the numerals in the wells. | **Landed.** `.hab-score-readout` is centered; All Time / Today / Week / Month share one CRT glass. |
| Three-color gradients | Value-bar fills use Habits `percentLedTint` + `gradeTubeColor` + `outputGradeTubeColor`. | **Landed.** `--home-grad-*` from those three keys. |
| CRT phosphor | One green for CRT values: Habits Week grade / Perfect output (`--hab-crt-green: #7dffc4`) with that same slight `--hab-crt-glow` (`0 0 3px`). Home strip numerals match the grade panels. | **Landed.** Shared on `.home95` + `.hab95`. |

Narrower wells are not “collapse the point cards.” Real four-digit scores still
need a readable well. Empty theater (zeros taking the fold while Needs
Attention hides) stays a Wave 7 chrome bug, not a reason to stretch wells.

**Group the header as one unit.** Title left, period / mode center, utilities
right — one textured strip. Do not wrap tools onto a second island at the
dashboard’s normal width. Stack only when the viewport is actually a phone.
Current-period controls stay the same height as past-period ones; “Today”
is a sunken state, not a balloon.

**Weight “now.”** The current day or current period is a sunken column with a
hairline and a modest mint / lilac wash — obvious, not a fat orange blob, not
a huge ring, not a dark metal slab, not a SaaS underline.

**Hairline texture is wanted.** Repeating 1px grooves, pinstripes, engraved
captions, hatch, and inset rules on the instrument add depth. Encourage
that on Habits / Home interiors. Do not treat it as visual noise. Steal FR4 /
cat-traces *as engraved rules*, not as a PCB pasted on the grid.

**Weather instruments.** Leftover Home squares that show weather (and kin:
clocks, small analog readouts) follow the **gadget wall** — circular meter in
a metal well, chrome-adjacent, plain copy — not a SaaS forecast chip
and not a white card on the PCB. Steal notes:
[`DESIGN_REFS.md`](DESIGN_REFS.md#weather-instruments). **Landed** on Home: analog summary tile (no fake MDI caption); click opens instrument (city search, beach picker, rain plate, week strip, NOAA tides).

**Analog controls on Habits.** Toggles on this surface are cockpit rockers
(`components/Home/Habits/cockpit-switch.tsx`): beveled throw, engraved
ON/OFF, jewel lamp. Not iOS pills, not shadcn `Switch`. **Sort Habits** is a
custom metal picker (`habit-sort-control.tsx`), not a native OS dropdown. It
belongs **above** the grouped rockers (Heatmap View, **Day View**, Hide
Completed Today, **Loading Bar**, and **Small LEDs** — that last one is not
a rename of Loading Bar). Week / Span grade and Perfect output are photoreal
**noble-gas finger-tubes** — cylinder + hemispherical dome, soft volumetric
plasma (not a lightning bolt, not a neon sign, not a pipette point); plasma
length = percent. Discharge hue is picked on each grade’s milled detail
sheet (`.hab-grade-sheet`: CRT percent, row readouts, Curve / Discharge bay).
Defaults are the Home overview hues: week-grade green `#508b51`,
perfect-output navy `#25366a`, percent LED `#7e14ff`. The live column is a photograph: 24s 3% ionization shimmer,
`prefers-reduced-motion` still. CSS/SVG (no WebGL). WILLPOWER stays a
photographed **orb** in a fixed oval plate (scale the crystal, not the
plate). Yes/No cells are tiny recessed **panel lamps**
(`habit-led-lamp.tsx`): square metal plate, circular well, smoked glass,
visible die off / die glow on in `percentLedTint` mixed with dark metal
(warm, not blast-white) — not spherical nipples, not cartoon radial balls.
They fit inside the cell without blowing row height. **Small LEDs** (default
ON) keeps those lamps at **15px** so rows stay dense; OFF lets the lamp fill
the cell (`data-fill`). Same lamp language, not a second widget. Do not
change habit completion math to restyle the furniture.

**Day view** (Daily spreadsheet rocker, `habitDayView`, default off). ON keeps
only the **current-day column** plus the **weekly % column on the right** — a
list of today. OFF is the full week grid. Heatmap view still replaces the
spreadsheet when that rocker is on.

**Completion % / Loading bar** (`percentLoadingBar`, **default ON**). ON is a
quiet **milled metal channel** of 10 via-dots (`percent-led-bar.tsx`): each pip
= 10%, Tek POWER / TENO strip / FR4 pad language, strip + `%` on one row. Same
component for row and column totals. OFF keeps the smaller numeric 5×7
luminaire (`percent-led.tsx`). Not a toy equalizer, not chunky gray bricks,
not pastel CSS bars, not recycled Yes/No cell lamps.

**Precious marks stay small.** Type chips, issue marks, and score gems stay
about 12–16px. Daily row **edit jewels** are a set stone at **18px** (20px hit)
so they read as pressable — still no dark disc / halo / socket, still not
toolbar chrome or a Lucide font at 24px. Daily Habits gems are photographed cutouts
(`public/gems-removebackground/`, same pipeline as orbs). The **Habits Tab
Control Panel** is a textured jewel-PCB column (old PASTURE / instrument-rail
slot) beside the daily grid, not a row under the grid. Daily gauges, streak,
**Sort Habits**, grouped rockers, and New habit live in that control panel;
**Willpower gems** are pinned to the foot (`.hab-desk` stretches with the
sheet; `.hab-willpower-gems` is `margin: auto 0 0`). Default width is 196px
(seam resize retired). Open **Physics** to enlarge the same chrome +
black-mirror plate; do not grow the control column.
One gem/edit at the **far left**, set in an inset metal socket (no raised
button rectangle; press sinks the jewel). The name column is title text only —
no gem before the title — with streak and × under a wrapping name. Delete
lives in habit settings (pick/upload gems like orbs).

### Willpower gems — example of perfect design

Whimsy in *mechanics*, same family as auto-organize — not a sticker on the
plate. This is what the house is for. (Formerly “WILLPOWER week.”) The plate
itself is the [chrome and black mirror](#chrome-and-black-mirror) reference —
copy that object language onto other jewels.

- **Week satellites / habit gems.** Each **completion** this week adds **one copy** of that
  habit’s photographed gem around the central willpower crystal (`lib/willpower-stones.ts`:
  derived from persisted completions, no extra collected-id blob). Three days
  done → three stones of the same cutout; seven days done → seven. Uncomplete
  a day and **that copy** leaves. At the compact control panel, satellites stay ~12px — smaller than the
  18px row jewel. Physics enlarges that same handful on a larger oval (gems stay
  around the crystal). A Sunday plate may be crowded, never auto-huge. Gems **do not tunnel**
  through the central crystal (solid XY cylinder); they sit around it. Stones
  behind the PNG still paint behind it (Y-sort); stones in front stay in front.
- **Invert on complete.** The far-left row gem **inverts** while that habit has
  **any** completion on the visible week (not only today). Invert leaves when
  the last hit this week is undone.
- **Plate is a button.** Photoreal **chrome + black-mirror** well, **Willpower gems** on the face. The oval is a real push-button (`data-no95` plus higher-specificity chrome so the global Win95 bevel cannot flatten it). Press sinks the face (`.is-pressed:not(.is-holding)` only — never CSS `:active`, so a gem drag cannot fake a well press) and **stirs** — a short whirl, still fun, not a scatter bomb. **Grab a gem does not stir or press:** pointer-down on a satellite (including through transparent PNG holes, via hit-test) must not fire the plate button. Grab anywhere (including off the plate and in the Physics lab): lift raises z so the stone follows the pointer; release keeps that height and velocity so bounce, collisions, and the lab equations follow. Airborne gems skip the oval fence until they land. Gems paint **outside** the rim (`overflow: visible`; outer fence ~1.32×). Photographed shape stays honest (no squash, no drop-shadow). Each stir uses a fresh seed. **Physics** opens a wider Win95 lab with a **live twin plate** (same compact sim, mapped onto the larger oval so gems stay around the crystal — drag and plate-click use that mapping). CRT math and graphs on the left are separate sunken wells, not one black slab. Equations collapse; explanations are a second collapse; sliders have their own Explain. Show all / Hide all explanations and Slow-mo sit on the toolbar. Knobs are painted Win95 thumbs over a native range (value does not snap to min). Extra instruments: ΣE, |p|, spin K, dish period, packing, bounces. The dialog does not spin at 60fps while idle, so sliders stay live. Edits persist until Reset to default (footer of the lab, not over the knobs). Motion stays smooth: no lag, no remounting knobs, no unmapped lab coordinates. Not a file picker. The crystal is a **solid** in the well (gems bounce off; they cannot clip through) and the **PNG is the occluder** for stones around it. Later ideas: [`components/Home/Habits/README.md` — Willpower gems later](../components/Home/Habits/README.md#willpower-gems--later).
- **Settings still changes the crystal.** Upload / knock-out / restore default
  live in Habits Settings (`WillpowerGemsSettingsField`). The plate keeps the
  press feel and the bounce.

Do not auto-grow the plate to hold the week. The control panel stays compact;
open **Physics** to enlarge the display. Do not Lucide
the satellites. Do not put change-image back on the plate. File packing stays
with [`components/Home/Habits/README.md`](../components/Home/Habits/README.md).

**Daily Habits interior may go feral.** Like an installed module, Home →
Habits may be divine-machinery / Y2K workstation (`designrefs/`) — gunmetal
chassis, copper-mesh well, photographed gems, noble-gas tubes, LED lamps.
The shell and other windows may share that machine language. Lists keeps
velvet and orbs; it does not have to stay a gray Windows dialog so the rest
of the house can match it. Follow
the Daily packing in [`components/Home/Habits/README.md`](../components/Home/Habits/README.md#daily-layout--chrome-intent)
**as much as possible (AMAP)**; do not invent a second dashboard. Header is
**Habits** + date + Settings. Period keys Daily/Weekly/Monthly sit **above
the sheet** in a milled bay (equal keys; active = CRT + round power lamp). Heatmap is a Daily **sidebar
rocker**, same light sheet as the checklist — spacious jewelry cells, not a
dark-mode board and not a cramped GitHub mosaic. Today’s column is a **solid**
mint fill, not a gradient. WILLPOWER week (satellites, invert, plate-click
physics, PNG occlusion, Settings-only orb) is the
[canonical example](#willpower-gems--example-of-perfect-design) on this
interior. The global header and tab bar are in bounds for the three
layers (silver machine, pixel throw, one dissolve). Do not restyle them into
liquid tribal chrome as a caption, and do not hide their verbs. Do **not**
full-bleed a 100vw nacre sheet
(`margin-left: calc(50% - 50vw)`); that was the white shifting block.

**The room meets the furniture.** An instrument should not sit in a harsh
desktop frame *inside its own chassis*. Gutters of the app page stay the
desktop field (`pcb-backdrop`; teal by default). The global BRAIN2 mill title bar spans the
window (pinned, edge to edge) and the top tabs sit on that desktop below it — a
fascia, not a room field and not an inset card. Do not restyle other modules to match one room’s field.

**Ink stays ink.** Metal and nacre are light surfaces. Body copy, numbers, and
labels are dark (`#111` / a true muted gray). Do not inherit the desktop’s
white muted text onto a pearl or gray field.

**Do not**

- Restack Home-style white cards on the PCB desktop and call the screen shipped.
- Open 16–24px gaps between every sibling control “for breathing room.”
- Use one bevel for every layer (flat gray rectangles with identical inset).
- Make jewel / orb marks the size of caption buttons.
- Paint a full-page field that washes out the global BRAIN2 title.

Worked example: `components/Home/Habits/habit-chrome.css` (console + nacre +
compact quadrant + one-row header). Tokens live on `app/win95.css`.

---

## What already implements this (and what does not)

**Closest to the standard**

| Surface | Why it counts |
|---------|----------------|
| **Home → Habits Daily (favorite — look here first)** | Most developed room. Metal workstation + Habits Tab Control Panel + analog furniture + Willpower gems (**chrome + black-mirror** oval) + CRT phosphor + designrefs skeuomorph. Extend other interiors from this, not from a card kit. |
| Lists folder Icons | Velvet + orbs + auto-organize — the cabinet gold standard. **Frame** is milled fascia (CRT title, brushed toolbar bay, equal-fill view keys with power lamps, engraved nameplates, CRT status counts); velvet and orb photographs stay untouched |
| Home → Tracking | Milled fascia (CRT title, Time Grid / Activity Log / Day Log bay with power lamps, period nameplate, metal prev/next/today, now bay) + Show/Sort/Expand↔Conceal/New pen rail + photographed pen tray in a metal frame (View settings; default Cat traces; one-line beads + steel plates for copy) + white/gray plot + now/sunrise/sunset lines + photographed title orb |
| Home dashboard TOP strip | Date + Review due + points + Today's Progress. **Landed:** strip mounts on all five tabs; phosphor wells + CRT on every tab; numerals use shared `--hab-crt-green` (`#7dffc4`) matching Week grade / Perfect output; All Time / Today / Week / Month share the same metal face (no darker All Time plate); equal-height squares wrap (no tray x-scroll); weather analog; Widgets overlay. |
| Home → Habits Daily | Milled fascia workstation (CRT **Habits** title, Daily/Weekly/Monthly bay with power lamps, period nameplate, metal Settings / New habit) + photographed gems + right **Habits Tab Control Panel** with noble-gas **finger-tube** grade meters (rounded dome) and **Willpower gems** (`.hab95`); contained, not a 100vw white sheet. Recessed panel lamps for Yes/No (**Small LEDs** ON = 15px, OFF = fill the cell; tint as on-color, not blast-white); completion % is a quiet 10-pip milled channel + `%` on one row (numeric LED optional); name column capped so day columns grow (no inner scroller on a wide desk); **Day View** = today + week %; 18px set-stone edit jewel in chrome with no dark disc. **Willpower gems** (canonical): week gems collect small around the crystal; row gem inverts while contributing; plate pinned to the control panel foot; compact column (Physics enlarges the plate); plate click stirs (grab does not press the well); crystal is a solid — gems do not tunnel; PNG occludes stones behind it; gems keep their photographed shape and stay visible past the rim; Physics lab maps the same world onto a larger chrome + black-mirror oval (smooth, live sliders, CRT wells); Settings still changes the crystal |
| Home → Plan | Milled fascia (CRT title, Month/Week/Day bay with power lamps, period nameplate, metal action keys) + packed Explorer rail (habit gems, 10-pip capacity) + opalescent event chips (user color); not the old SaaS calendar |
| Home → To Do | Milled fascia (CRT title, period nameplate, Day/Week/Month keys, Show / Sort / Pace bays) + packed list well + mill row keys; same filters / complete / missed / Done est. verbs as before. Under the window, the title jewel sits on the desktop at photograph size (`.todo-desk-plate`) |
| Home → Goals | Milled fascia (CRT title, metal keys, Day/Week/Month/Year/All lamps, recessed lists) + Direction CRT / pewter tape; same prioritize / add / review verbs. Under the window, the title jewel sits on the desktop at photograph size, centered (`.gol-desk-plate`) |
| Operations | Milled fascia (CRT command-center title, engraved category nameplates, raised metal keys, equal-fill panel keys with power lamps, CRT heatmap well, working-now CRT clock); same board / panels / Working on this now verbs |
| Settings | Milled fascia (`.set95`: CRT title, brushed section bays, engraved nameplates, raised metal keys; CRT only for title / pairing code); same fields and verbs |
| Inbox dialog | Milled fascia (brushed bay, engraved nameplates, raised metal keys, CRT counts, power lamp on the active Inbox / Monkey brain key); same walk / clarify / batch verbs (`inbox.css`) |
| Header pin-bar popups | Milled fascia (`.hpp95`: CRT caption + power lamp, brushed bay, engraved nameplates, raised metal keys, recessed fields; Tracking compact dialog is shell-only); same capture / review / metrics verbs (`header-popup-chrome.css`) |
| Item detail | Milled fascia (CRT title readout, engraved chips, raised metal keys, equal-fill Details / Scheduling / … tab bay with power lamps); same fields / save / complete / delete / persistence (`item-detail-chrome.css`) |
| Lists All Items / list Icons | Trinket grid inside the same window |
| Global shell | Desktop field (Settings → **Desktop**; default plain Win95 teal, optional PCB photos in `app/pcb-backdrop.css`), **milled app tabs** (`win95.css`, active key is a CRT + power lamp), pinned mill title bar (`AppHeader` + `shell-chrome.css`: full-width navy BRAIN2 caption + today's-friend jewel + Friend / Review / System / optional **now** well / Capture groupboxes; sticky, z-40). **now** (`header-now-box.tsx`) sits between System and Capture only while an Operations or pen-color Working session is live (name, tabular elapsed, Stop, Pause↔Resume; idle → hidden). Home → Habits Daily skins the interior of `.hab95` only — contained console, desktop gutters stay. Top tabs stay on the desktop plate and use the [milled fascia](#milled-fascia). Other modules are unchanged. |
| Orb picker | Curiosity-cabinet inventory (`components/Icons/OrbPicker.tsx`) |

**Chrome is on the right track; contents may still be plainer**

Home (except Habits Daily **and** the shared Home TOP strip), Modules, dialogs (except **Inbox**, **Settings**, and pin-bar **`.hpp95`** popups): they inherit
bevels and gray furniture. **Operations** is on the milled fascia (see gold-standard
table). **Scheduler** frame (`.sch95`) is milled fascia — funnel/Gantt/graph contents untouched. **Docs** outer chrome (`.docs95`) is a milled-fascia whisper on caption /
menubar keys / status counts only — white paper untouched. The TOP strip (date + Review + points + Today's
Progress) is **in progress** toward one analog instrument on all five Home
tabs — see [Depth & spacing](#depth--spacing). When adding icons, empty states, or “hero”
visuals, **borrow Lists’ objects**, don’t invent a second illustration
language (flat Lucide-only, Material, or skeuomorphic-but-generic).

**Do not “upgrade” toward**

- Contemporary dashboard kits (cards, soft gray canvases, Inter-on-white).
- Theme packs that restyle the *frame* (dark mode glass, macOS Big Sur, fluent).
- Tracking plot as brown / yellow / dark pour. White field, gray ticks. Notes, log rows, and untracked gaps stay white/gray — never cream. Tracking **day notes** are a metal well: collapsed is legend + Expand only; Expand opens a tall white composer and tall history (cream lace only inside the bevel). **Do not remove** the red now line or gray sunrise/sunset lines (`trk-time-markers.tsx`).
- Tracking block editor / Log activity lag. Dialogs must open on the click. Do not derive sleep nights, sync Done rows, or fetch weather on that path.
- Mascot / onboarding illustration systems.
- Homogenizing orbs into a matching vector icon family.

A future theme switcher, if it ever exists, must retint furniture — not
replace photographed contents with a “clean” icon font.

**Analytics** is the one tab whose *interior* is a light instrument studio (not
dark CRT, not cream-paper SaaS). Face gray `#c0c0c0` to match Win95 chrome.
One typeface (Karla); phosphor only on
traces. Range and left-index chrome use the [milled fascia](#milled-fascia);
the window **title bar** and **status bar** stay Lists furniture so it still
sits next to Lists. Lucide is still not identity for the cabinet. See rule 9.
Always add tooltips and clear instructions (rule 10).

**Plan** is the same three-layer rule: quoted instrument frame, luminous chips, room for one impossible motion. See
rule 10. Do not destyle the wash to “match” gray furniture.

---

## Implementation map

| Concern | Where it lives |
|---------|----------------|
| Global Win95 furniture | `app/win95.css` (`body.win95-app`); `--chrome-face` + `--fascia-*` / `--hab-crt-*`; unskinned dialogs/menus/buttons/nested tabs inherit the milled fascia; real specificity so Tailwind HMR cannot unskin it; module CSS imported after it in `layout.tsx` |
| Chrome gunmetal (quiet) | `lib/chrome-patina.ts` + `app/chrome-patina.css` — one `--chrome-*` family on `:root`; Settings set-point + minutes-scale drift |
| Lists Explorer skin | `components/Lists/filemanager98.css` (`.fm98` milled fascia: toolbars, view keys, CRT title/status, inspector, dialog metal; velvet + orbs unchanged) |
| Docs outer chrome | `components/Docs/docs.css` (`.docs95` milled caption / menubar keys / CRT status counts; white paper / `document-editor.css` untouched) |
| Plan calendar skin | `components/Home/Plan/plan-chrome.css` (`.plan95` milled fascia); chips in `plan-chip.tsx` |
| Tracking instrument | Milled fascia for Home → Tracking: CRT title, equal-fill Time Grid / Activity Log / Day Log keys with power lamps, period nameplate, metal period keys, milled now bay, metal-framed pen tray, plot bezel (white paper untouched). Files: `tracking-chrome.css`, `pen-tray-bg.css`, fascia markup in `home-dashboard.tsx` Tracking pane. Language: [Milled fascia](#milled-fascia). |
| Home dashboard TOP strip | Date plate (weekday in a CRT, calendar date on a nameplate, Widgets as a raised key) + milled overview tiles + Home sub-tab bay (`data-ui-name="Home tabs"`: five equal milled keys, active CRT + power lamp, air above the bay). Shared by **all** Home tabs. Files: `home-dashboard.tsx`, `home-chrome.css`, `home-overview.tsx`, `points-stats.tsx`, `daily-progress-quickview.tsx`, `home-review-banner.tsx`, `home-days-until.tsx`. CRT values use `--hab-crt-green` (`#7dffc4`) + `--hab-crt-glow`. Language: [Milled fascia](#milled-fascia). |
| Operations command center | Milled fascia for the Operations board + workspace: CRT title, engraved category nameplates, raised metal keys, equal-fill panel keys (active = CRT + power lamp), CRT heatmap well, working-now CRT clock. Files: `operations-chrome.css`, `OperationsView.tsx`, `OperationWorkspace.tsx`. Language: [Milled fascia](#milled-fascia). |
| Settings dialogs | Milled fascia for header Settings + nested Item Types: CRT title, brushed bays, engraved nameplates, raised metal keys; CRT for pairing code only. Files: `settings-chrome.css`, `SettingsDialog.tsx`. Language: [Milled fascia](#milled-fascia). |
| Inbox dialog | Milled fascia for header Inbox + clarify/delete sheets sharing `.inbox-dialog`: engraved title nameplate, equal partition keys with power lamps, CRT counts, raised metal action keys. Files: `inbox.css`, `inbox.tsx`. Language: [Milled fascia](#milled-fascia). |
| Header pin-bar popups | Milled fascia for Quick Add, Bulk Add, Ingest, From Notes, Phone Notes, Metrics, Reviews / Morning / Affirmations / Post-mortem, and the Tracking compact dialog frame (shell only): CRT caption + power lamp, brushed bay, metal keys, recessed fields. Files: `header-popup-chrome.css` (`.hpp95`), wired from `quick-add.tsx`, `enhanced-bulk-add.tsx`, `ingest-log-dialog.tsx`, `notes-ingest.tsx`, `iphone-notes-store.tsx`, `Tracking/MetricLogger.tsx`, `cognitive-state.tsx`, `Reviews/*`. Language: [Milled fascia](#milled-fascia). |
| Item detail | Milled fascia for full-screen + popup item detail: CRT title, metal keys, equal-fill detail tabs (active = CRT + power lamp). Files: `components/ItemDetail/item-detail-chrome.css`, `ItemDetailPage.tsx`, `ItemDetailPopup.tsx`. Language: [Milled fascia](#milled-fascia). |
| Analytics chrome | Milled fascia for range + left index only (equal metal keys, CRT active + power lamp, engraved nameplates); studio canvases stay light-instrument (Karla, face gray, trace phosphor `#3dff8a`). Files: `analytics-chrome.css`, `enhanced-analytics.tsx`, `AnalyticsNav.tsx`. Language: [Milled fascia](#milled-fascia). |
| Habits Daily console | `components/Home/Habits/habit-chrome.css` (`.hab95`); gems in `habit-gems.tsx` + `lib/gems-manifest.ts`; grid in `habit-grid.css`; analog rockers in `cockpit-switch.tsx`; **Sort Habits** in `habit-sort-control.tsx`; grade tubes in `noble-gas-tube.tsx`; Habits Tab Control Panel in `habits-control-panel.tsx` (Willpower gems — photoreal chrome + black-mirror oval, satellites, invert, plate-click stir that is not a gem-grab, crystal solid + PNG occlusion, Settings-only crystal, Physics popup lab with mapped twin + CRT wells + live sliders; `willpower-gems.tsx`, `lib/willpower-stones.ts` + `lib/willpower-physics.ts`); recessed panel lamps in `habit-led-lamp.tsx` (**Small LEDs** default ON = 15px, OFF = fill-cell); recessed 10-module % strip in `percent-led-bar.tsx` (default); numeric % LED in `percent-led.tsx` (Loading Bar off) |
| Gem photographs | `gems/` source, `public/gems-removebackground/` (tight-cropped), `scripts/process-gems.py` + `scripts/crop-gems.py` |
| Velvet desktop | `public/newvelv.jpg`, `.fm-desktop.velvet` |
| Orb photographs | `public/orbs-removebackground/`, `lib/orbs-manifest.ts` |
| Icon resolution / picker | `components/Icons/` |
| Freeform + auto-organize | `FolderViewIcons.tsx`, `lib/lists-icon-grid.ts`, `lib/lists-ui-store.ts` |
| Upload cutouts | `lib/remove-background.ts` |
| Pixel UI font | `public/fonts/w95fa.woff` |
| shadcn primitives | `components/ui/` — building blocks; **skin them**, don’t restyle the product around them |

When a new module needs chrome, start from the quoted ancestor in `win95.css`
and the Lists window pattern, then let motif / cabinet / impossible show.
A row of instruments (tabs, a date plate, overview tiles) uses the
[milled fascia](#milled-fascia) before a second gray bevel. Do not invent a
SaaS visual system. When it needs identity for lists, folders, or items, use
**orbs**.

---

## Installed modules: different rooms, same house

The living-application claim is that any small app can be **installed** into
Brain2 ([`MODULE_PLATFORM.md`](MODULE_PLATFORM.md)), which makes this document's
promise load-bearing rather than decorative. An installed module's interior is
allowed to be **feral**: its own stylesheet, its own overlays, its own motion,
its own density, its own vocabulary — Tidy's session overlays and Film DNA's
Letterboxd-adjacent walls are correct, not deviations. Do not sand a module into
`components/ui/` defaults, and do not extract its chrome into shared components
"for consistency." That is how the house stays infinite and still one house.

What the module may not have is its own **ontology**: its records are Items like
everything else. So the rule is exactly two sentences long.

> **Interiors may look unique. They must never mean unique.**

That is what lets the app hold a house, a trip, a film taste, and a practice
habit at once and still feel like one place — different rooms of one vintage
machine, not one Card repeated. A shared component is only worth it when the
*verb* is shared (a period, a stroke, a confirmation), never to make two rooms
match.

**Divine machinery is the house, not a Habits-only permit.** The moodboard in
[`designrefs/`](../designrefs/) (catalog: [`DESIGN_REFS.md`](DESIGN_REFS.md))
is the keystone: machines you hold, 8-bit consoles, circuit-sigils, seraphs,
cursor flocks, mushrooms wired like synths. Materials (nacre, FR4, pewter),
lamps, CRTs, metal, **weather instruments**, and **equal-height modules** are
how you build it — plus nixie, stylus silver, pixel throws, and the impossible
motion the stills cannot show. Win95 MDI is one ancestor in that folder, not
the face to protect. The Home **TOP strip** (date + Review + points + Today's Progress) is
shared house chrome on all five Home tabs — not a feral Habits-only room.
Leftover width on that strip is equal-height square modules (review,
affirmation, weather-as-analog-meter); do not stretch wells. Daily Habits
may steal those materials *inside* the console (table, WILLPOWER
cartouche, **glass plasma grade meters**, recessed panel lamps, quiet 10-pip percent channel) the way Tidy
and Film DNA steal their own rooms. WILLPOWER week (small satellites, invert,
plate-click physics, PNG occlusion, Settings-only photograph) is that same
feral rule — the
[canonical example](#willpower-gems--example-of-perfect-design). Do not put
the file picker back on the plate.
Lists / Plan / Scheduler **contents** stay jewels, gems, orbs, and (on Plan)
opalescent chips. Their frames may leave the Win95 MDI still (`2a0002d93…`)
toward the machine. Do not Lucide the cabinet, do not reskin the whole app as
one TENO screenshot, and do not sand Plan opalescence or the Analytics
light-instrument interior to match a CRT overlay. Pixel, silver, and one
dissolve are allowed on those frames.
Hairline texture and the small user-replaceable WILLPOWER orb stay. Gunmetal is
a slow house-wide patina slider, not a theme pack. Header cabinet is shipped
(`AppHeader`); top tabs remain a later phase. Direct-use stills (desktop PCB plates; later orb/gem knockouts)
are listed in [`DESIGN_REFS.md`](DESIGN_REFS.md#images-that-could-be-used-directly).

---

## Checklist before shipping UI

- [ ] The frame reads as a vintage instrument (Y2K hardware, phosphor, 8-bit
      game UI, circuit-sigil) or as a quoted bevel — not as a SaaS product and
      not as a Windows replica kept gray on principle.
- [ ] Depth is nested (raised cabinet → sunken well → raised control), not a
      pile of floating cards. Gaps inside one instrument stay tight (4–8px).
- [ ] Objects (if any) are photographed, personal, luminous — not generic glyphs.
- [ ] Chrome was not “cleaned up” into glass, huge radii, or a brand gradient.
      Beauty that is milled, pixel, engraved, or surreal was allowed.
- [ ] Contents were not flattened to look more “usable.”
- [ ] Motion is a tool (organize, open, drag, close) or one impossible gesture
      on that verb. Not a looping sticker. `prefers-reduced-motion` snaps to
      the end state.
- [ ] Autogenerated values are marked (`~` + **est.** chip) and correctable.
- [ ] User-facing copy describes an event, a date, and a count. It does not
      say what the person is (`always` / `never` / `you are` plus a trait).
- [ ] You opened Home → Habits Daily and stole its instrument language (rail,
      analog furniture, CRT, skeuomorph) rather than inventing a second system.
      The screen can sit beside Habits *and* Lists Icons without a style break.
- [ ] If it is Analytics: **title + status** stay an instrument frame in this
      house; interior is **light
      instrument** (Karla, ink `#000` on `#c0c0c0` face gray, nested wells, phosphor traces — not
      cream paper, not dark CRT); pies + treemaps + mosaics; tooltips and a
      one-sentence instruction on every view. Item Types remains a Library view.
- [ ] If it is Plan: chrome is milled fascia (CRT title, view-key bay, period
      nameplate, metal keys); chips stay opalescent; no orange
      defaults. Text-field focus is navy `#000080` app-wide (`win95.css`), not
      only `--p-focus` in Plan; cells still
      breathe; period toolbar is roomy; no dark-slate / elegance rollback.
      Edit Event is a bounded Win95 window (~420–520px, navy caption, honest
      milled action keys) — not a stretched `sm:max-w-2xl` sheet. Week and month
      rails match Day (gems, 10-pip, search/sort/filter, period add).
- [ ] Dirty editors use the unsaved-changes house law (Save / Stay / Discard).
      Clean close is silent. Helper is `useUnsavedGuard`, not a per-dialog fork.
- [ ] Home TOP strip (date + Review + points + Today's Progress) is the same
      analog instrument on **all five** Home tabs — not Habits Cards vs wells.
      Wells stay narrow; leftover is **equal-height square modules** (IRIX
      cattle). Weather, if present, is a **gadget-wall instrument** (analog
      meter in a metal well), not a forecast card. Numerals centered.
      Fills use the three Habits tints. CRT is warmer, less glow, readable.
- [ ] Hairline grooves / engraved rules on furniture were kept (not sanded
      off as clutter). Habits toggles are analog rockers, not iOS pills.
      Habits sort is **Sort Habits**, not a native dropdown, and it sits above
      the grouped rockers (heatmap / **Day view** / hide / **Loading bar** /
      **Small LEDs**). Grade meters are noble-gas
      finger-tubes (rounded dome, plasma length = percent, per-grade discharge
      hue in that grade’s settings); WILLPOWER stays an orb. Today is a
      solid fill. Heatmap stays a light Daily sidebar mosaic. Completion % is
      the 10-square LED strip by default (numeric LED optional) — not pastel
      bars, not circular cell lamps reused as percents. Do not change
      completion math. WILLPOWER week (collect / invert / pin / stir /
      PNG occlusion / Settings-only orb) is the
      [canonical example](#willpower-gems--example-of-perfect-design) — do not
      put change-image back on the plate click.
- [ ] If it is a module view: its data is **Items**, not a private tree on
      `module.config.*` (that is the one thing a feral skin may not buy —
      [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md)).

## Easy alignments

Five small cuts that follow this law. Sand close and the ones marked shipped
are in. The rest stay unbuilt until asked. They are the first places the
running app still looks like a Windows dialog sitting on a painting.

1. **Header fascia** (`AppHeader`, `shell-chrome.css`). Recast the gray
   Friend / Review / System / Capture strip as milled silver key-wells (TENO,
   hiptop, Sharp). Same doors, same verbs, phosphor counts kept.
2. **Sand close (shipped, opt-in).** Add/Edit Habit crumbles from the title-bar
   × into countless tiny grains, which drop and pile under the window in the
   colors of its pixels (`useWindowSandClose`, ~3.6s). Not a fade of the intact
   rectangle. Any other captioned window can use the same hook. Reduced motion
   snaps shut.
3. **Top tabs** (`win95.css`, shipped). App tabs are a [milled fascia](#milled-fascia):
   one brushed bay, seven equal keys filling it, even padding, the active key a
   CRT with a round power lamp. Labels stay. Home’s five sub-tabs
   (`data-ui-name="Home tabs"` in `home-chrome.css`) use the same bay recipe;
   air sits above that strip, not between the keys and the panel.
4. **Lists auto-organize** (`FolderViewIcons.tsx`). The existing sweep leaves
   a fading trace of snowflakes or cursor-pixels. Same grid tool.
5. **Today’s friend nest.** Opening the bubble gives the bezel a short CRT
   power-on / glass-edge melt (IRIX cattle, CRT kitten). Contained to that well.

See also: [`DESIGN_REFS.md`](DESIGN_REFS.md) (Divine Machinery moodboard: how to
read every still, ideas, direct-use images, visual language — machines, art,
the impossible — and what not to costume the whole app as), [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md)
(what to build next), [`UI_NEXT.md`](UI_NEXT.md) (ranked UI lane),
[`UI_CRITIQUE.md`](UI_CRITIQUE.md) (observations, not a backlog),
[`components/Home/Habits/README.md`](../components/Home/Habits/README.md)
(favorite surface — look here first),
[`components/Lists/README.md`](../components/Lists/README.md),
[`app/README.md`](../app/README.md), [`components/Icons/README.md`](../components/Icons/README.md).
