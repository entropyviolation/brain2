# Brain2 Chrome History

_Last mapped: 2026-10-27_

A Chrome extension that, at **12:05am local time**, exports the calendar day that just ended.

It does two things with that day:

1. Posts it to Brain2 at `http://127.0.0.1:3000/api/chrome-history` (loopback only). When Brain2 is open there — `npm run dev`, `electron:dev`, or `electron:local` — the app files the visits into Data → Sources → Browser and paints new stretches on Screen Time. Visits already kept are not added again.
2. Saves `Downloads/Brain2 Chrome/{profile} {day}.json`. The same page can take that file by hand. The box in the popup turns the file off.

If Chrome was asleep or quit at midnight, the missed alarm runs the next time Chrome starts, and each missing day is exported in turn. The first install exports yesterday. **Send the history Chrome still has** walks the roughly 90 days Chrome still stores.

The profile name in the popup is the name Brain2 keeps. One extension install is one Chrome profile. Load it in each profile you want, and give each a different name.

A packaged Brain2 window on `app://` has no local API. The JSON file is the export there. Drop it on Sources → Browser.

## Install

1. Chrome → `chrome://extensions` → turn on **Developer mode**.
2. **Load unpacked** → this folder (`extensions/chrome-history`).
3. Leave Chrome running. Brain2 should be open at localhost:3000 for the night to file itself. If it is closed, the extension keeps the day and tries again. The JSON file is written either way, unless the popup box is off.

Chrome’s “Ask where to save each file” setting still prompts. Turn that off if the night should be silent.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | History, alarms, storage, downloads. Talks only to port 3000 on this machine. |
| `background.js` | 00:05 alarm, history read, post, download, retry. The file is a data URL: the service worker has no `URL.createObjectURL`. |
| `export-day.mjs` | Local midnight math. Tested in `export-day.test.ts`. |
| `content.js` | Hands a waiting day to a Brain2 tab on localhost. |
| `popup.html` | Profile name, file toggle, export yesterday, backfill. |
