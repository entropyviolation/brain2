# `components/People/`

People I Know, shown in more than one room.

> **Planned.** Person detail redesign and rich Links:
> [`docs/PERSON_DETAIL_REDESIGN.md`](../../docs/PERSON_DETAIL_REDESIGN.md).

## What changed, what is still open

_Last mapped: 2026-10-16_

- Fixed (plan 1.1): person text fields are `IsolatedInput`. Keys go to
  `onLive` (the host's `touchDraft`), blur commits through `onChange`, and
  every write merges from `readDraft()` so two fields typed before Save
  both keep.
- Fixed (plan 2.1): fields are 32px with 10px inner padding. The person kit
  classes (`.person-field`, `.person-chipfield`, `.person-key`,
  `.person-readout-strip`) are ready for the 3.1 layout.
- `ensureCloseGiftIdeas` (every hydrate) and `noteSavedPeople` (title
  change) rewrite the Gift ideas list name to "Gift ideas for {title}". A
  rename made in Lists does not survive (**Planned**, step 3.4).
- `assembleProfile` in `lib/person-profile.ts` rebuilds the profile field
  by field. A new profile field is dropped unless it is added there
  (`self` is).

## Notes and Self

_Last mapped: 2026-10-16_

- Notes left Details (plan 3.3). The Notes tab for a person is
  `person-notes.tsx` (`PersonNotes`): dated notes are `task.noteLog`, the
  standing note is still the `notes` attribute (the People list column
  reads it), and text an ingest put on `Task.notes` shows as **Captured**
  with **Move into standing note**. Old `personProfile.noteLog` entries
  fold in through `lib/person-notes-fold.ts`: task-store persist v19, and
  for display on the tab (the fold is written on the first notes edit, so
  opening the tab does not dirty the item).
- **Self** (plan 4.1): `lib/people-self.ts` creates one person, id
  `person-self`, title "self", nickname "me", `personProfile.self: true`,
  after People I Know is ensured. It is made once (`brain2-people-self-v1`);
  deleting it sticks. `isSelfPerson(task)` is for the Self links in 7.1.

The list itself is created by `lib/people-i-know.ts` after the task vault
hydrates. Birthday and standing notes stay attributes on the catalog Person
type (`lib/person-types.ts`). The rest of the biography is `Task.personProfile`
(`lib/person-profile.ts`): full name, nicknames, an optional relation (friend,
sister, boyfriend, or anything else they type; empty stays empty), date met
(with Est. when the day is estimated), Instagram, an address at mailing,
neighborhood, state, or country precision, an interaction log, gift notes,
and Close. Dated notes are the item's Notes tab now (see above). Relation and Close live on the profile so a Person
type already saved still shows them. How long known, time since last seen, and
days until the next birthday are derived when the person is open. Last seen
counts an interaction marked Saw them and a Company block painted with a
joined pen. A stored block join from before still counts. Calls and texts
never count as seeing them (_2026-10-23_); they feed Last called and Last
texted instead. A call interaction left unmarked stays a call.

**Close** (`personProfile.close`, off when absent) makes a Gift ideas list:
one Lists folder named Gift ideas, and inside it a list named
"Gift ideas for {item title}" tied to the person id (`giftIdeasPersonId`).
That folder list is what gift ideas means. The `giftIdeas` array stays as
quick notes on the person and is not cleared. Turning Close off does not
delete the list. If the list already exists, person detail shows it and a
quick add even when Close is off. If it does not exist, detail does not
pretend it does. The folder and a per-person list can be deleted: they are
ordinary Lists records, so delete is not refused the way People I Know is.
A person who is still Close gets a missing list back the next time the vault
hydrates. A duplicate of the list does not keep the person id.

The birthday plaque draws a small pixel cake — milled silver, a phosphor
candle — so it matches the house now. A later step will choose that cake from
a folder of cute PNGs, the same idea as willpower gemstones and list orbs.
That folder is not built in this step, and the plaque does not load images.

A **pipeline** that decides Company time is a Company pen
(`Task.personPipelines`, kind `company-pen`). Company time is every Company
block painted with that pen. Pen settings are where a person is attached.
On a Company block, the people shown are the ones whose pen is on that block.
A stored `company-timeblock` row is still listed so older data is not erased,
and it can be removed. It is not how new time is chosen. The pen join is
edited from the person, from List settings, and from pen settings.

A later kind stays on the row. Adding a kind is a new `kind` in
`lib/people-i-know.ts` plus a control in this editor.

## Folders

_Last mapped: 2026-10-27_

- `detail/` — nickname chips, time together, the interaction log, and gift ideas. Person detail composes them.

| File | Purpose |
|------|---------|
| `person-detail.tsx` | _Last mapped: 2026-10-16._ Biography on the person in item detail. Reads top to bottom (plan 3.1): orb well (click → `OrbPickerDialog`, writes `icon` on the draft) beside the birthday plaque; a phosphor readout strip (Known for, Last seen, **Last called**, **Last texted** (_2026-10-23:_ from synced iPhone calls and texts via `personContact`; each shows how long ago and who it was from, plus **Call them back** / **Text them back** when their missed call or text is the last word), **View Instagram analytics ↗** (_2026-10-23:_ when an Instagram handle is saved; `openInstagramFor` in `lib/instagram-report.ts` goes to Data → Sources → Instagram and opens that account's card in the report frame), **View text analytics ↗** when the texts report has a card for one of their numbers, the Close lamp, `role="switch"`); a two-column grid (Full name, Nicknames, Phone numbers and Emails (_2026-10-23:_ same chip field. Phone numbers is the Person type's **Phone Number** attribute (`phone`), mirrored to `personProfile.phones`; a person can have several. Saving one links that number's texts and calls pens to this person, `lib/phone-person-links.ts`), Relation, Date met + Est., Instagram with `@`, Address with map search and a pin); Time together; the host's `pipelines` slot (Company pens); Interactions; gift ideas and gift notes. Writes `personProfile` and the birthday attribute through the item draft. Text fields are isolated (`onLive` / `readDraft`). Close creates the Gift ideas list. `onNavigateToList` is the host's guarded list jump (gift list Open list). |
| `detail/person-log.tsx` | `Log`: a dated log with an optional flag per row (Interactions, Saw them). The composer's text is local state. |
| `detail/person-nicknames.tsx` | `NicknameField`: chips inside one sunken field. Enter or a comma adds, Backspace on empty removes the last, blur adds what was typed. |
| `detail/person-gift-ideas.tsx` | `GiftIdeasList` (items on the person's Gift ideas list, quick add, Open list key) and `GiftLog` (quick gift notes on `personProfile.giftIdeas`). **Planned** (3.4): one wide key that opens a small popup holding both, and a rename-safe list name. See [`docs/PERSON_DETAIL_REDESIGN.md`](../../docs/PERSON_DETAIL_REDESIGN.md). |
| `detail/person-time-together.tsx` | _Last mapped: 2026-10-22._ **Time together** inside the person detail, after the biography grid (memoized on name + `personPipelines`): `personTimeStats` (`lib/person-time.ts`) over the joined Company pens — all time, last 30 / 90 days, per week, last together, rhythm (median days between days together), longest, weekday bars and hour strip, Where / Doing / Also there, and recent times. Counts Company blocks that name them (extra pens, details, groups) and Social “Who with?” ticks, once. Synced calls and texts do not count (_2026-10-23_); they are contact, see `lib/person-contact.ts`. Last seen reads the same minutes. The join hint shows only when there are no joined pens and no time. |
| `lib/people-sync.ts` + `lib/people-sync-runner.ts` | Started from `usePeopleIKnowList`. Keeps one person in three places matched by name: a who-pen detail gets a Company pen (Person level); a Company person gets a cross-view detail on every who pen; every Company person pen gets a People I Know item joined by `company-pen` (existing pipeline, else same name, else new). Out of undo. One-time backfill (`brain2-people-backfill-v1`) mirrors existing Social ↔ Company blocks (blank minutes only). |
| `person-notes.tsx` | Person Notes tab: dated log, standing note on the `notes` attribute, Captured `Task.notes` with Move into standing note. Used by both item detail shells. |
| `person-notes.test.tsx` | Old dated notes fold on the first edit; standing note writes the attribute; Captured moves without loss. |
| `person-detail.css` | Identity bay (orb well, plaque), readout strip and Close lamp, two-column grid, fields (32px, 10px padding), log rows, the person kit classes, and the Notes tab. |
| `person-detail.test.tsx` | Birthday countdown and cake, known-for, last saw, address, logs, gift notes, relation, Close and the gift list. Notes are gone from Details. Isolated typing: `onLive` per key, one trimmed `onChange` on blur. Section order, nickname keys, orb pick. Address search is in `components/ui/address-suggest-input.test.tsx`. |
| `person-pipelines.tsx` | The editor (memoized; person mode re-renders only on id, name, or `personPipelines`). `mode="person"` writes the item draft and lists Company blocks from joined pens. `mode="pen"` attaches a person to a pen. `mode="entry"` shows the people on that pen. `mode="list"` writes stored joins. Choosing a person is `ItemPicker` (search, one person). Pens stay a short menu. Pen, entry, and list modes write the task store immediately. |
| `person-pipelines.css` | Row and add-control layout. Dialog chrome stays with the host (item detail, list settings, tracking). |
| `person-pipelines.test.tsx` | Add a pen on a person, create a person from a pen, show a stored timeblock in list settings, show blocks from pen color, show people on a block by pen. |
