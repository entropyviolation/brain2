# NFC tags to Brain2

A sticker does not write the vault. iOS binds a Personal Automation to the
tag’s hardware id, so the sticker can be blank. The automation sends one
line to the paired bot. Brain2 looks that id up in Settings → **NFC tags**
and writes the tracking instant, plus today’s daily habit when the tag is
bound to one.

Each saved tag has its own signed shortcut. Settings → **NFC tags** → the
download button on that row. Brain2 writes `NFC {name}.shortcut` into
Downloads and shows it in Finder. The tag id is already in the file, so the
automation does not ask which sticker this is.

- A Drug, Food, or Drink tag asks **How many?** Blank uses the quantity saved
  on the tag. `2` sends `nfc:adderall 2`.
- A door or a plain event sends `nfc:{id}` and asks nothing.

The two shared files are still here if you would rather type the id yourself:

- [`NFC to Brain2.shortcut`](NFC%20to%20Brain2.shortcut) asks for the tag id
  and sends `nfc:` plus that id.
- [`NFC dose to Brain2.shortcut`](NFC%20dose%20to%20Brain2.shortcut) asks for
  the tag id, then how many.

Signing the per-tag file uses `shortcuts sign` on this Mac
(`electron/nfc-shortcut.js`). The shared files are regenerated with
`npm run shortcut:iphone-phone`. Restart the desktop app after that bridge
changes so the download button is wired.

Pair the bot first (Settings → Message ingest → Generate pairing code →
`/start 123456` in [@brain2_phone_bot](https://t.me/brain2_phone_bot)).

Regenerate after a wire-format change: `npm run shortcut:iphone-phone`
(`scripts/build-iphone-phone-shortcuts.mjs`). To sign one name:
`node scripts/build-iphone-phone-shortcuts.mjs "NFC dose to Brain2"`.

Do **not** use `https://t.me/share` or `tg://msg`. These files use Telegram
**Send Message**: Get Text → Set Variable **Outgoing** → Send Message
content = Variable Outgoing only. A dose still has an Ask for the count. A
per-tag door shortcut has no Ask.

## Install

1. Settings → **NFC tags**. The fields are labeled. Add the tag. For a dose,
   the title is the name without the count (`10 mg adderall`), intake is
   Drug, Food, or Drink, and Quantity is the usual count (1).
2. Click the download button on that row. The signed file lands in Downloads.
   Double-click it, or AirDrop it. On the iPhone, Settings → Shortcuts →
   **Allow Untrusted Shortcuts** if the switch is there, then Add Shortcut.
3. When it asks who to message, pick the **@brain2_phone_bot** chat.
4. Shortcuts → Automation → NFC → pick that sticker → run the shortcut you
   just added. Turn Ask Before Running off. A dose still asks how many. A
   door does not ask.

Desktop test: Settings → Message ingest → Simulate `nfc:adderall 2`.

## What a scan writes

- Unknown id: a reply, and nothing stored.
- The same tag within 20 seconds: “Already logged”, and nothing stored. That
  pause is only so one physical tap cannot log twice. Two pills are one
  message with a quantity, not two taps.
- `nfc:adderall` uses the quantity saved on the tag (1 when you leave it).
  `nfc:adderall 2` logs two on that scan. A door tag ignores the number.
- Instant: a Tracking log point at the send time. Drug / food / drink uses
  the Intake pen, and the title is the count plus the saved name
  (`1 10 mg adderall`, `2 10 mg adderall`). Anything else is an event on
  Text log. A plain event keeps its title when the count is 1, and gains the
  count in front when it is more than 1.
- Optional minutes: an estimated block on an Activity pen named for that
  logged title, ending at the scan.
- Door toggle: first scan logs `left`, the next `back`, then `left` again.
- Daily habit, when bound: the cell is marked done, or the count gains the
  scan’s quantity. A weekly or monthly habit is left alone. The line is
  `nfc:…`, so a BIM keyword does not count the same tap a second time.

Keep Brain2 or `npm run phone:hub` running. A queued Telegram message uses
the send time, not the time the Mac woke up.

## Planned: NFC inside the phone app

_Last mapped: 2026-10-27_

The sticker should be written and read from the Brain2 phone app. A tap
would ask how many, when the tag is a dose, and write the vault directly.
No Telegram chat, no imported Shortcut, no hand-edited text action.

What stops that now:

- An iPhone website or installed web page cannot read or write an NFC tag.
  Apple only allows that in a native app (Core NFC, with the entitlement) or
  in the Shortcuts app. The `/mobile` page is a sideload shell. It is not an
  NFC client.
- Web NFC (`NDEFReader`) exists in Chrome on Android only. It does not run
  in this Electron app on the Mac, and it does not run in iOS Safari.
- The vault is on the Mac, in Electron storage. A phone tap cannot write
  that storage. Today the phone reaches it by texting BIM. The phone hub
  (`npm run phone:hub`) is already a direct pipe, and a future client should
  post the scan there. Telegram is the pipe we have, not the model we want.
- Programming a payload onto the sticker needs the same native NFC
  permission. A blank sticker plus an iOS automation is the only way a tap
  runs without a URL on the tag.

Until a native phone client exists, the signed shortcut from Settings is the
reader. Android can wait. One download per tag, then an NFC automation that
runs it. A dose still asks how many. A door does not.
