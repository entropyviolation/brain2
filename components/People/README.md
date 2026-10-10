# `components/People/`

People I Know, shown in more than one room.

The list itself is created by `lib/people-i-know.ts` after the task vault
hydrates. Birthday and standing notes stay attributes on the catalog Person
type (`lib/person-types.ts`). The rest of the biography is `Task.personProfile`
(`lib/person-profile.ts`): full name, nicknames, an optional relation (friend,
sister, boyfriend, or anything else they type; empty stays empty), date met
(with Est. when the day is estimated), Instagram, an address at mailing,
neighborhood, state, or country precision, a dated notes log, an interaction
log, gift notes, and Close. Relation and Close live on the profile so a Person
type already saved still shows them. How long known, time since last seen, and
days until the next birthday are derived when the person is open. Last seen
counts an interaction marked Saw them, plus a Company block painted with a
joined pen. A stored block join from before still counts. A call left unmarked
stays a call.

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

| File | Purpose |
|------|---------|
| `person-detail.tsx` | Biography on the person in item detail, above the pipelines. Writes `personProfile` (including relation and Close) and the birthday and notes attributes through the item draft. Close creates the Gift ideas list. Gift notes and the folder list are labeled apart. |
| `person-detail.css` | Plaque, fields, and log rows. |
| `person-detail.test.tsx` | Birthday countdown and cake, known-for, last saw, address, notes, logs, gift notes, relation, Close and the gift list. |
| `person-pipelines.tsx` | The editor. `mode="person"` writes the item draft and lists Company blocks from joined pens. `mode="pen"` attaches a person to a pen. `mode="entry"` shows the people on that pen. `mode="list"` writes stored joins. Pen, entry, and list modes write the task store immediately. |
| `person-pipelines.css` | Row and add-control layout. Dialog chrome stays with the host (item detail, list settings, tracking). |
| `person-pipelines.test.tsx` | Add a pen on a person, create a person from a pen, show a stored timeblock in list settings, show blocks from pen color, show people on a block by pen. |
