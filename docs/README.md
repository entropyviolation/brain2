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
   [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md).
   [`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md),
   [`JungBrain2.md`](JungBrain2.md) (essay [`jungideas.md`](jungideas.md)),
   [`cyberneticsbrain2.md`](cyberneticsbrain2.md),
   [`brain2taoism.md`](brain2taoism.md), and
   [`BRAIN2_FEATURE_IDEAS.md`](BRAIN2_FEATURE_IDEAS.md) are source material.
   The slices they describe are unbuilt. Build only an open wave in
   [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md).

The product is **Brain2**. Chrome is **BRAIN2**. Live persist keys are
`brain2-*`; `cogs-*` is a legacy alias — see
[`lib/app-brand.ts`](../lib/app-brand.ts) and
[`lib/storage-keys.ts`](../lib/storage-keys.ts).

| File / folder | Purpose |
|---------------|---------|
| `FUTURE_WIDGET_IDEAS.md` | Potential Home overview squares (caption + CRT + footer). Solar remainder, Tracking now, Night well, Harvest leftover, and Inbox mill shipped; the rest are plans, including meaning-layer sketches ([`jungideas.md`](jungideas.md)), map-and-territory sketches ([`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md)), and steersman sketches ([`cyberneticsbrain2.md`](cyberneticsbrain2.md)). |
| `widget-improvement/` | Research reports on each Home overview widget and each Module card, read from the live Electron localStorage vault on 9 Oct 2026 ([`widget-improvement/README.md`](widget-improvement/README.md)). Implementation plans live in [`widget-improvement/plan/`](widget-improvement/plan/). |
| `analytics-vision/` | The analytics tab this vault can support, from Tracking, Habits, Plan, Now, and Telegram ([`01-tracking.md`](analytics-vision/01-tracking.md) through [`05-telegram.md`](analytics-vision/05-telegram.md)), synthesized in [`ANALYTICS_VISION.md`](analytics-vision/ANALYTICS_VISION.md). Ignores the current analytics UI on purpose. [`06-language.md`](analytics-vision/06-language.md) is an unbuilt intention to read stored prose (task why, why-not, gratitude, plan text) with classical counts beside sentiment, machine learning, language models, and embeddings. |
| `analytics-plan/` | Build briefs for a later redesign of the shipping Analytics tab, written from those inventories ([`analytics-plan/README.md`](analytics-plan/README.md)). Keeps every current view id and its math. Adds Day, Shape, Clock, the twelve joins, and a Language room (word clouds beside sentiment, machine learning, language models, and embeddings). Does not change the tab. |
| `SPEC_MAPPING.md` | Section-by-section mapping of `Cognitive_Management_System_Spec.docx` (Brain2 v2) to the codebase: what is implemented (✅), partial (🟡), missing (⛔), or deferred (🕓), plus the spec-facing remainder. Storage is localStorage; the sync that exists is the manual phone hub. Atlas, `@brain2/core`, and Expo are speculation. Store catalog: [`lib/README.md`](../lib/README.md). Decisions, each with a status, are [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md). |
| `MODULE_PLATFORM.md` | What the Modules tab is today: compose a workspace, save a blueprint. A new module does not get a private database. The paste-a-`.tsx` wizard and the model assist are an unbuilt appendix. |
| `ARCHITECTURE_MODULARITY.md` | What is already a platform vs duplicated chrome, and the foundation-first refactor order (canonical fields → one write door → period cursor → manifest/installer) that `MODULE_PLATFORM.md` depends on. Also the deliberate *do not extract* list. |
| `MESSAGE_INGEST.md` | Phone-message ingest (**BIM**): matching precedence, manuals (`info` / `{prefix} info` / `{prefix} commands` / `all commands`), grocery/`needed`/activity/`log:`/`intake:`/`intake food|drink|drug:`/`cycle:`/`st:`/`so:`/`transit:`/`dh:`, send-time stamps, dedupe, Analytics text tabs, hub (no morning cron), pin, pairing, iOS Shortcuts, OCR. Timed reminders text the paired chat only while the app is open, and only when Text me is on. |
| `BIM_COMMANDS.md` | **Complete BIM command catalog** — every parser verb, alias, expansion, habit/discrete preset, bulk dump form, morning GM reply, and retired bare `g`. Mirrors in-chat `all commands`. |
| `shortcuts/` | iOS Shortcuts. Dump iPhone Notes is the recipe [`dump-iphone-notes-to-brain2.md`](shortcuts/dump-iphone-notes-to-brain2.md) and `npm run shortcut:iphone-notes` (the signed `.shortcut` is not in the repo; `Dump iPhone Notes to Brain2.wflow.json` will not import). Signed files that are in the repo: [`Screen Time to Brain2.shortcut`](shortcuts/Screen%20Time%20to%20Brain2.shortcut) ([install](shortcuts/screen-time-to-brain2.md) — not Apple Screen Time export), [`iPhone Call to Brain2.shortcut`](shortcuts/iPhone%20Call%20to%20Brain2.shortcut) + [`iPhone Text to Brain2.shortcut`](shortcuts/iPhone%20Text%20to%20Brain2.shortcut) ([install](shortcuts/iphone-calls-and-texts-to-brain2.md) — not Recents or Messages DB), [`Location to Brain2.shortcut`](shortcuts/Location%20to%20Brain2.shortcut) ([install](shortcuts/iphone-location-to-brain2.md) — Arrive/Leave + on-phone log + Live Location; paints up to the sample). |
| `DESIGN_STYLE.md` | Visual standard in three layers: **failures**, **layout**, and **palette**. Layout includes [the screen stays pleasing](DESIGN_STYLE.md#the-screen-stays-pleasing) — Gestalt, even order, no orphan wrap, no clipped chrome — and that section overrides a local rule that would make the screen ugly. The direction is magical interaction, DSi pixel and indicator lights, and retrofuturistic esoteric technology. A teaching from Korzybski, Watts, or Jung is welcome when the quote is real and sourced. |
| `DESIGN_REFS.md` | Inventory of `designrefs/` (49 stills). How to read each picture as **machine**, **art**, **ancestor**, or the **impossible** the still cannot show. Lanes: **ideas**, images used **directly** (desktop PCB plates in `public/pcb/`; Tracking pen-tray stills in `public/pen-tray/`; later orb/gem knockouts), and visual language to **apply**. Keystones lead with mushroom desk, TENO, cursor angel, seraph, snowflake, cat traces, Pocket PC — not Win95 MDI. Held machines (Pocket PC, Motorola, hiptop, Sharp, Kyocera, Sony) are cataloged. **Do not costume the whole app** as one still. |
| `PLAN_OF_ACTION.md` | Decision list. Each item has a status. |
| `MAP_LOOP_MEANING.md` | **The join.** How map (Korzybski), loop (Wiener), and meaning (Jung) perfect Brain2 as one house: honest records, a miss that steers, a coincidence that is shown and never causalized. Laws for builders. An open wave in [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) is what gets built. |
| `ScienceandSanityBrain2.md` | **Source.** Map and territory: how Brain2 already practices general semantics (orders of abstraction, dating, non-allness, description before inference, time-binding), and a ten-slice sketch (GS-1 … GS-10). The product never names the book. Those slices are unbuilt. An open wave in [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) is what gets built. |
| `jungideas.md` | **Source essay.** Jung’s Synchronicity and Stages of Life read against Brain2. Parallels only. The Stages PDF in `litrefs/` is corrupted; those points are paraphrased. |
| `JungBrain2.md` | **Source.** Meaning layer: ten slices (JG-1 … JG-10) — coincidence log, named outliers, exception interviews, affect on capture, dream symbols, Ask sideways, friend-interest retirement, life seasons, yearly afternoon prompts. The Meaning studio group is planned and not built ([`components/Analytics/README.md`](../components/Analytics/README.md)). Wave 14 stays **do not start**. A coincidence is shown and never called a cause. Those slices are unbuilt. An open wave in [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) is what gets built. |
| `cyberneticsbrain2.md` | **Source.** The steersman: how Brain2 already practices control and communication (sense, memory, effectors, feedback), and an eleven-slice sketch (CY-1 … CY-11). One derived gap, three speeds, silence inside a band. The product never names the book. Those slices are unbuilt. An open wave in [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) is what gets built. |
| `brain2taoism.md` | **Source essay.** Eva Wong’s *Taoism: An Essential Guide* read against Brain2: 60 parallels, five practices (Reserves, Almanac, Gates, Hearth ledger, Foundations), and five changes to existing rooms. Screen words stay plain. Parallels and proposals. Ideas 395–464 in [`BRAIN2_FEATURE_IDEAS.md`](BRAIN2_FEATURE_IDEAS.md). |
| `FRIEND_COMPANION.md` | North-star plan for **today's friend** (personality, missions, rewards, clock). Pack gallery, picker, the friend instrument, accept-until-midnight missions, list-bias beads, and first rewards **shipped**; clock / trinkets / learned personality later. |
| `UI_NEXT.md` | Layout backlog. Not a second style law. Decisions stay in [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md). The Moon chart’s motion bar and the paused true-scale sky are [`components/Home/MOON_SKY_MOTION.md`](../components/Home/MOON_SKY_MOTION.md), not this file. |
| `UI_CRITIQUE.md` | Historical. An observation dump from an older shell, not a work list. Open notes are already queued in [`UI_NEXT.md`](UI_NEXT.md) and [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md). |
| `BRAIN2_FEATURE_IDEAS.md` | Large idea bank of potential buildouts, mapped onto the data model. Source material, a menu. Ideas 1–160 from the `Brain2Ideas` brain-dump; 161–280 from later prototype and theory docs; **281–394 (Expansion III)** from the map, the loop, and the meaning layer; **395–464 (Expansion IV)** from [`brain2taoism.md`](brain2taoism.md). A Sep 2026 shipped / partial / not shipped audit of the “realistic and worth doing” slice stays in the file. An open wave in [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) is what gets built. |
| `CANONICAL_FIELDS.md` | Field-level authority for the data model: canonical vs legacy vs derived. Title-as-record has shipped; persist v18 makes `description` a pure title mirror and parked-note prose lives in `body`. Wave 10 of the plan. Defines **temporal polarity** (Prospective / Retrospective) beside orders of abstraction. |
| `TEMPORAL_POLARITY.md` | Catalog of **Prospective** vs **Retrospective** inputs (plan writings vs painted time, day-summary prose, task actuals). Glossary for overloaded “tracked” / “actual”. Overlay only — no persist rename. Helpers in `lib/temporal-polarity.ts`. |
| `COUNTS_AS.md` | Tracking pen **nesting**: what "Ocean Beach counts as San Diego" does and does not mean, the searchable parent picker, the colored chain diagram, and the rule that a **detail** is a pen that counts as its parent (persist v13). A pen may count as several others (`parentIds`, persist v14); `parentId` stays the display parent. |
| `PEN_ACTION_FORMATS.md` | Tracking pen **default action formats**: how a painted block becomes a Done-today row, the template variables, which template wins, and how the row stays in step with the block. |
| `time-context-vision.md` | **Time-context slices, specified and not shipped.** A slice is a predicate over `TimeEntry`. Find blocks and “Show matches in this view” are the pattern to copy. Home versus away, alone versus with someone, and the other life-context pictures are not in the product. |
| `AstrologyPredictions.md` | Hellenistic timing for the 5 May 2000, 20:19 UT, Rogers chart, sorted by period. Natal sections are labeled as natal. The forecast is the pasted profections, firdaria, and transits only. |
| `monthpredictions.md` | Twenty-four profection months, 5 October 2026 through 4 October 2028, for the same Rogers chart. Whole-sign judgments. Transit dates recomputed with the Swiss Ephemeris and clocked in America/Los_Angeles. |
| `tree.md` | Annotated, clickable index of the whole repository (pairs with `tree.txt`). |
| `tree.txt` | Plain `tree` command output (regenerate with `npm run tree`). |
| `screenshots/` | The capture set: PNG files and matching `.txt` write-ups. 97 PNGs are on disk (96 with sidecars; `habits-noble-gas-rail.png` has none). Freshness is the status table in [`screenshots/README.md`](screenshots/README.md). Re-capture with `npm run capture-screenshots` while `npm run dev` is running. `npm run screenshot-reel` serves [`screenshots/viewer.html`](screenshots/viewer.html): step through older and newer frames, and edit per-feature notes, boxes, and global markup beside them. |

### Screenshot index

The folder is the capture set. File dates, freshness, and the surfaces that
still have no file are the status table and the gap list in
[`screenshots/README.md`](screenshots/README.md). Prefixes only:

| Prefix | Area |
|--------|------|
| `01-*` | Home → Habits — **favorite / most developed UI**; look here first |
| `02-*` | Home → Plan |
| `03-*` | Home → To Do |
| `04-*` | Home → Goals |
| `05-*` | Lists (folder + content displays) |
| `06-*` | Scheduler |
| `07-*` | Analytics studio |
| `08-*` | Home → Tracking |
| `09-*` | Modules |
| `10-*` | Operations |
| `12-*` | Docs |
| `20-*` | Global header dialogs |
| `21-*` | Item detail popup |

See also the root `README.md` for the project overview and repository map, the
per-folder `README.md` files for file-by-file documentation, and
[`DESIGN_STYLE.md`](DESIGN_STYLE.md) for the visual gold standard.
