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

- **Runs on fiction, never on Live.** A tour runs in its own `tutorial`
  profile, seeded from the Demo seed (see Decisions). A person's real vault
  and their Demo vault are never written. Leaving the tutorial returns to the
  profile they came from.
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
  person's vault. Reopening the tour costs nothing. A new pack written for an
  unusual answer is saved in that vault. It reaches other people only if it
  is added to the repo's packs.
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

## Decisions

_Decided 2026-10-30._

### A third profile: `tutorial`

The tutorial gets its own profile, not Demo as-is.

- `DataProfile` in `lib/storage-keys.ts` grows from `"live" | "demo"` to
  `"live" | "demo" | "tutorial"`. Keys are `brain2-tutorial-*`, written
  through `writeAliasedLocal` like Demo.
- Starting a tour seeds a fresh tutorial vault from the Demo seed
  (`lib/demo-vault.ts`, `lib/demo-corpus/`), then the chosen use-case pack on
  top. Leaving or finishing wipes it, the same way Reset Demo wipes
  `brain2-demo-*` and its IndexedDB. Then the app reloads into the profile the
  person came from.
- Why not Demo itself: Demo is a sandbox people explore and edit. A tour
  needs a known, clean state ("open the list called Setlists") every time,
  and must not erase someone's Demo edits.
- Switching uses the same reload path as `switchDataProfile` in
  `lib/data-profile.ts`. Live keys are never read or written.

### The phone does not write

The phone reads the Mac's vault into memory (`lib/phone-window.ts`). On the
phone, the tutorial vault is built in memory only and never sent back to the
Mac. Closing the tour drops it.

### One shared local model client

There is no model client in the app today. `lib/smart-parse.ts` is
deliberately model-free and stays that way.

- Add one client, `lib/local-model.ts`, used by the tutorial, the Texts plan
  (`docs/TEXTS_ANALYTICS_PLAN.md`), and later callers.
- It talks to **Ollama on the Mac** (`localhost:11434`). The phone reaches it
  through the Mac's own server, through a route like `/api/local-model`, the
  same way it already reaches `/api/persist`. Nothing leaves the Mac.
- Model: a small instruct model (about 3B to 8B) pulled in Ollama. The model
  name is a setting in the env (`lib/brain2-env.*`), not in code, so it can
  change without a rebuild.
- Calls ask for JSON output and are checked against a schema. A bad or empty
  answer falls back to the pick-a-pack list.
- One call to `isAvailable()` decides whether the questions step offers
  tailoring at all.

### Matching answers to packs

Match locally first, then ask the model only when needed.

1. Each pack has keywords and a short description. Score the person's answer
   against them with plain text matching. A clear winner uses that pack with
   no model call.
2. Otherwise one model call gets the answer plus the pack list (ids and
   one-line descriptions only, not the pack data) and returns
   `{ packs: string[], slots: Record<string, string> }`.
3. The result is cached with the profile. If the model filled most slots
   itself, save it as a new local pack so the next similar answer matches in
   step 1.

### Where packs and scripts live

- Scripts: `lib/tutorial/scripts/` (one file per room and platform), plain
  data in the step format above.
- Packs: `lib/tutorial/packs/` (one file per use case), plain data, like
  `lib/demo-corpus/`.
- UI: `components/Tutorial/`, lazy-loaded from the shell (`app/page.tsx`) and
  the phone shell (`components/Mobile/MobileApp.tsx`).

### When the welcome tour is offered

- Desktop: the first open with no tutorial record in Live.
- Phone: right after the login gate (`lib/mobile-auth.ts`), with the same
  check.
- The record is one small key (offered / skipped / finished, and the cached
  pack). It is the only thing the tutorial writes to Live.

### More than one person, more than one device

`docs/PEOPLE_AND_KEYS.md` is the plan for this. Each person gets their own
vault, opened by a key they hold, not an account on a server. Devices are
paired to a vault. Signing in stays optional for one person on one Mac.

The tutorial follows that plan:

- **"Account creation" means vault setup.** When vault setup exists (build
  steps 2–4 in `PEOPLE_AND_KEYS.md`), the welcome tour is offered at the end
  of it. Until then, the first open with no record stands in for it.
- **The record belongs to the vault, not the device.** It lives under the
  vault's keys (`brain2-v:<vaultId>-*` once vault ids exist), so it syncs
  with the vault. A person who finished the welcome tour on the Mac is not
  asked again on their phone.
- **Room tours are tracked per platform.** The desktop and iOS tours show
  different screens, so finishing Home on the Mac still offers Home on a
  newly paired phone, once, as a short "here is how it looks on the phone".
- **Two people on one device** each get their own record because each has
  their own vault. A `guest` (no vault) gets the general tour on Demo data
  and nothing is saved.
- **The person's answers and pack stay in their vault.** They are never
  shared across vaults, matching "Data across people's vaults" in the
  Refused list.
- A use-case pack the model writes is saved in that person's vault only. A
  pack is shared with other people only if it ships in the repo under
  `lib/tutorial/packs/`.
