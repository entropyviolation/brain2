# The Module Platform — north star

Brain2 grows new tools as **modules** on one item graph: adaptable, alive,
beautiful, and still one product. What exists today is compose and blueprints.
The rule that matters now is that a new module does not get a private database.

**Rung 0 — Compose (shipped).** Build a workspace from your lists and view
kinds, and author workflows on real item mutations.

**Rung 1 — Blueprint (shipped).** A `ModuleDefinition` is that workspace as
data: bound lists, attribute extensions, views, and workflows. Save it,
re-instantiate it, export and import the JSON.

**The rule.** `module.config` holds bindings, layout, and preferences. It does
not hold the user's records. **House Cleaning** (`lib/house-cleaning.ts`,
`module.config.houseCleaning`) and **Trip Itinerary** (`lib/trip-itinerary.ts`,
`module.config.tripItinerary`) are the two existing violations. They are debt,
not the pattern to copy. The full account is "Debt" below.

A module that keeps its records as Items is a room in the house — searchable
from Cmd/Ctrl-K, schedulable, analyzable, ingestible by text message — because
it never invented its own storage. **Analytics is the heart** of that graph:
collection, presentation, analysis, and the next tool grown from the same mass.
**Infinite adaptability, one nervous system.** New organs grow on that same
graph.

The next platform step is **rung 2**, a hand-written manifest: one serializable
object, written by hand. Rung 3 (paste / port an arbitrary `.tsx`), rung 4
(LLM mapping), rung 5 (share), and the sixth workflow law are **UNBUILT**.
They live in the appendix.

---

## The five laws

These are not style preferences. Breaking one costs a module its citizenship.
They are in force.

1. **Item is the only noun.** A chore, a plant, a film, a trip day, a cleaning
   check — each is an `Item` with a `type`, `tags`, `links`, and `attributes`.
   A module may define new **item types** and **attribute schemas**. It may not
   define a new storage shape for its domain.
2. **Config is layout, not domain.** `module.config` holds bindings, view
   layout, and preferences. It does **not** hold the user's data. A private tree
   of records on `module.config.*` is a **shadow database** — see "Debt" below.
3. **One write door.** Modules mutate the world through the same path as the
   rest of the app (`task-store` / repository), so workflows, implied actions,
   undo, persist, and future sync observe every change. No module writes
   `localStorage` directly.
4. **Skins stay feral.** A module's chrome, CSS, overlays, motion, and density
   are its own and are *allowed to be ugly, old, and specific*
   ([`DESIGN_STYLE.md`](DESIGN_STYLE.md)). Interiors may look unique; they must
   never **mean** unique.
5. **Deterministic after install.** Nothing at runtime depends on a model
   being reachable. A saved module runs offline, forever, from its plain
   serialized definition.

> Law 4 + Law 1 together are the aesthetic thesis: **different rooms of the same
> house.** Not one Card. Not one schema-less pocket per room either.

The same laws keep the map a map. Item-as-only-noun refuses to split one life
into separate databases for body, mood, place, and plan. Deterministic after
install leaves the map-maker's assumptions as a definition you can read, not a
hidden process. Exporting a definition without personal records is time-binding
between people: the next person starts from the structure. Orders of
abstraction, and the slices that extend them, are
[`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md).

A sixth law — workflow intent, dry run, pause, and an undoable run log — is
specified and not in force. It is CY-10 and it is not built. See the appendix.

---

## Citizenship

A module whose records are Items belongs to the same house:

- Its records appear in **Lists** and in **global search**.
- Its dated things land in **Scheduler / Plan**.
- Its effort lands in **Tracking** minutes and **Habits** via tags.
- Its completions award **points** and feed **Objectives / Goals**.
- Its numbers are chartable in **Analytics**.
- A text from a phone can create one of its records through **ingest**.
- Undo, backup, and (eventually) sync cover it, because it never invented its
  own storage.

That last clause is the engineering problem the five laws exist to keep true.
House Cleaning and Trip Itinerary do not get this list, because their records
are not Items. That is the debt, not a style of module to imitate.

---

## Debt: the two shadow databases — **partially retired (Wave 10)**

Tidy and Trip **write records to Items** first (`lib/house-cleaning-items.ts`,
`lib/trip-itinerary-items.ts`). Module Lists import is the same projection those
writers call. Stylesheets (`tidy.css`, itinerary CSS) are untouched.

**One-release compatibility shim:** `module.config.houseCleaning` and
`module.config.tripItinerary` are still **dual-written** and still read when no
Items exist yet (or for day meta / session chrome that is not on Items —
Tidy timer/filters/stuck/plan runs; Trip city/weather/sunrise). Do not copy a
private record tree for a new module. After this release window, drop the
config record trees and keep only prefs/session slices on `module.config`.

**Still deferred:** full two-way sync (a Lists-tab edit of a chore that Tidy
must not overwrite on next open). Module Lists import remains one-way for
mapped fields until that lands
([`components/Lists/MODULE_LISTS.md`](../components/Lists/MODULE_LISTS.md)).

**GradSearch** is a different exception: the research catalog ships as
`components/Modules/workspace/gradsearch/data.json` (the standalone `data.js`
store) and personal marks — favorites, notes, weights, overrides, verified
edits, hidden programs — stay in the same `gs-*` localStorage keys as that app.
It does not write `module.config` and it does not create Items. That is so the
explorer can stay the same screen, not a pattern for new user data.

**Shape now (Operations pattern):**

- A cleaning area → a nested list under Whole house.
- A chore / needed row → an Item with `importance`, estimates, actuals, area.
- A trip day → a nested list; a schedule row → an Item (`flight` type when a flight).
- Stuck mode, sidequests, plan tiers, the DNA blender → **behavior and skin**
  (session on config for now).

Tidy keeps its stylesheet and its genius. The pocket is the shim, not the home.

---

## Next platform step: a hand-written manifest (rung 2)

Rung 2 is the next platform step. It does not outrank the private-database
rule, and it is not the install wizard. A person writes one serializable
object. No functions. No pasted `.tsx`. No model.

```ts
interface ModuleManifest {
  id: string
  name: string
  version: string

  /** New nouns this module needs, merged into the item-type registry. */
  itemTypes?: ItemTypeDefinition[]

  /** Lists it binds or creates, with attribute schemas layered on. */
  lists?: ModuleListBinding[]

  /** Screens. Either stock view kinds or one custom component. */
  views: Array<
    | { kind: ModuleViewKind; config: ModuleViewConfig }
    | { kind: "custom"; component: string; css?: string }
  >

  /** Automations, expressed in the existing workflow JSON. */
  workflows?: WorkflowDefinition[]

  /** What this module is allowed to do to the brain. */
  bridges: ModuleBridgeGrant[]
}

type ModuleBridgeGrant =
  | { bridge: "items";    access: "read" | "write"; types?: string[] }
  | { bridge: "tracking"; tags: string[] }          // paint minutes
  | { bridge: "habits";   habitIds: string[] }      // increment
  | { bridge: "points" }                            // award on completion
  | { bridge: "schedule" }                          // write dates
  | { bridge: "docs" }                              // author note bodies
  | { bridge: "ingest";   phrases: string[] }       // claim a text prefix
```

**Bridges are the contract made concrete and safe.** "Modules can impact the
brain" becomes an explicit, reviewable, revocable list on that manifest — the
same way `Operation.trackingTagIds` already lets an operation feed habits.
Nothing is ambient. Declaring bridges by hand is rung 2. Walking an arbitrary
outside app through detect → map → dry-run → install is rung 3, and it is not
built.

---

## Custom views are welcome; custom databases are not

A module may ship one (or a few) **custom components** with their own CSS and
their own soul. `TidyView` and `FilmDnaView` already do.
[`DESIGN_STYLE.md`](DESIGN_STYLE.md) protects that chrome. An install wizard
that pastes an outside `.tsx` and ports it is the UNBUILT appendix.

The rule is where the data lives, not how the screen looks:

| Allowed | Not allowed |
|---------|-------------|
| Bespoke CSS, overlays, timers, drag physics, sound | A private record tree on `module.config.*` |
| Reading a narrow Item query with its own selectors | Its own `localStorage` key |
| Writing through granted bridges | Its own date/undo/backup logic |
| Its own vocabulary in the UI ("subarea", "stuck") | Its own noun in storage |

---

## How we get there from here

Sequenced, foundation first. Types are the load-bearing wall; shared chrome is
paint. The private-database rule is already in force (law 2). On the ladder,
the next platform step is rung 2, a hand-written manifest. The list below is
the refactor order that makes that step honest.

1. **Make `Item` honest.** Retire the dual `title` / `description`
   ([`CANONICAL_FIELDS.md`](CANONICAL_FIELDS.md)). Every module inherits this
   vocabulary — two names for "what this is called" multiplies the confusion
   by infinity. The old `category` / `categories` collision is already
   resolved: they are now `Task.stage` (lifecycle bucket) and `Task.lists`
   (list membership), two real axes that stay two fields.
2. **One write door.** Consolidate mutation on a single API that workflows,
   implied actions, undo, persist, and future sync all observe: `task-store` is
   the implementation, `taskRepository` the caller-facing seam. Repositories stay
   for tests and sync, not as a parallel style — and a *third* API would be a
   sixth door, not one. New code uses `commitItemEdit` / `applyLinkedEffects`;
   see the write-door note in [`ARCHITECTURE_MODULARITY.md`](ARCHITECTURE_MODULARITY.md).
3. **Period as data.** One period cursor (day/week/month/quarter/year + the
   selected date) that Habits / To Do / Plan / Tracking / Reviews read. This is
   here, ahead of the chrome, because a shared *day* is data; shared chevrons
   are not, and the three visual dialects stay exactly as they are.
4. **Name the bridges** as data (`ModuleBridgeGrant`) and route the ones that
   already exist informally — tracking tags, habit increments, points, plan sync,
   ingest phrase claims — through them.
5. **Ship the manifest** (rung 2) and re-express the existing templates as
   manifests. If Itinerary and Budget cannot be stated as manifests, the manifest
   is wrong.
6. **Migrate the shadow databases** onto Items, keeping both stylesheets
   untouched. **Partial (Wave 10):** Items are the write path; config dual-write
   shim for one release; drop the shim and finish two-way Lists sync next.
7. **Then** harvest shared chrome, if it still seems worth it — `usePaintStroke`,
   `confirm()`, and one `ItemDetail` with a density mode. Doing this before the
   manifest exists would freeze today's chrome as the platform's API.

See [`ARCHITECTURE_MODULARITY.md`](ARCHITECTURE_MODULARITY.md) for the same
sequence expressed as refactors, and for what deliberately is *not* worth
extracting. Screen work that must not wait on rung 2 lives in
[`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) (Waves 0–8 before Wave 10).

## Beauty clause

The measure of success is not a component library. It is that one day, one
house, one trip, one film taste, one climbing season, and one practice habit are
all addressable in the same graph — searchable, ingestible, schedulable,
undoable — while each of their interiors still feels like a different room of one
vintage machine someone loved.

Never SaaS the frame. Never plain the contents. Never give a
room its own basement.

---

## Appendix — UNBUILT

Not the platform. Not in force. Not a pattern to design toward until the rungs
above exist. Nothing here skips the private-database rule, and nothing here
skips the hand-written manifest.

### Sixth law (CY-10) — specified, not in force, not built

Every workflow states its intent, can show a dry run, pauses when it fires too
often, and keeps an undoable run log. Workflows that write habits, points, or
Tracking cannot trigger each other. That is Wave 15, CY-10, in
[`cyberneticsbrain2.md`](cyberneticsbrain2.md) Part 3. Do not treat it as
already in force.

### Later rungs

| Rung | What it means | Status |
|------|----------------|--------|
| **3 — Port** | An **Install wizard** takes an arbitrary `.tsx` app (paste, file, or folder) and walks: *detect state → map to Items → choose views → grant bridges → dry-run → install*. | **UNBUILT** |
| **4 — Assist** | The **cheapest adequate LLM** does the tedious half of rung 3 once, at install time: read the pasted component, propose the manifest and the state→Item mapping, and rewrite the component's reads/writes against the module SDK. Output is reviewable code + JSON. Then the model is never needed again. | **UNBUILT** |
| **5 — Share** | Install from a file, a URL, or a pasted blob. Modules become gifts. | **UNBUILT** |

**Rung 4 is assistance, not magic.** The model is a *porting compiler* aimed at
a narrow, checkable target: a manifest plus a diff. The user sees both. A bad
port is rejected at the dry-run, not discovered three weeks later in their data.
Law 5 already requires that nothing at runtime depends on a model. This assist,
if it is ever built, stays install-time only.

#### Why an LLM at all, and which one

Porting is mechanical, boring, and pattern-shaped: find `useState` trees, name
the records, guess attribute types, rewrite mutations to the SDK. That is the
cheapest work a model can do and the most tedious work a person can do. It is
not built.

Constraints, so this never becomes a dependency:

- **Cheapest adequate model**, chosen for structured output over prose.
- **Install-time only.** Never in a render path, never in a write path.
- **Output is reviewable artifacts** — a manifest, a mapping table, a diff.
  Editable by hand. The wizard works with the model unavailable; you just fill
  the mapping in yourself.
- **Dry-run before commit.** The wizard instantiates against a scratch snapshot,
  shows the Items it would create, and asks.
- **No user data required.** It reads the component's *code* plus your schema
  names — not your journal.

If those rungs are ever built, the order is: the Install wizard (rung 3), manual
mapping first, with the dry-run against a scratch snapshot built before any
assist; then the LLM assist (rung 4) on the wizard's mapping step; share
(rung 5) after that. They come after rung 2 and after the shadow databases are
gone. They are not how a module is added today.

The picture those rungs were written for — write, paste, or generate a small
`.tsx` app and have it exist by dinner, ported onto Items — stays here until
someone builds it.
