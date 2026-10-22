# Parking lot mockup brief (shared by all agents)

Brain2 is a personal app for someone with bad ADHD. In To Do → Sessions, a "session" is a fixed chunk of tasks with a time budget. A session can be **parked** (clock stopped, remembered line) and resumed later. The "parking lot" shows parked sessions. Today it is a plain Win95-ish popup: navy gradient caption "PARKED · FOXTIDE WORK", a black CRT clock "2:59:15", "left of 3h · parked Thu 04:33 AM", "Was on: Finish CDs", line rows, and Sessions / Resume buttons. It is functional but ugly.

Goal of the parking lot: calm to look at, zero guilt, and resuming is one obvious click. It should say what you were doing and what is next, so starting again is easy.

## Sample data (use it)
1. **Foxtide work** — 2:59:15 left of 3h, parked Thu 04:33 AM, was on "Finish CDs". Note to you later: "Start with the CD sleeves, the art is done."
   Lines: Min · Finish CDs · 1m / 4h 35m (current) | Goal · New merch designs (shirts, hoodie, tote, hat) · 0m / 5h | Exc · Book Elijah's flights · 0m / 30m
2. **Inbox zero sprint** — 18:40 left of 45m, parked Wed 9:12 PM, was on "Reply to landlord". Lines: Min · Reply to landlord · 6m / 10m | Goal · Archive newsletters · 0m / 15m
3. **Studio reset** — 1:05:00 left of 1h 30m, parked 2 days ago (show the "Resume as was" vs "Fresh clock, same lines" choice), was on "Restring guitar".
Tiers: Min (green), Goal (blue), Exc / exceptional (purple).

## House design rules (summary of docs/DESIGN_STYLE.md)
- Direction: retrofuturistic esoteric technology; old Nintendo DSi feel: pixel type, hard pixel edges, small glowing indicator lamps.
- Materials: milled fascia (brushed silver, 1px horizontal hairlines, `#5c6064` stroke, white top lip), CRT readouts in black glass `#040a08` with phosphor green `#7dffc4`, object chrome (silver rim + black-mirror well holding a precious object), nested depth (raised case → sunken well → raised controls), Win95 bevels as an ancestor, navy `#000080` focus.
- LEDs/glow: green `#7dffc4`, ice blue `#9ad7ff`, purple `#7e14ff`/`#7d6bb8` only. NO orange/amber. Red only for a true fault.
- Magic motion must be a verb (park, resume, open), not a looping sticker. `prefers-reduced-motion` snaps to end state.
- Failures: no hidden doors (don't bury actions in menus), no floating white card restack, no invented quotes.
- Neutral words, no "should", no guilt.
- Pixel font: use "VT323" or "Silkscreen" from Google Fonts as a stand-in for w95fa.

## Technical rules
- One self-contained .html file. three.js from `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` (classic script, global THREE). No other scripts. Fonts only from Google Fonts.
- Works at ~1100x700 and down to phone width (no horizontal scroll). Body has explicit background. Respect prefers-reduced-motion.
- Must be interactive: pick a parked session, see its detail, press Resume (play a short resume animation, then show a "Running" state with a reset link to go back).
- A small corner tag reading the mockup name and how far it breaks the rules.
- Keep the file under ~600 lines. Be frugal with tokens: don't explore the repo, don't re-read your file after writing, do one quick syntax check (e.g. `node --check` on the extracted script) and stop.
