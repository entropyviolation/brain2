# Mobile UI audit

_Last mapped: 2026-11-01._

Phase 1 of the phone look-and-feel pass. No code changed. The rules are `docs/MOBILE_STYLE.md`.

## Method

- Every screen was captured in Chromium at iPhone SE (375×667 @2x), iPhone 17 (402×874 @3x), and iPhone 17 Pro Max (440×956 @3x), with an iOS user agent and touch on. A DOM scan on each screen recorded targets under 44pt, inputs under 16px, clipped text, horizontal scroll, close keys under `--phone-sheet-top`, and pixel faces above their real weight. The captures are scratch files and are not checked in.
- **Planned:** a real-WebKit pass in the Simulator on the same three devices, the installed app on iPhone 17 Pro (native cards), and 1–2 real-device shots. Booting the SE and Pro Max Simulators had started when this pass stopped.
- The red "Issues" badge in the captures is the Next dev overlay. It is not part of the app.
- Not captured yet: Reviews/Rituals sheet (the button name did not match), the item detail popup, widget handhelds, the Goals and Tracking sheets, and Habits on iPhone 17 (a timing miss).

## Findings that span every screen

1. **Critical. The shell chrome covers half the screen.** `.cogs-mobile-chrome` is sticky and holds 8 action keys on 4 rows, the status line, and 6 nav keys. On SE it is about 300 of 667pt on every tab. This breaks rules 1 and 2. Quick Add should stay. Inbox, Bulk Add, From Notes, Phone Notes, Rituals, Mac, and Log out belong in a sheet. (`components/Mobile/MobileApp.tsx`, `mobile.css`)
2. **Critical. Home content starts about 4 screens down.** Widgets, then Needs Attention opened with about 100 rows (3,972 items), come before the Home tabs. To Do, Goals, and Tracking begin around 4,000–6,000pt down on SE. This breaks rule 1. (`components/Home/home-dashboard.tsx`, the phone side of Needs Attention)
3. **High. The Pull and Health cards sit on top of every room.** Lists and Inventory open on "Desktop data", the Hub URL, and the token, not on their content. They belong on the Hub page or in the Menu sheet. (`MobileApp.tsx` mounts them above every tab except BIM)
4. **High. Three visual languages.** (a) Silver keycaps on w95fa in the shell and the leaked desktop Home. (b) iOS grouped rows on `#f2f2f7` in `-apple-system` in Inventory, Goals, Tracking, and Plan. (c) The green CRT in the widgets and BIM. Each is fine on its own. Nothing ties them together: 77 hex colors, 67 rgba values, and 30+ font sizes (rem and px mixed) in phone CSS, and no shared tokens.
5. **High. Pixel face above its real weight.** w95fa renders at 600–800 in the brand, every shell key, the nav keys, and the status line (about 130 nodes per screen). `font-synthesis: none` is set, so no fringe paints today. The rule-11 intent still says do not ask for the weight. `.m-keycap.active` also has a light text-shadow (rule 11 lace).
6. **Medium. Type is small.** The most common text is w95fa 12px (about 117 nodes per screen), then 13px, then system 11px. Nothing scales with Dynamic Type.
7. **Medium. No dark mode and no shared motion.** No phone file reads `prefers-color-scheme`. Seven files handle `prefers-reduced-motion` one by one. The shell, hub, moon, and NFC hub have none, and none of them animate much.
8. **Low. z-index has no scale.** Values run from 1 to 14000.

## Shell and chrome

- **High.** The nav label "Inventory" is clipped on SE (6 keys in one row).
- **High.** The chrome is gray Win95 `#c0c0c0` and `#d4d0c8`. That is the desktop palette, not cool paper.
- **Medium.** The status line "Mac loaded." takes a full row when all is well.
- **Low.** Login: no issues found by the scan.

## Desk page and Menu sheet (the iOS app's first screen)

- The desk phone bar and Menu sheet are the most phone-shaped chrome in the app: 44pt keys, grouped sections, and the plate shows through. **Proposal:** use this as the model for the shell.
- **Medium.** The Menu sheet has icon-only keys (terminal, settings, help, search, bell). Their VoiceOver labels need checking.
- **Medium.** On Pro Max the desk scan found 108 small targets. That is the desk Home behind it.

## Home

- **Needs Attention.** **High:** checkboxes are 16×16. **High:** Split and Delete are about 42×28 on every row. **Medium:** row titles are truncated. "Hide Overdue" and the other reason keys are 29pt tall. The Widgets and Edit keys are 28pt tall.
- **Habits.** Phone rows are clean, in the iOS grouped style. The scratch pad textarea and the List / Bulk / Latest / Copy keys are small caps.
- **Plan.** The tab strip mixes caps (HABITS) with a lit CRT (PLAN). `plan-phone.css:17-18` pins the height to `100dvh - 6.5rem`. That is not a sheet, but it is fragile with this tall chrome.
- **To Do.** The phone page is clean, but it starts under Needs Attention. The "Log done" key was cut off by the bottom of the captures.
- **Goals.** Reached only after Needs Attention. Its sheets were not captured yet.
- **Tracking.** **High:** the tool tray (Draw, Erase, Scissors, Point, + Log activity, More) is fixed at the bottom and covers the Home tabs. "TRACKING" and "+ Log activi…" are clipped on SE. The sheets use `min(92dvh, …)` with `env()` only, not `--phone-sheet-top`. Rule 10 asks for that variable.
- **Moon sheet.** Close is 44pt and below the status bar, so it passes. **Medium:** in Chromium the disc paints solid black at 56% lit (check in WebKit). It uses `env()` only for its top (`mobile-moon.css:28`).

## Lists

- **High.** The desktop "Lists — File Manager" leaked onto the phone: Win98 address bar, Up, New List, New Folder, Settings, Select, Auto-organize, and 26px view keys (Icons, List, Details, Cards). That is 16 small targets. This breaks rule 1. `components/Lists/README.md` keeps this on purpose ("Lists is the visual standard"). Any phone change needs your call.

## Inventory

- Inventory, Bookshelf, Closet, and Kitchen are clean in the iOS grouped style. Six small targets and 4–6 clipped labels.
- **High.** Shopping: the room tabs (Bookshelf, Closet, Kitchen, Shopping, Gr…) scroll sideways with the last one clipped, and the scan found 224 small targets (the list picker rows).
- **Medium.** Kitchen: the Add key is gray while empty and reads as off.
- The item detail popup was not captured.

## BIM phone terminal

- No small targets. The CRT reads well. **Medium:** "LLM on" and "Clear" are the only keys, and the transcript box has a fixed tall height.

## Cards (Pull, Location, Health, NFC)

- **High:** placement (see spanning finding 3). **Medium:** the pale blue fill is a third card color, and the inputs are flat Win95 fields.
- Location and NFC show only in the iOS build. **Planned:** capture them in the app.

## Pages

- `/mobile/hub/`: one small target. Same card styling. The summary line is "Checking…" in green on gray.
- `/mobile/nfc/`: one small target. `min-height: 100dvh` on the page (not a sheet, so it is allowed).

## Overlays

- **Quick Add.** **High:** the corner close (`.keycap-close.is-corner`) is 26×26. Rule 10 requires 44. **Medium:** a 6-line help paragraph sits above the field.
- **Inbox.** 650–700 small targets (row actions). The close is the same 26pt corner key.
- Bulk Add, From Notes, and Phone Notes: about 30 extra small targets each. The closes passed.
- **Not captured yet:** Reviews/Rituals, widget handhelds, every other portaled dialog.

## Keyboard deck

- It follows rule 12: silver letters, darker modifiers. It overlaps the bottom of a sheet's form (Quick Add's Bulk/Plain row is hidden under it). **Medium:** the sheet should scroll its field above the deck.

## Screens added beyond the brief

- The desk page and its Needs Attention / widget stack, as rendered on the phone.
- The Next dev overlay (dev only). Noted so it is not mistaken for app chrome.
