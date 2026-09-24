# iPhone Screen Time pings to Brain2

Apple has **no public Screen Time API**. Shortcuts cannot read the Screen Time
database. This Shortcut sends a **start ping** (`screen: AppName`). There is no
reliable app-close. Minutes land on Tracking → **iPhone Screen Time**, never
Mac **Screen Time** (ActivityWatch).

The signed file lives next to this note:

[`Screen Time to Brain2.shortcut`](Screen%20Time%20to%20Brain2.shortcut)

You do **not** rebuild it in the Shortcuts app. AirDrop (or iCloud Shortcuts)
installs it. Pair the bot first (Settings → Message ingest → Generate pairing
code → `/start 123456` in [@brain2_phone_bot](https://t.me/brain2_phone_bot)).

Regenerate after a wire-format change: `npm run shortcut:iphone-phone`
(`scripts/build-iphone-phone-shortcuts.mjs`, signed `--mode anyone`).

A downloadable Shortcut **cannot** bind a variable “opened app” name. This file
**Asks for the app name** (or uses Shortcut Input if something is shared in),
then **Send Message** to the bot: `screen: {answer}`. That is a manual ping.

For a true app-open automation, still AirDrop this file, then either:

- **Automation** → **App Is Opened** → **Run Shortcut** → Screen Time to Brain2
  (it will Ask each time unless you edit it), or
- Duplicate it per app, replace **Ask** with a **Text** of that app’s name
  (`Instagram`), and attach the duplicate to that app’s **Is Opened**
  automation with **Ask Before Running** off.

Do **not** use `https://t.me/share` or `tg://msg` — those do not land as a user
message on the bot poller. This file uses Telegram **Send Message**, same as
the Notes dump: Get Text → Set Variable **Outgoing** → Send Message content =
Variable Outgoing only.

## Install on the iPhone

**Delete any older Screen Time to Brain2 first**, then re-import this file.
Older copies handed Send Message a Get Text ActionOutput token instead of
Variable **Outgoing**, which made iOS say “could not run Send Message” when
you typed an app name in the Shortcuts app.

### Same Apple ID as this Mac (easiest)

1. Pair [@brain2_phone_bot](https://t.me/brain2_phone_bot) in Brain2 Settings.
2. On the Mac, double-click
   `docs/shortcuts/Screen Time to Brain2.shortcut`.
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
   `docs/shortcuts/Screen Time to Brain2.shortcut` to the iPhone.
   (No AirDrop: Mail it to yourself, or drop it in iCloud Drive / Files.)
4. On the iPhone, tap the file. Shortcuts opens → **Add Shortcut**.
5. When it asks for the recipient, pick the **@brain2_phone_bot** chat — not a
   friend, not a group.

Finder → right-click the `.shortcut` → Share → AirDrop is the same file.

The `--mode anyone` signature is why a tap on the phone is enough. An unsigned
plist will not import.

## Run it

- **Shortcuts app** → Screen Time to Brain2 → type `Instagram` (or Safari, …).
- **Automation**: App Is Opened → Run this Shortcut (or a duplicate with the
  name hardcoded). Turn **off Ask Before Running** only on the hardcoded copy.

It always Asks for the app name, including from the Share Sheet. The Shortcut
contains **no If action**: a hand-written one imports with an empty condition
and iOS refuses to run the whole Shortcut.

Wire: Ask → Set Variable **App** → Get Text (`screen: {App}`, output name
**Text**) → Set Variable **Outgoing** → Send Message content = Variable
Outgoing only. Never pass a Get Text ActionOutput into Telegram.

Keep Brain2 or `npm run phone:hub` polling.

## Telegram phrase

```
screen: Instagram
screen: Instagram 30m
screen: Safari 9-11
```

Aliases: `screentime:`, `phone-screen:`, `iphone:`, `ios:`. Duration ending now,
or an explicit clock window, same as `track:`. Bare app name paints from now
until the next ping (estimated).

Desktop test: Settings → Message ingest → Simulate `screen: Instagram 30m`.

## What this will not do

- Import Apple Screen Time or ActivityWatch-on-iPhone (there is no iOS
  ActivityWatch).
- Paint Mac **Screen Time**. That view stays ActivityWatch on this computer.
- Know when you left the app. Open-to-open is a start ping.
- Pass the opened app’s name automatically from a downloadable file. Hard-code
  it in a duplicate if you want a silent Personal Automation.
