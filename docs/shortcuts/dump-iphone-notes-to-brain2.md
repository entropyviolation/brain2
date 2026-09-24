# Dump iPhone Notes to Brain2

Telegram cannot open Notes on the iPhone. The Shortcut **on the phone** is the
reader; [@brain2_phone_bot](https://t.me/brain2_phone_bot) is only the mailbox.
Brain2 parks each dump on Lists → **iPhone Notes Store** → **Parked** (header
**Phone Notes**). Mac **From Notes** is a different folder.

The signed file lives next to this note:

[`Dump iPhone Notes to Brain2.shortcut`](Dump%20iPhone%20Notes%20to%20Brain2.shortcut)

You do **not** rebuild it in the Shortcuts app. AirDrop (or iCloud Shortcuts)
installs it. Pair the bot first (Settings → Message ingest → Generate pairing
code → `/start 123456` in the bot chat).

Regenerate after a wire-format change: `npm run shortcut:iphone-notes`
(`scripts/build-iphone-notes-shortcut.mjs`, signed `--mode anyone`). Signing
needs a normal Mac shell (not a sandbox) so `shortcuts sign` can talk to
Shortcuts.

Incoming Telegram text is **4096 characters**, one message at a time, **text
only** (a `.txt` file is dropped). The Shortcut sends **one note per message**
and waits **1 second** between sends.

## Install on the iPhone

**Delete any older Dump iPhone Notes to Brain2 first**, then re-import this
file. Older copies used a removed `Get Details of Notes` action, Date/Adjust
Date branches that error on device, or Send Message sharing raw Notes (the
“send %%lld notes in a Telegram message” sheet — Allow then nothing posts).

### Same Apple ID as this Mac (easiest)

1. Pair [@brain2_phone_bot](https://t.me/brain2_phone_bot) in Brain2 Settings.
2. On the Mac, run `npm run shortcut:iphone-notes` if
   `docs/shortcuts/Dump iPhone Notes to Brain2.shortcut` is missing, then
   double-click that `.shortcut` file.
3. Shortcuts.app adds it. If **iCloud → Shortcuts** is on, it appears on the
   iPhone in a few seconds — open Shortcuts there and run it.
4. First add/run asks **who to send to**. Pick the Telegram conversation with
   the bot (open that chat once in Telegram if it is missing).

### AirDrop / Files (different Apple ID, or iCloud Shortcuts off)

1. Pair the bot as above.
2. On the **iPhone**: Settings → Shortcuts → turn on **Allow Untrusted
   Shortcuts**. If that switch is missing, run any shortcut from the Gallery
   once, then come back.
3. On the Mac, in Finder, AirDrop
   `docs/shortcuts/Dump iPhone Notes to Brain2.shortcut` to the iPhone.
   (No AirDrop: Mail it to yourself, or drop it in iCloud Drive / Files.)
4. On the iPhone, tap the file. Shortcuts opens → **Add Shortcut**.
5. When it asks for the recipient, pick the **@brain2_phone_bot** chat — not a
   friend, not a group.

Finder → right-click the `.shortcut` → Share → AirDrop is the same file.

The `--mode anyone` signature is why a tap on the phone is enough. An unsigned
plist / the `.wflow.json` source will not import. Do **not** open the
`.wflow.json` on the phone — that is only the build source.

## Run it

- **Shortcuts app** → Dump iPhone Notes to Brain2 →
  - **Last 24 hours / 7 days / 30 days** — Find Notes modified in that window
  - **Choose folder** — Ask for a folder name, then dump those notes
  - **Pick a note** — recent notes list; choose one (use this when running
    from Shortcuts, not the Share Sheet)
  - **Shortcut Input** — only after **Share** from Notes into this Shortcut
- **Share Sheet**: Notes → Share → Dump iPhone Notes to Brain2 → **Shortcut
  Input**.

Everything branches through that menu. The Shortcut contains **no If action**: a
hand-written one imports with an empty condition and iOS refuses to run the
whole Shortcut (“Please choose a value for each parameter in this action”).

Locked notes send an empty body. Huge bodies may hit Telegram’s 4096-character
cap; split those by hand as `iphone-notes 2/3:` (same `id`) if a send fails.

Do **not** use `https://t.me/share` or `tg://msg` — those do not land as a user
message on the bot poller.

## After it sends

1. Laptop: Brain2 desktop with ingest enabled, **or** `npm run phone:hub`.
2. Bot replies `Parked in iPhone Notes Store: Grocery` (or `Got part 2/3…`).
3. Header **Phone Notes** → bulk-add, keep parked, skip, or **Open in Lists**.
   In bulk-add, a line ending in `:` names the list and a second colon names a
   **new folder**: `Trip ideas: Packing:` files the items on a new **Packing**
   list inside a new **Trip ideas** folder.

Desktop-only test (no phone): Settings → Message ingest → Simulate:

```
iphone-notes:
id: Grocery|Quick Notes|2026-09-21T16:00:00Z
title: Grocery
folder: Quick Notes
account: On My iPhone
modified: 2026-09-21T16:00:00Z
---
milk
eggs
```

Then open **Phone Notes**.

## Wire format

Each Telegram message must look like this (plaintext):

```
iphone-notes:
id: <Name>|<Folder>|<Last Modified Date>
title: Grocery
folder: Quick Notes
account: On My iPhone
modified: 2026-09-21T16:00:00Z
---
milk
eggs
```

Notes no longer expose a Shortcuts “Identifier” property. The composite `id`
is what Brain2 uses for dedupe / continuations. Aliases: `inotes:` and
`phone notes:`. Continuation of a long body (same `id`):

```
iphone-notes 2/3:
id: <same composite id>
---
<next chunk of body>
```

Brain2 concatenates until `n/n` arrives, then parks. Re-sends of the same `id`
reply **Already stored**. Keep each message under **3900** characters.

## Shortcut internals (maintainers)

- Find Notes (`filter.notes`) + Notes `NoteEntity` AppIntentDescriptor;
  date windows use operator **1001** (“is in the last”, days) — not
  Date + Adjust Date (those branches error on device).
- Output name **Note** (singular), matching Gallery.
- Note fields: Repeat Item → Name / Folder / Last Modified Date / Body
  (not Identifier, not `properties.notes`).
- **Pick a note** = Find Notes → Choose from List. **Shortcut Input** = Share
  Sheet.
- Loop: Get Text (output name **Text**) → Set Variable **Outgoing** → Send
  Message content = Variable Outgoing only. Never pass Note entities into
  Telegram (that produces “send %%lld notes…” and silent failure after Allow).
- Count → If Count > 0 (filled condition) → send loop + “Sent N note(s)”;
  else “No notes matched”.
- Client version `4018.0.4`; minimum `900`.

## What this will not do

- Text the bot `notes:` and have the locked iPhone dump Notes by itself.
- Read iCloud notes that already sync to the Mac — use header **From Notes**.
- Send a file/photo instead of `message.text`.
