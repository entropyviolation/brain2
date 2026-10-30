# Tutorial mode — plan

_Last mapped: 2026-10-30_

**Status: Planned.** Nothing here is built. This file is the brief. Do not
start until it is asked for by name.

## What it is

A tutorial mode that shows exactly how to use each part of Brain2 and exactly
how it works. There are two tracks:

- **Desktop** (the Electron app and the web shell). It follows
  `docs/DESIGN_STYLE.md`.
- **iOS** (the `/mobile/` shell in `components/Mobile/`). It follows
  `docs/MOBILE_STYLE.md`.

The two tracks share one script format and one step engine. Each track has
its own anchors, gestures, and copy, because the screens differ.

## Order of rooms

Build one room at a time. Each one ships before the next starts.

1. **Home.** The date plate, the Visual dashboard, Needs Attention, and the
   five tabs: Habits, Plan, To Do, Goals, Tracking.
2. **Lists.** Folders, lists, and items. Adding, moving, and opening a row.
   One row is the same item every other room can open.
3. **Item detail.** Tags, typed links, lists, schedule, body, and history. The
   popup and the page.

Later rooms (Inventory, Data, Modules, Docs, People, and the rest) are
**Planned** after these three.

## The welcome tour

**Planned.** Offer a welcome tour on account creation or on first login. It
explains:

- what Brain2 is (one item, used everywhere; capture once, connect, use);
- how it works (rooms read and write the same records);
- how to use it (capture, sort into Lists, open an item, see it on Home);
- different ways it could be used (examples by kind of person and kind of
  work).

The offer can be skipped and reopened later from Settings and from the header
question mark. Finishing or skipping is remembered per profile.

Today there is no account creation. The phone has a placeholder login in
`lib/mobile-auth.ts`. The desktop has none. Until real accounts exist, "first
login" means the first open with no tutorial record for this profile.

## Do no harm

The tutorial must not change, hurt, or slow any part of the app.

- **Runs on Demo data, never on Live.** The Demo profile already exists
  (`lib/data-profile.ts`, `lib/demo-vault.ts`, `lib/demo-corpus/`). Its keys
  are `brain2-demo-*` only. A tutorial run uses Demo or a tutorial copy of it,
  so a person's real vault is never written. Leaving the tutorial returns to
  the profile they came from.
- **No new item writer.** Any example row is written through the existing
  doors (`commitItemEdit`, `updateTask`, the list writers in
  `lib/task-store.ts`), on the tutorial profile only.
- **Overlay, not rewrite.** Steps point at screens through the existing
  `data-ui-name` anchors (the same seam `components/UiNames/` uses). A
  missing anchor skips its step; it never breaks the screen.
- **Lazy-loaded.** The tutorial code and scripts load only when a tutorial
  opens. The normal app bundle and first paint stay the same.
- **Off by default after the first offer.** No step fires unless the person
  starts a tour.
- Tests for each room's tour run beside that room's existing tests. Existing
  tests stay green.

## Step format

**Planned.** A tour is plain data, so tours can be stored, reused, and
tailored without code.

```ts
type TutorialStep = {
  id: string
  room: "home" | "lists" | "item-detail" // more later
  platform: "desktop" | "ios" | "both"
  anchor: string            // a data-ui-name value
  title: string
  body: string              // may contain {slots} filled from example data
  action?: "click" | "tap" | "type" | "swipe" | "none"
  waitFor?: string          // an event or anchor that ends the step
}

type TutorialScript = {
  id: string
  version: number
  steps: TutorialStep[]
  exampleSlots: string[]    // e.g. ["project", "habit", "listName", "person"]
}
```

## Tailored tutorials (eventual)

**Planned.** Eventually the welcome tour should:

1. Briefly show the full range of basic capabilities.
2. Ask the person: who are you, what do you do, and what do you think you'd
   like to use Brain2 for. Ask them to be as elaborate as possible.
3. Use a **local LLM** to tailor the tour to what they may need or could use
   it for.

The local LLM is a shared piece that many other places in the app will use.
The Texts plan already assumes a local model on the Mac (Ollama, see
`docs/TEXTS_ANALYTICS_PLAN.md`). The tutorial should call the same shared
client, not its own.

### Keeping it cheap

Do not generate a whole tour per person. That burns tokens every time.
Instead:

- **Tutorial templates.** A small set of stored scripts in the format above.
  The step order, anchors, and wording stay fixed. Only `{slots}` change.
- **Use-case packs.** Stored example data per kind of person: for example a
  musician (setlists, practice habits, gig dates, gear), childcare (kids'
  schedules, meal plans, parent contacts, daily logs), a student, a small
  business, a writer. A pack fills the template's slots and seeds the
  tutorial's Demo rows.
- **The model only picks and fills.** From the person's answer, the local
  model (a) picks the closest stored pack or packs, and (b) writes short slot
  values when no pack fits well. One short call, not a tour.
- **Cache the result.** Store the chosen pack and filled slots with the
  profile. Reopening the tour costs nothing. A new pack written for an
  unusual answer can be saved and reused for the next similar person.
- **Works without the model.** If no local model is running, the person picks
  a pack from a list, or gets the general tour.

The person's answers stay on the device. They are never sent to an outside
API.

## Build order and parallel work

AMAP: these pieces have separate files and can be built at the same time.

- Step engine and overlay (shared by both tracks).
- Desktop Home script and iOS Home script.
- Tutorial profile handling on top of Demo.
- Example-data packs (plain data, no UI).

Lists and Item detail scripts follow once Home is in. The welcome tour and
the questions come after the three room tours. The local LLM tailoring comes
last, once the shared local model client exists.

## Open questions

- Does the tutorial profile reuse Demo as-is, or copy it to its own
  `brain2-tutorial-*` keys so a person's own Demo edits survive?
- Where does the shared local LLM client live (`lib/`), and which model?
- Real account creation is not built. The welcome-tour trigger should move to
  it once it is (`docs/PEOPLE_AND_KEYS.md`).
