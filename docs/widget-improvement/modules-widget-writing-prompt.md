# Writing Generator

Widget id: `modules-widget-writing-prompt`

The card is `WritingPrompt` in `components/Modules/module-bodies.tsx`, chosen by `ModuleBody` when `type` is `writing-prompt`. The three pools and `rand` live in `components/Modules/module-helpers.ts`. Add and edit go through `ModuleConfigDialog`. The desk is `ModulesPanel` in `components/Modules/modules-panel.tsx`: widgets are `kind !== "workspace"`, each one a `ModuleCard`. Persist is `useModulesStore` (`lib/modules-store.ts`), Zustand persist version 2, physical key `brain2-modules-store`.

## Data source + snapshot

**Live wins.** Read 2026-10-09 23:12 PDT from Chromium localStorage for origin `http://localhost:3000`, LevelDB at `~/Library/Application Support/cogs/Local Storage/leveldb`. Winning key `_http://localhost:3000\x00\x01brain2-modules-store`, sequence 52496, value present, table `019564.ldb`. The value is a `0x00` prefix plus UTF-16 JSON: 63,493 characters, 126,987 value bytes, persist version 2. `brain2-data-profile` is absent, so this is the live profile. No demo modules key. The current WAL (`019569.log` at the read) has neither the ASCII key nor a UTF-16 `writing-prompt`.

`cogs-modules-store` in that LevelDB is a deletion (sequence 18631, empty value).

Saved Writing Generator instances: **none**.

| | Winning LevelDB record |
| --- | --- |
| Modules | 14 |
| Workspaces (`kind: "workspace"`) | 11 |
| Dashboard widgets | 3 |
| `type: "writing-prompt"` | 0 |
| Seed id `mod-write` | absent |

The three widgets that are saved:

| id | type | title | config |
| --- | --- | --- | --- |
| `mod-points` | `analytics-stat` | Points this week | `{ "stat": "points-week" }` |
| `mod-random` | `random-task` | What should I do now? | `{ "categoryId": "1781214482554" }` |
| `mod-1781860762205` | `list-explorer` | reading list | `{ "categoryId": "1781860357899", "pickCount": 5 }` |

Prompt pools are not on the record. Last output is not on the record. A writing config would be `categoryId` only when a list is chosen; “Built-in topics” and the code seed both store `{}`. There is no saved writing config, empty or filled.

An older table still in the folder, `005552.ldb` (mtime 2026-09-21), sequence 17980, is the same shape of absence: 19 modules, 16 workspaces, the same three widget types, zero `writing-prompt`, no `mod-write`. The seed card was already gone in that copy.

The code seed, present only as the default array when the key is missing:

```json
{ "id": "mod-write", "type": "writing-prompt", "title": "Writing Assignment Generator", "config": {} }
```

Persist replaces `modules` with the saved array. The key exists, so the desk does not grow `mod-write` back.

Hub `data/shared-persist.json` (`updatedAt` 2026-10-10T06:12:28.055Z, source `electron`) still has `brain2-modules-store` and `cogs-modules-store` as one 61,026-byte string: version 2, 12 modules, 9 workspaces, the same three widgets, zero `writing-prompt`. LevelDB is the vault the app reads. It is ahead by two workspaces, and the cogs twin there is already deleted.

The pools the card would roll, from `module-helpers.ts`, if an instance existed:

| Pool | Count | Lines |
| --- | --- | --- |
| `WRITING_FORMS` | 6 | a short story; an essay; a poem; a journal entry; an open letter; a scene of dialogue |
| `WRITING_TOPICS` | 10 | a door that shouldn't be open; the last day of summer; an unexpected kindness; a machine that feels; a memory you can't trust; the city at 3am; two people, one umbrella; what the ocean remembers; a promise made and broken; the smell of rain |
| `WRITING_CONSTRAINTS` | 6 | in under 300 words; from an unexpected point of view; without using the word 'I'; set fifty years in the future; that ends with a question; using only the present tense |

That is 6 × 10 × 6 = 360 built-in sentences. A saved list would replace the ten topics with `itemTitle` of every item on that list (title, otherwise description), completed items included. No writing instance has a `categoryId`, so that branch has no live list.

## a. Biggest problems right now

1. **The card is not on the desk.** The winning record and the September 21 record both have zero `writing-prompt` modules. Modules is showing Points this week, What should I do now?, and reading list. Writing Generator exists as the second type in the Add Module dropdown. That dialog opens on `list-explorer`.

2. **A roll is not a record.** `WritingPrompt` builds `{ form, topic, constraint }` in a `useMemo` whose dependencies are `nonce`, `categoryId`, and the whole `tasks` array. New prompt only increments `nonce`. Leaving the tab, reloading, or any task-store update builds a different sentence. The store has no last-output field because the component never writes one. Pools stay compile-time constants.

3. **The only setting is an optional list, and the card would hide which pool it used.** Save keeps `categoryId` for this type and drops stat, framing, pick count, and rules. The three pools cannot be edited. Empty config still renders a full sentence, so a built-in roll looks like a configured one. With a list, topics become item titles and the built-in ten drop out, with no list name on the card. `tasksInList` keeps completed items. An empty list falls through to the built-in topics with the same sentence.

4. **Remove is one click, and nothing reopens.** `onRemove` calls `removeModule` immediately. Workspace tiles open and can pop out. A widget card has gear and ×. There is no detail, no draft, and no kept prompt, so a removed writing card leaves the array with no assignment behind it.

## b. Layout, UI, design, and style

Read from `docs/DESIGN_STYLE.md`. The assignment is the large type. The reroll is the next size. A caption stays the small size and stays readable. One region, one job. Related controls sit in one group. Empty space is a pause between regions, or a well waiting for work. The modules catalog is still the flatter chrome (`modules-chrome.css`; phosphor token `#3dff8a`). A room may keep its own furniture. A shared outline button inside that well is the sanded interior. A 9px nameplate is a short word. The three parts of one assignment should read as one figure.

### Overview

The only surface is the dashboard card in `.mod95`, under “Dashboard widgets”. `.mod-grid` is one column, two from 768px, three from 1024px. `ModuleCard` is a raised gadget well, `min-height: 156px`, square corners, `data-mod-type="writing-prompt"`. No rule in `modules-chrome.css` targets that type. The black-green scope well (`--mod-scope` `#0b1a12`, `--mod-phosphor` `#3dff8a`) is only `[data-mod-type="analytics-stat"]`.

Title bar, 12px bold: `PenLine`, truncated title, an 18×16 gear, an 18×16 ×. Those two keys are milled. The body is a sunken field (`margin: 6px`, `padding: 8px`) holding:

- One `text-sm` paragraph: `Write {form} about {topic}, {constraint}.` The three slots are `font-semibold` at the same size as the glue around them.
- An outline `Button`, size `sm`, label “New prompt”, with a refresh icon. The stylesheet mills `.mod-widget-bar button` and `.mod-build`. It leaves this body button on the shared kit.

Reading order is title, sentence, button. The topic’s source is off that path. With `config: {}` the sentence still fills the well. The 156px floor leaves slack under a short paragraph and one key. That slack is leftover well, not a second region.

The template makes the slots hard to scan. The topic “two people, one umbrella” already has a comma, then the constraint is glued on with another comma. Form, topic, and constraint are one clause at caption size. The style file wants the thing the region is for at the largest size.

The sentence is not a control. Gear opens the shared configure dialog. × deletes the module.

### Detail view

There is no writing detail. Full-screen open and `openModulePopout` are the workspace path. The nearest surface is `ModuleConfigDialog`: shared `Dialog`, `sm:max-w-md`, title “Configure Module” or “Add Module”.

For this type the body is three fields. Type lists all six widget types and starts on `list-explorer` when adding. Title’s placeholder is “Writing Generator”; the missing seed title is “Writing Assignment Generator”. “Topic source list (optional)” offers “Built-in topics” or a list. There is no form pool, topic pool, constraint pool, sentence preview, or last roll. The footer is Cancel and Save or Add. This file does not use the unsaved-changes guard. Changing Type and saving turns the card into another widget.

The sheet is the flat shared dialog. The style note still lists bare `components/ui/dialog.tsx` sheets among the flatter surfaces. This column edits type, title, and an optional list. It is not a desk for the assignment.

## c. New features for the detail view

The live record has no instance, no pools, and no last output. The detail is where those three become visible. The overview card can keep one sentence once the desk holds the parts.

1. **Open the card onto a writing desk.** The well opens the way a workspace tile does. Three nameplates, `FORM`, `TOPIC`, `CONSTRAINT`, each one short word. The value under each is the large type. “New prompt” stays one key and rerolls all three. Each well has its own reroll and a lock, so a roll can keep the form. The full sentence sits under them at caption size, and “two people, one umbrella” is a topic on its own line.

2. **Keep the last roll on the module.** On open and on New prompt, write `{ form, topic, constraint, at }` into this instance. Reload shows that roll. The `tasks` dependency on the current memo would replace it on any edit; the desk should hold the saved roll until New prompt. The overview card prints the same roll, so the dashboard and the desk match.

3. **Show the pools, and that config is empty.** A second region lists the six forms, ten topics, and six constraints. A line can be turned off or added. Until a custom line is saved, the nameplate reads `Built-in`. That is the face of `config: {}` and of “Built-in topics”. Custom lines save on the instance. The constants remain the seed.

4. **A list is a labeled source.** When `categoryId` is set, the topic well names the list and how many titles `itemTitle` will draw. A rocker chooses built-in topics, list titles, or both. Completed items stay out unless a key includes them. An empty list says it is empty and keeps the built-in ten.

5. **A page under the assignment.** One writing well at body size, kept with the prompt. Copy sits in the same group as New prompt. Remove on the card asks first, because a kept roll and a draft are now something × would drop.

6. **Phosphor for the roll, mill for the keys.** This type has no scope well. The three values sit on the same black-green glass as the analytics card (`--mod-scope` `#0b1a12`, `--mod-phosphor` `#3dff8a`). The keys are milled like `.mod-build`. Type and title stay on a small gear. The desk is the assignment.
