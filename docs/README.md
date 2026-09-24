# `docs/` — Project documentation

Brain2 is intended as a **new type of software**: a **living, perfect second
brain** — adaptable, alive, beautiful, cutting-edge, infinite. These files are
how that ambition stays load-bearing while the working tree stays honest. The
root [`README.md`](../README.md) holds the vision and what runs today; this
folder holds the north stars, checklists, and screen truth that keep the
organism from becoming a pile of features.

**Key points (do not lose them in a feature list):**

1. **Item, used everywhere.** Capture once; connect and use in as many rooms as
   the record can honestly serve. Isolation is a bug.
2. **Analytics is the heart.** Mass personal data and information-resource
   collection, presentation, and analysis — and the engine that turns that mass
   into endless tools. Other tabs write the vault; this is where the vault
   becomes instrument.
3. **Map, loop, meaning.** A record stays a map. The miss between an order and
   what came back becomes the next input. What lines up without a cause is
   shown as meaning, and never sold as a reason. The join — how to use those
   three ideas to perfect the house — is
   [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md). The work orders stay the work
   orders: map
   [`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md), meaning
   [`JungBrain2.md`](JungBrain2.md) (essay [`jungideas.md`](jungideas.md)),
   loop [`cyberneticsbrain2.md`](cyberneticsbrain2.md). Not built yet.

The product is **Brain2**. Chrome is **BRAIN2**. Persist keys, IPC prefixes, and
CLI env vars still say `cogs` on purpose — see the root [`README.md`](../README.md)
and [`lib/app-brand.ts`](../lib/app-brand.ts).

| File / folder | Purpose |
|---------------|---------|
| `FUTURE_WIDGET_IDEAS.md` | Potential Home overview squares (caption + CRT + footer). Solar remainder, Tracking now, Night well, Harvest leftover, and Inbox mill shipped; the rest are plans, including meaning-layer sketches ([`jungideas.md`](jungideas.md)), map-and-territory sketches ([`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md)), and steersman sketches ([`cyberneticsbrain2.md`](cyberneticsbrain2.md) Part 3). |
| `SPEC_MAPPING.md` | Section-by-section mapping of `Cognitive_Management_System_Spec.docx` (Brain2 v2) to the codebase: what is implemented (✅), partial (🟡), missing (⛔), or deferred (🕓), plus the spec-facing remainder. **Storage target:** MongoDB (replacing the spec's SQLite recommendation) for flexible documents, semantic/fuzzy/advanced search, and aggregation-based routing. For *what to do next*, start at [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md). |
| `MODULE_PLATFORM.md` | **North star for Modules.** The end goal: install any small `.tsx` app into the second brain through a port wizard (a cheap LLM assists the mapping once, at install time), so every module is a lens on the same `Item` graph — searchable, schedulable, ingestible, undoable — with feral per-module skins. Five laws, the install ladder, the manifest + bridge-grant shape, and the shadow-database debt. Read this before designing anything module-shaped. |
| `ARCHITECTURE_MODULARITY.md` | What is already a platform vs duplicated chrome, and the foundation-first refactor order (canonical fields → one write door → period cursor → manifest/installer) that `MODULE_PLATFORM.md` depends on. Also the deliberate *do not extract* list. |
| `MESSAGE_INGEST.md` | Phone-message ingest (**BIM**): matching precedence, manuals (`info` / `{prefix} info` / `{prefix} commands` / `all commands`), grocery/`needed`/activity/discrete/habit keywords, dedupe, Analytics text tabs, hub, pin, pairing, iOS Shortcuts, OCR. |
| `BIM_COMMANDS.md` | **Complete BIM command catalog** — every parser verb, alias, expansion, habit/discrete preset, bulk dump form, morning GM reply, and retired bare `g`. Mirrors in-chat `all commands`. |
| `shortcuts/` | iOS Shortcuts. Signed AirDrop files: [`Dump iPhone Notes to Brain2.shortcut`](shortcuts/Dump%20iPhone%20Notes%20to%20Brain2.shortcut) ([install](shortcuts/dump-iphone-notes-to-brain2.md) — delete any old copy that asks you to “update Shortcuts”), [`Screen Time to Brain2.shortcut`](shortcuts/Screen%20Time%20to%20Brain2.shortcut) ([install](shortcuts/screen-time-to-brain2.md) — not Apple Screen Time export), [`iPhone Call to Brain2.shortcut`](shortcuts/iPhone%20Call%20to%20Brain2.shortcut) + [`iPhone Text to Brain2.shortcut`](shortcuts/iPhone%20Text%20to%20Brain2.shortcut) ([install](shortcuts/iphone-calls-and-texts-to-brain2.md) — not Recents or Messages DB), [`Location to Brain2.shortcut`](shortcuts/Location%20to%20Brain2.shortcut) ([install](shortcuts/iphone-location-to-brain2.md) — Arrive/Leave + Live Location; `gps:`). |
| `DESIGN_STYLE.md` | Visual / UI gold standard. Brain2 is a **vintage machine that knows it is a painting**: motif (Y2K / 8-bit / phosphor), cabinet (orbs, velvet, jewels), and the **impossible** (a window that melts, a flock of cursors — rare, on a real verb). **Never SaaS the frame. Never plain the contents. Never costume the whole app as one still.** **Home → Habits** is the favorite interior; **Lists Icons** is the favorite cabinet (velvet + orbs + auto-organize). The shell is in bounds for the same three layers — a gray Windows dialog is the look to leave. Object chrome: photoreal **chrome + black-mirror** wells ([Willpower gems](DESIGN_STYLE.md#willpower-gems--example-of-perfect-design), [Chrome and black mirror](DESIGN_STYLE.md#chrome-and-black-mirror)). **Milled fascia** + [Fascia rollout](DESIGN_STYLE.md#fascia-rollout) (looks-only priority for remaining plain rooms). **Depth & spacing**: nested bevels, tight packing. See [`DESIGN_REFS.md`](DESIGN_REFS.md). |
| `DESIGN_REFS.md` | Inventory of `designrefs/` (49 stills). How to read each picture as **machine**, **art**, **ancestor**, or the **impossible** the still cannot show. Lanes: **ideas**, images used **directly** (desktop PCB plates in `public/pcb/`; Tracking pen-tray stills in `public/pen-tray/`; later orb/gem knockouts), and visual language to **apply**. Keystones lead with mushroom desk, TENO, cursor angel, seraph, snowflake, cat traces, Pocket PC — not Win95 MDI. Held machines (Pocket PC, Motorola, hiptop, Sharp, Kyocera, Sony) are cataloged. **Do not costume the whole app** as one still. |
| `PLAN_OF_ACTION.md` | **Combined work order** for multiple agents: Person B’s screen brief, UI sequence, analytics honesty, period cursor, ontology continuation, and the explicit do-not list. Conflicts between briefs are resolved here. Start here when picking the next slice of work. Wave 13 points at the map-and-territory build. Wave 14 points at the meaning-layer build ([`JungBrain2.md`](JungBrain2.md)). Wave 15 points at the steersman build ([`cyberneticsbrain2.md`](cyberneticsbrain2.md) Part 3). |
| `MAP_LOOP_MEANING.md` | **The join.** How map (Korzybski), loop (Wiener), and meaning (Jung) perfect Brain2 as one house: honest records, a miss that steers, a coincidence that is shown and never causalized. Laws for builders. Not the queue — Waves 13–15 stay the work orders. |
| `ScienceandSanityBrain2.md` | **Map and territory.** How Brain2 already practices general semantics (orders of abstraction, dating, non-allness, description before inference, time-binding), and the ten-slice plan that extends it (GS-1 … GS-10). The product never names the book. Execute Part 3; do not re-sequence from the essay. |
| `jungideas.md` | **Source essay.** Jung’s Synchronicity and Stages of Life read against Brain2. Parallels only. The Stages PDF in `litrefs/` is corrupted; those points are paraphrased. |
| `JungBrain2.md` | **Meaning-layer build.** Ten slices (JG-1 … JG-10): coincidence log, named outliers, exception interviews, affect on capture, dream symbols, Ask sideways, friend-interest retirement, life seasons, yearly afternoon prompts. Meaning group is on by default and can be hidden. A coincidence is shown and never called a cause. Not built yet. Execute that file; do not re-sequence from the essay. |
| `cyberneticsbrain2.md` | **The steersman.** How Brain2 already practices control and communication (sense, memory, effectors, feedback), and the eleven-slice plan that closes the loop (CY-1 … CY-11). One derived gap, three speeds, silence inside a band. The product never names the book. Not built yet. Execute Part 3; do not re-sequence from the essay. |
| `brain2taoism.md` | **Source essay.** Eva Wong’s *Taoism: An Essential Guide* read against Brain2: 60 parallels, five practices (Reserves, Almanac, Gates, Hearth ledger, Foundations), and five changes to existing rooms. Screen words stay plain. Parallels and proposals; not a work order. Ideas 395–464 in [`BRAIN2_FEATURE_IDEAS.md`](BRAIN2_FEATURE_IDEAS.md). |
| `FRIEND_COMPANION.md` | North-star plan for **today's friend** (personality, missions, rewards, clock). Pack gallery, picker, the friend instrument, accept-until-midnight missions, list-bias beads, and first rewards **shipped**; clock / trinkets / learned personality later. |
| `UI_NEXT.md` | Ranked **UI-only** executable list toward `DESIGN_STYLE.md`. Subordinate to `PLAN_OF_ACTION.md`. What to do in order, and what not to “fix” from the critique. |
| `UI_CRITIQUE.md` | Section-by-section interface review: **three concrete improvements for every top-level tab and sub-tab**, plus the item-detail surfaces and global dialogs, judged against `DESIGN_STYLE.md` and the `screenshots/` captures. Ends with the five cross-cutting patterns (oversized empty states, stacked controls, duplicated choices, destructive/primary parity, two off-style tabs). Observations only — do **not** work top to bottom; execute via `PLAN_OF_ACTION.md` / `UI_NEXT.md`. |
| `BRAIN2_FEATURE_IDEAS.md` | Large idea bank of potential buildouts, mapped onto the data model. A menu, not a commitment. Ideas 1–160 from the `Brain2Ideas` brain-dump; 161–280 from later prototype and theory docs; **281–394 (Expansion III)** from the map, the loop, and the meaning layer; **395–464 (Expansion IV)** from [`brain2taoism.md`](brain2taoism.md). The “realistic and worth doing” slice has a Sep 2026 **shipped / partial / not shipped** audit in-file; leftover top 10 is [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) Wave 11. |
| `CANONICAL_FIELDS.md` | Field-level authority for the data model: canonical vs legacy vs derived. Title-as-record has shipped; remaining naming debt is parked-note `description` vs `body`. Wave 10 of the plan. |
| `AGENT_COORDINATION.md` | Live lock table when more than one agent is editing. Lanes for new work are in `PLAN_OF_ACTION.md`. |
| `COUNTS_AS.md` | Tracking pen **nesting**: what "Ocean Beach counts as San Diego" does and does not mean, the searchable parent picker, the colored chain diagram, and the design for **parallel counts-as chains** (planned, deliberately not implemented). |
| `PEN_ACTION_FORMATS.md` | Tracking pen **default action formats**: how a painted block becomes a Done-today row, the template variables, which template wins, and how the row stays in step with the block. |
| `tree.md` | Annotated, clickable index of the whole repository (pairs with `tree.txt`). |
| `tree.txt` | Plain `tree` command output (regenerate with `npm run tree`). |
| `screenshots/` | Full-page PNG captures of every major app view plus matching `.txt` inventories of on-screen controls. Re-capture with `npm run capture-screenshots` while `npm run dev` is running. See [`screenshots/README.md`](screenshots/README.md). |

### Screenshot index

See [`screenshots/README.md`](screenshots/README.md) for the full index (56 PNG +
56 `.txt` sidecars). Quick map:

| Prefix | Area |
|--------|------|
| `01-*` | Home → Habits — **favorite / most developed UI**; look here first |
| `02-*` | Home → Plan |
| `03-*` | Home → To Do |
| `04-*` | Home → Goals |
| `05-*` | Lists (folder + content displays) |
| `06-*` | Scheduler |
| `07-*` | Analytics studio (title+status Lists; ~26 views). Recapture `07-analytics*` with `COGS_FRESH=0`. |
| `08-*` | Home → Tracking |
| `09-*` | Modules |
| `10-*` | Operations |
| `12-*` | Docs *(planned — not captured yet)* |
| `20-*` | Global header dialogs |
| `21-*` | Item detail popup |

See also the root `README.md` for the project overview and repository map, the
per-folder `README.md` files for file-by-file documentation, and
[`DESIGN_STYLE.md`](DESIGN_STYLE.md) for the visual gold standard.
