# The Module Platform — north star

This is how Brain2 stays a **new type of software** instead of a pile of mini-apps:
a **living application** that can grow forever — adaptable, alive, beautiful,
cutting-edge, infinite — without splitting into a new product each time you want
a new tool.

> **The end goal.** You write, paste, or generate a small `.tsx` app — a chore
> tracker, a plant-watering log, a climbing-grade pyramid, a wine cellar, a
> practice-session metronome — and **install** it into Brain2 through a wizard. On
> the way in it is *ported*: its state is mapped onto Items, its screens become
> views, its actions become writes to the same brain everything else reads. From
> then on it is not a guest. It is a room in the house — searchable from
> Cmd/Ctrl-K, schedulable, analyzable, ingestible by text message, and able to
> change your habits, points, plans, and day.

Brain2 is the **living perfect second brain**: one graph holding everything you
know, intend, and did. An installed module's records are not guests — they are
**items**, captured once and then **connected and used in as many rooms as they
can honestly serve**. **Analytics is the heart** of that graph: collection,
presentation, analysis, and the next tool grown from the same mass. Modules are
how that brain grows new organs without a new database, a new sync path, or a
new ontology. **Infinite adaptability, one nervous system.** That is the
revolutionary claim: not more features, a body that can keep becoming.

This document is the commitment the rest of the module docs answer to.

---

## The dream, stated plainly

A person should be able to say *"I want a thing that tracks X the way I think
about X"* and have it exist by dinner — looking like its own room of the same
vintage machine, behaving unlike anything else in Brain2, and yet:

- Its records appear in **Lists** and in **global search**.
- Its dated things land in **Scheduler / Plan**.
- Its effort lands in **Tracking** minutes and **Habits** via tags.
- Its completions award **points** and feed **Objectives / Goals**.
- Its numbers are chartable in **Analytics**.
- A text from a phone can create one of its records through **ingest**.
- Undo, backup, and (eventually) sync cover it for free, because it never
  invented its own storage.

That last clause is the whole engineering problem. Everything below exists to
keep it true while the number of modules goes to infinity.

---

## The five laws

These are not style preferences. Breaking one costs a module its citizenship.

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
5. **Deterministic after install.** An LLM may help *port* a module. Nothing at
   runtime depends on a model being reachable. Installed modules run offline,
   forever, from plain serialized definitions.

A sixth law is specified and not yet built. Every workflow states its intent,
can show a dry run, pauses when it fires too often, and keeps an undoable run
log. Workflows that write habits, points, or Tracking cannot trigger each
other. That is Wave 15, CY-10, in
[`cyberneticsbrain2.md`](cyberneticsbrain2.md) Part 3. Do not treat it as
already in force.

> Law 4 + Law 1 together are the aesthetic thesis: **different rooms of the same
> house.** Not one Card. Not one schema-less pocket per room either.

The same laws keep the map a map. Item-as-only-noun refuses to split one life
into separate databases for body, mood, place, and plan. Deterministic after
install leaves the map-maker's assumptions as a manifest you can read, not a
hidden process. Exporting a definition without personal records is time-binding
between people: the next person starts from the structure. Orders of
abstraction, and the slices that extend them, are
[`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md).

---

## The install ladder

Where we are and where each rung leads. Nothing skips a rung.

| Rung | What it means | Status |
|------|----------------|--------|
| **0 — Compose** | Build a workspace by hand: bind your lists, pick view kinds, author workflows. | ✅ shipped |
| **1 — Blueprint** | `ModuleDefinition` is a serializable app: bound lists + attribute extensions + views + workflows. Save, re-instantiate, export/import JSON. | ✅ shipped |
| **2 — Declare** | A **module manifest** (below) is the whole contract: types, attributes, views, bridges, permissions. A hand-written manifest installs with no code. | ⛔ next |
| **3 — Port** | An **Install wizard** takes an arbitrary `.tsx` app (paste, file, or folder) and walks: *detect state → map to Items → choose views → grant bridges → dry-run → install*. | ⛔ |
| **4 — Assist** | The **cheapest adequate LLM** does the tedious half of rung 3 once, at install time: read the pasted component, propose the manifest and the state→Item mapping, and rewrite the component's reads/writes against the module SDK. Output is reviewable code + JSON. Then the model is never needed again. | ⛔ |
| **5 — Share** | Install from a file, a URL, or a pasted blob. Modules become gifts. | 🕓 |

**Rung 4 is assistance, not magic.** The model is a *porting compiler* aimed at
a narrow, checkable target: a manifest plus a diff. The user sees both. A bad
port is rejected at the dry-run, not discovered three weeks later in their data.

---

## The module manifest (rung 2 target)

One serializable object. No functions. This is what an installed module *is*.

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

**Bridges are the dream made concrete and safe.** "Modules can impact the brain"
becomes an explicit, reviewable, revocable list the wizard shows you before
install — the same way `Operation.trackingTagIds` already lets an operation feed
habits. Nothing is ambient.

---

## Custom views are welcome; custom databases are not

A module may ship one (or a few) **custom components** with their own CSS and
their own soul — `TidyView`, `FilmDnaView`, a hand-drawn seed-starting calendar.
That is rung 3's whole point, and [`DESIGN_STYLE.md`](DESIGN_STYLE.md) protects
it.

The rule is where the data lives, not how the screen looks:

| Allowed | Not allowed |
|---------|-------------|
| Bespoke CSS, overlays, timers, drag physics, sound | A private record tree on `module.config.*` |
| Reading a narrow Item query with its own selectors | Its own `localStorage` key |
| Writing through granted bridges | Its own date/undo/backup logic |
| Its own vocabulary in the UI ("subarea", "stuck") | Its own noun in storage |

## Debt: the two shadow databases

Two shipped modules predate these laws and currently break Law 2. This is stated
plainly so no future module copies the pattern:

- **Tidy** (`lib/house-cleaning.ts`) keeps areas, hierarchical chores, subareas,
  needed items, stuck sessions, and plan tiers on `module.config.houseCleaning`.
- **Trip Itinerary** (`lib/trip-itinerary.ts`) keeps days, plans, notes, and
  flights on `module.config.tripItinerary`.

The cost is exactly the citizenship list above: a stuck session is not ingestible,
and Tidy/Trip still *write* a private tree. **One-way Module Lists import** now
projects Tidy chores (Whole house → area sublists, with priority, estimates,
actuals, completed, nested subtasks) and Trip days into ordinary lists so Lists
and search can see them (`lib/module-list-import.ts`,
[`components/Lists/MODULE_LISTS.md`](../components/Lists/MODULE_LISTS.md)). They
are still rooms with a side door until two-way sync makes Items the write path.

**GradSearch** is a different exception: the research catalog ships as
`components/Modules/workspace/gradsearch/data.json` (the standalone `data.js`
store) and personal marks — favorites, notes, weights, overrides, verified
edits, hidden programs — stay in the same `gs-*` localStorage keys as that app.
It does not write `module.config` and it does not create Items. That is so the
explorer can stay the same screen, not a pattern for new user data.

**Target shape** — the model already proven by Operations, where an operation is
a `Task` with `categories` / `panels` / `trackingTagIds` attributes rather than a
bespoke record:

- A cleaning area → a list (or an Item with children).
- A chore → an Item with `importance`, `estimateMinutes`, `actualMinutes`, `area`.
- A trip day → a dated Item; a flight → a `flight`-type Item (that type exists).
- Stuck mode, sidequests, plan tiers, the DNA blender → **behavior and skin**,
  computed from Items on the fly.

Tidy keeps its stylesheet and its genius. It loses its pocket.

---

## Why an LLM at all, and which one

Porting is mechanical, boring, and pattern-shaped: find `useState` trees, name
the records, guess attribute types, rewrite mutations to the SDK. That is the
cheapest work a model can do and the most tedious work a person can do.

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

---

## How we get there from here

Sequenced, foundation first. Types are the load-bearing wall; shared chrome is
paint.

1. **Make `Item` honest.** Retire the dual `title` / `description`
   ([`CANONICAL_FIELDS.md`](CANONICAL_FIELDS.md)). Every module the platform
   ever installs inherits this vocabulary — porting onto two names for "what
   this is called" multiplies the confusion by infinity. The old
   `category` / `categories` collision is already resolved: they are now
   `Task.stage` (lifecycle bucket) and `Task.lists` (list membership), two real
   axes that stay two fields.
2. **One write door.** Consolidate mutation on a single API that workflows,
   implied actions, undo, persist, and future sync all observe: `task-store` is
   the implementation, `taskRepository` the caller-facing seam. Repositories stay
   for tests and sync, not as a parallel style — and a *third* API would be a
   sixth door, not one.
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
   untouched. Tidy is the proof that a 2k-line mini-app can be a first-class
   citizen.
7. **Build the Install wizard** (rung 3) — manual mapping first, with the
   dry-run against a scratch snapshot built before any assist.
8. **Add the LLM assist** (rung 4) to the wizard's mapping step.
9. **Then** harvest shared chrome, if it still seems worth it — `usePaintStroke`,
   `confirm()`, and one `ItemDetail` with a density mode. Doing this earlier
   would freeze today's chrome as the platform's API.

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
