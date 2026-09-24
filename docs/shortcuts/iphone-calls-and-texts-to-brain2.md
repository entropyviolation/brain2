# iPhone Calls and Texts to Brain2

Stock iOS **cannot** let Brain2 or Shortcuts silently watch all phone
activity, read the Phone recents database, intercept CallKit, or read
iMessage/SMS bodies. There is no full recents import and no auto-log of every
text. What works is a phrase you send, or a Shortcut you AirDrop and opt into.

The signed files live next to this note:

- [`iPhone Call to Brain2.shortcut`](iPhone%20Call%20to%20Brain2.shortcut) —
  Ask for name + duration, send `call: Name 12m`.
- [`iPhone Text to Brain2.shortcut`](iPhone%20Text%20to%20Brain2.shortcut) —
  Share Sheet from Messages (or Ask for the body), Ask for the recipient,
  send `text: Name body`.

You do **not** rebuild them in the Shortcuts app. AirDrop (or iCloud Shortcuts)
installs them. Pair the bot first (Settings → Message ingest → Generate pairing
code → `/start 123456` in [@brain2_phone_bot](https://t.me/brain2_phone_bot)).

Regenerate after a wire-format change: `npm run shortcut:iphone-phone`
(`scripts/build-iphone-phone-shortcuts.mjs`, signed `--mode anyone`).

Minutes land on Tracking → **iPhone Calls** or **iPhone Texts**. They never
paint Mac **Screen Time**, **iPhone Screen Time**, or **Activity**. Open that
view’s Activity Log to see when + who + how long (calls) or the body + who +
when (texts).

Do **not** use `https://t.me/share` or `tg://msg` — those do not land as a user
message on the bot poller. These files use Telegram **Send Message**, same as
the Notes dump: Get Text → Set Variable **Outgoing** → Send Message content =
Variable Outgoing only.

## Install on the iPhone

**Delete any older iPhone Call / iPhone Text to Brain2 first**, then re-import
these files. Older copies handed Send Message a Get Text ActionOutput token
instead of Variable **Outgoing**, which made iOS say “could not run Send
Message”.

### Same Apple ID as this Mac (easiest)

1. Pair [@brain2_phone_bot](https://t.me/brain2_phone_bot) in Brain2 Settings.
2. On the Mac, double-click
   `docs/shortcuts/iPhone Call to Brain2.shortcut` and
   `docs/shortcuts/iPhone Text to Brain2.shortcut`.
3. Shortcuts.app adds them. If **iCloud → Shortcuts** is on, they appear on the
   iPhone in a few seconds — open Shortcuts there and run them.
4. First add/run asks **who to send to**. Pick the Telegram conversation with
   the bot (open that chat once in Telegram if it is missing).

### AirDrop / Files (different Apple ID, or iCloud Shortcuts off)

1. Pair the bot as above.
2. On the **iPhone**: Settings → Shortcuts → turn on **Allow Untrusted
   Shortcuts**. If that switch is missing, run any shortcut from the Gallery
   once, then come back.
3. On the Mac, in Finder, AirDrop both `.shortcut` files to the iPhone.
   (No AirDrop: Mail them to yourself, or drop them in iCloud Drive / Files.)
4. On the iPhone, tap each file. Shortcuts opens → **Add Shortcut**.
5. When it asks for the recipient, pick the **@brain2_phone_bot** chat — not a
   friend, not a group.

Finder → right-click the `.shortcut` → Share → AirDrop is the same file.

The `--mode anyone` signature is why a tap on the phone is enough. An unsigned
plist will not import.

## Telegram phrases

```
call: Jane 12m
called: Mom 3:02-3:17
phone-call: Dad 8m

text: Jane on my way
sms: Jane running late
imessage: Mom see you at 6
sent: Jane ok
```

Calls are estimated intervals. A bare `call: Jane` is a 1-minute ping at now
(a start mark). Texts are instants at send time; the first word is who, the
rest is the body (title and notes).

Desktop test: Settings → Message ingest → Simulate those lines.

## Calls — after the call

1. After you hang up, run **iPhone Call to Brain2**. It Asks **who** and **how
   long** (`12m` or `3:02-3:17`; blank duration is a 1-minute ping).
2. Or text the bot `call: Name 12m` (or tell Siri to send that message to
   @brain2_phone_bot).
3. Optional: **Shortcuts** → **Automation** → **Phone** / **Call** if your iOS
   version lists “When a call starts” or “When a call ends”.
   - Run **iPhone Call to Brain2** (you will still type the name — Apple **does
     not pass caller ID** into most Personal Automations).
   - A hardcoded `call: Unknown` automation is possible; you will usually want
     the Ask instead.
   - Turn **off Ask Before Running** only if you accept that limitation.
4. Do **not** expect a dump of Recents.

## Texts

1. AirDrop **iPhone Text to Brain2**.
2. It Asks for the **body**, then **who**, and sends `text: Name body`.
3. It always Asks, including from the Share Sheet: the Shortcut contains **no
   If action**, because a hand-written one imports with an empty condition and
   iOS refuses to run the whole Shortcut.
4. Shortcuts cannot look up the thread’s person. Type the name when asked.

Typing `text: Jane on my way` in Telegram is the honest everyday path.

## What this will not do

- Read Phone Recents, CallKit, or the Messages database.
- Log every call or iMessage automatically.
- Import Apple Screen Time.
- Paint Activity or Mac Screen Time.
