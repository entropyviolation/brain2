# NFC tags to Brain2

A sticker does not write the vault. iOS binds a Personal Automation to the
tag’s hardware id, so the sticker can be blank. The automation sends one
line, `nfc:vitamin-d`, to the paired bot. Brain2 looks that id up in
Settings → Message ingest → **NFC tags** and writes the tracking instant,
plus today’s daily habit when the tag is bound to one.

The signed file is [`NFC to Brain2.shortcut`](NFC%20to%20Brain2.shortcut).
It asks for the tag id and sends `nfc:` plus that id. Pair the bot first
(Settings → Message ingest → Generate pairing code → `/start 123456` in
[@brain2_phone_bot](https://t.me/brain2_phone_bot)).

Regenerate after a wire-format change: `npm run shortcut:iphone-phone`
(`scripts/build-iphone-phone-shortcuts.mjs`). To sign only this one:
`node scripts/build-iphone-phone-shortcuts.mjs "NFC to Brain2"`.

Do **not** use `https://t.me/share` or `tg://msg`. This file uses Telegram
**Send Message**, the same as the other phone shortcuts: Ask → Get Text →
Set Variable **Outgoing** → Send Message content = Variable Outgoing only.

## Install

1. In Brain2, add the tag and copy its line (`nfc:vitamin-d`, `nfc:door`,
   `nfc:shower`).
2. On the Mac, double-click `docs/shortcuts/NFC to Brain2.shortcut`, or
   AirDrop it. On the iPhone, Settings → Shortcuts → **Allow Untrusted
   Shortcuts** if the switch is there, then Add Shortcut.
3. When it asks who to message, pick the **@brain2_phone_bot** chat.
4. For a sticker that should not ask a question, duplicate the shortcut,
   delete the Ask, and set the text action to the copied line (`nfc:door`).
5. Shortcuts → Automation → NFC → pick that sticker → run the duplicate
   immediately.

Desktop test: Settings → Message ingest → Simulate `nfc:door`.

## What a scan writes

- Unknown id: a reply, and nothing stored.
- The same tag within 20 seconds: “Already logged”, and nothing stored.
- Instant: a Tracking log point at the send time. Drug / food / drink uses
  the Intake pen. Anything else is an event on Text log.
- Optional minutes: an estimated block on an Activity pen named for that
  title, ending at the scan.
- Door toggle: first scan logs `left`, the next `back`, then `left` again.
- Daily habit, when bound: the cell is marked done, or the count gains 1.
  A weekly or monthly habit is left alone. The line is `nfc:…`, so a BIM
  keyword does not count the same tap a second time.

Keep Brain2 or `npm run phone:hub` running. A queued Telegram message uses
the send time, not the time the Mac woke up.
