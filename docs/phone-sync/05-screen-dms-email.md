# 05 · Screen Time, DMs, email

_Last mapped: 2026-10-25_

**Wave 2.** Needs `00-core.md`.

## Screen Time

No iOS API hands raw usage to an app. Add a Shortcuts **personal automation** per tracked app ("When Instagram is opened") that sends `screen: Instagram open`. Edit `scripts/build-iphone-phone-shortcuts.mjs`. Mac usage stays on ActivityWatch.

## DMs

- Telegram: already the BIM channel.
- Instagram and others: no live API for personal DMs. Import the account data download on a schedule, like the followers import (Settings → Import from Instagram data). Owns `lib/phone-sync/dm-import.ts`.

## Email

IMAP read by the hub. Gmail needs an app password, stored only on the Mac. Store from, to, subject, and time by default. Bodies only when the person turns them on in Settings (off by default), matching the plan. The "keep bodies" decision of 2026-10-22 was about texts. Owns `lib/phone-sync/email.ts` and `scripts/email-reader.mjs`.

## Done

- Settings → Phone sync already names Screen Time, DMs, and email, and says they are not built. A last run appears once a reader exists.
