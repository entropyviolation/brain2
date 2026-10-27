# NFC tags to Brain2

A sticker does not write the vault, and Brain2 does not write the sticker.
Shortcuts has no action that programs an NFC chip. iOS binds a Personal
Automation to the tag’s hardware id, so the sticker stays blank. There is
no second “write” shortcut to run once and delete. The phone remembers the
chip when you scan it in Automation → NFC. The run shortcut opens Telegram
with one line filled in. Tap Send. Brain2 looks that id up in Settings → **NFC tags**
and writes the tracking instant, plus today’s daily habit when the tag is
bound to one. The iPhone app can read that same blank chip and post the line
to the hub. That path is [below](#phone-reader). This shortcut stays until
you trust that scan.

Each saved tag has its own signed shortcut. Settings → **NFC tags** → the
download button on that row. Brain2 writes `NFC {name}.shortcut` into
Downloads and shows it in Finder. The tag id is already in the file, so the
automation does not ask which sticker this is.

- A Drug, Food, or Drink tag asks **How many?** Blank uses the quantity saved
  on the tag. `2` opens Telegram with `nfc:adderall 2`. Tap Send.
- A door or a plain event opens Telegram with `nfc:{id}` and asks nothing.
  Tap Send.

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

The per-tag file from Settings does **not** use Send Message. Telegram only
accepts that action for a saved person whose id starts with `tg`. A bot chat
fails, and Shortcuts shows “unknown error”. The file URL-encodes the line
and opens `tg://resolve?domain=brain2_phone_bot&text=…`. Tap Send. That
message is a normal bot text. `https://t.me/share` and a bare `tg://msg`
still do not arrive, because they never address this bot.

The shared files (`NFC to Brain2`, `NFC dose to Brain2`) still use Send
Message for a hand-typed id. A dose from Settings asks how many, then opens
the chat. A door opens the chat with no question.

## Install

1. Settings → **NFC tags**. The fields are labeled. Add the tag. For a dose,
   the title is the name without the count (`10 mg adderall`), intake is
   Drug, Food, or Drink, and Quantity is the usual count (1).
2. Click the download button on that row. The signed file lands in Downloads.
   Delete any older copy of that shortcut on the iPhone first. Double-click
   the new file, or AirDrop it. On the iPhone, Settings → Shortcuts →
   **Allow Untrusted Shortcuts** if the switch is there, then Add Shortcut.
3. Run it once. Telegram opens with the line filled in. Tap **Send**.
4. Shortcuts → Automation → **+** → **NFC** → Scan → hold the phone on the
   blank sticker → name it → **Run Immediately** → turn Notify When Run off
   → New Blank Automation → **Run Shortcut** → the shortcut from step 2.
   A dose still asks how many, then opens Telegram. A door opens Telegram
   with the line ready. The chip itself stays empty. Tap Send each time.

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

## Phone reader

_Last mapped: 2026-10-27_

The vault stays on the Mac. While `npm run phone:hub` is awake, a client can
post one scan line. The bearer is `BRAIN2_PHONE_HUB_TOKEN`. Unset keeps this
door shut, even when the vault routes are open.

```bash
curl -sS -X POST http://127.0.0.1:8787/api/scan \
  -H "Authorization: Bearer $BRAIN2_PHONE_HUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"nfc:adderall 2","id":"try-1"}'
```

`GET /api/nfc/tags` with the same bearer returns id, name, kind, intake, and
quantity. A repeat of the same `id` does not log twice. The 20-second
double-read pause still applies. The hub does not text Telegram back.

The iPhone app (`components/Mobile/nfc/MobileNfcCard.tsx`) reads the sticker’s
hardware id (`ios/App/App/NfcPlugin.swift`). The first tap asks which saved
tag that chip is. The phone remembers it (`brain2-nfc-chips` in the app).
A dose asks how many. Blank posts `nfc:{id}` so the Mac uses the saved
quantity. A door or a plain event posts with no question. The card holds the
hub URL and the same token.

The sticker stays blank. This build does not write a payload onto the chip.
NDEF is in the entitlement so a later write does not need a second capability.

What is still true:

- A website, including `/mobile` in Safari, cannot read or write an NFC tag.
  The reader is the sideload app, and only on a real iPhone. The Simulator
  cannot scan.
- The App ID `com.cogs.mobile` needs NFC Tag Reading in the Apple Developer
  portal. A free provisioning profile cannot scan. The rest of the app still
  installs.
- Web NFC does not run in this Electron app or in iOS Safari.
- Android can wait.

The signed shortcut above stays. It is the reader until a physical tap
through the app writes the vault and you decide the shortcut can go. Do not
delete the download, the automation, or the Telegram send before that.
