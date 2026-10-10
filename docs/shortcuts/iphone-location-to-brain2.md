# iPhone location to Brain2

The Telegram bot cannot pull location off the iPhone. The phone has to send
it. Pair [@brain2_phone_bot](https://t.me/brain2_phone_bot) first, and keep
`npm run phone:hub` running (or the Brain2 desktop) so a sample is written
onto the Location grid at the time the phone recorded it.

A place that is already the current Location pen does not get another reply.
That is what keeps a live share from flooding the chat. While a text ritual
is open (morning, night, start, or end), those updates are ignored. The
Telegram share stays on, and the next edit after the ritual ends is recorded
again.

The signed file lives next to this note:

[`Location to Brain2.shortcut`](Location%20to%20Brain2.shortcut)

You do **not** rebuild it in the Shortcuts app. AirDrop (or iCloud Shortcuts)
installs it. Pair the bot first (Settings → Message ingest → Generate pairing
code → `/start 123456` in the bot chat).

Regenerate after a wire-format change: `npm run shortcut:iphone-phone`
(`scripts/build-iphone-phone-shortcuts.mjs`, signed `--mode anyone`).

Each run appends one timestamped line to a file on the phone, then sends the whole file:

```
gps-log:
2026-10-05T19:04:00;37.7694,-122.4862;Home
```

Brain2 paints Location **up to that minute**. It does not fill the rest of the day, and it does not keep a block open into the future. The same coordinates keep the pen you already have, so a reverse-geocoded restaurant name does not move you while you are still standing in the same spot. A Telegram **venue** pin (a restaurant card, a dropped place) is a shared place, not where the phone is.

The file is `iCloud Drive/Shortcuts/Brain2-location-log.txt`. The shortcut appends the new fix first. If Telegram cannot send, later actions do not run, so the file still holds the line. The next run that can send delivers every saved line, then clears the file. Re-import this shortcut after pulling the repo — an older copy sent `gps:` with no timestamp and no log.

Do **not** use `https://t.me/share` or `tg://msg` — those do not land as a user
message on the bot poller. This file uses Telegram **Send Message**, same as
the Notes dump: Get Text → Set Variable **Outgoing** → Send Message content =
Variable Outgoing only.

## Install on the iPhone

**Delete any older Location to Brain2 first**, then re-import this file.
Older copies painted from the moment they sent until the end of the day, and
they did not keep a log for when the phone was offline. They also handed Send
Message a Get Text ActionOutput token instead of Variable **Outgoing**, which
made iOS say “could not run Send Message”.

### Same Apple ID as this Mac (easiest)

1. Pair [@brain2_phone_bot](https://t.me/brain2_phone_bot) in Brain2 Settings.
2. On the Mac, double-click
   `docs/shortcuts/Location to Brain2.shortcut`.
3. Shortcuts.app adds it. If **iCloud → Shortcuts** is on, it appears on the
   iPhone in a few seconds — open Shortcuts there and run it.
4. First add/run asks **who to send to**. Pick the Telegram conversation with
   the bot (open that chat once in Telegram if it is missing). It also asks
   where to keep the log — pick **iCloud Drive** each time (append, read, and
   clear all use the same folder).

### AirDrop / Files (different Apple ID, or iCloud Shortcuts off)

1. Pair the bot as above.
2. On the **iPhone**: Settings → Shortcuts → turn on **Allow Untrusted
   Shortcuts**. If that switch is missing, run any shortcut from the Gallery
   once, then come back.
3. On the Mac, in Finder, AirDrop
   `docs/shortcuts/Location to Brain2.shortcut` to the iPhone.
   (No AirDrop: Mail it to yourself, or drop it in iCloud Drive / Files.)
4. On the iPhone, tap the file. Shortcuts opens → **Add Shortcut**.
5. When it asks for the recipient, pick the **@brain2_phone_bot** chat — not a
   friend, not a group. When it asks for a file service, pick **iCloud Drive**.

Finder → right-click the `.shortcut` → Share → AirDrop is the same file.

The `--mode anyone` signature is why a tap on the phone is enough. An unsigned
plist will not import.

## Personal Automations (Arrive / Leave / Time of Day)

iOS will not run a shortcut every few minutes in the background. Personal
Automations that fire on **Arrive**, **Leave**, and optional **Time of Day**
triggers are the consistent Shortcut pattern. Turn **Ask Before Running** off
on each one.

1. Duplicate **Location to Brain2** once per place you care about (or reuse the
   same Shortcut — it always reads the current fix).
2. Shortcuts → **Automation** → Create Personal Automation:
   - **Arrive** at Home, work, the gym — run Location to Brain2.
   - **Leave** those places — run it again.
   - **Time of Day** once in the morning and once in the evening, as a catch
     when you did not cross a saved fence.
3. Turn **Ask Before Running** **off**.

Each run records one fix at that moment (about fifteen minutes ending then, or a continuation of the same place if the previous sample was recent). It does not paint from now until midnight. Live Location (below) fills the time in between while the phone is online. The on-phone log fills the gap when a run happened but Telegram could not deliver.

## Live Location (the continuous stream)

This is the closest thing to a stream. No Shortcut.

1. Open the chat with the bot.
2. Attach → Location → **Share Live Location** → **Until I turn it off**
   (or the longest duration Telegram offers).
3. On the iPhone: Settings → Telegram → Location → **Always**.
4. Leave the share on. Telegram sends updates; Brain2 extends Location up to
   each new sample and stays quiet while you are still there. Those points
   stay off the header Message ingest log unless you press **Show GPS**.
   An update that arrives late is applied at the time Telegram edited it,
   not at the moment the laptop happened to read the queue.

Limits, stated plainly:

- The share lasts until you stop it, or until Telegram’s live-location cap
  (a day on current clients). It is not a forever background tracker.
- iOS will pause it if Telegram is not allowed to use location in the
  background, or if Low Power Mode is aggressive.
- The pin is coordinates. Without a venue name the pen is labeled from the
  rounded lat,lon until you name that repeated place on Analytics → Places
  (a second visit, within 80 meters). The Shortcut above can still attach
  the name “Home” on the message itself.

## Type it

```
gps: Home
```

or, with a fix:

```
gps: Cafe
37.7694,-122.4862
±12m
```

`at: Home` still works when you only want the name and already have that pen.

Desktop test (no phone): Settings → Message ingest → Simulate `gps: Home`.

## What this will not do

- Let the bot pull location off the phone by itself.
- Poll every few minutes in the background (iOS will not do that).
- Invent the hours between two samples that are far apart. A fix at 9:00 and
  the next at 17:00 are two short blocks, unless the on-phone log or Live
  Location recorded the time in between.
- Replace Live Location for continuous movement — Arrive/Leave plus the
  on-phone log is the named-place path; Live Location is the continuous stream.
