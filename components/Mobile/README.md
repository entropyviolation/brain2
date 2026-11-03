# `components/Mobile/` — iOS / sideload Home shell

Mobile entry for **Home** (Habits, Plan, To Do, Goals, Tracking — including nested sub-tabs), **Lists**, and **Inventory**. Native / PWA name is **BRAIN2**. Reuses `HomeDashboard` so desktop data stays intact. Moon, inside that dashboard, opens a phone sheet on this shell. Other widget details stay the desktop handheld. On this shell that handheld, and every other portaled dialog, starts below the status bar so the close key can be tapped. Electron does not mount this shell.

_Last mapped: 2026-10-28._ The page field behind the shell is the default Snowflake plate (`/pcb/mint.jpg`), including when a saved desktop pin is plain teal. The photograph scrolls; a fixed attachment does not paint on iOS.

## Phone window

_Last mapped: 2026-10-30._ Before this, Health totals imported on the phone never reached the Mac, so Data → Health stayed empty (workouts and sleep did, as time grid and sleep patches). After login the shell loads the Mac's vault from `GET /api/persist?canon=1` into memory (`lib/phone-window.ts`). Home, Lists, and Inventory read that memory. The full snapshot is not written into the 5 MB web-storage box. A save of lists, the time grid, planned actions, ingest, the telegram feed, plan text, habits, sleep, goals, or the Health daily totals (`health-import`, `days` only) is a field patch, queued until the Mac answers. Events, kitchen, modules, and item types show in that session and do not write back. The iPhone app asks for Local Network access; that is how it reaches the Mac. Denying it leaves Home and Lists empty. A reload paints a small IndexedDB cache first, then swaps in the Mac's copy. Each store waits for that data before its first read, so none boots on its seed. Edits made in the first moment after a copy lands stay on the phone, so a habit sync on half-loaded data cannot delete rows on the Mac. If the Mac does not answer, that cache stays and is marked stale. The top row has a **Mac** key (✓ loaded, … loading, ✕ failed; tap to reload). The line under that row names the step while loading and the reason after a miss. On iOS the page is served by `StaticExportRouter` in `ios/App/App/AppViewController.swift`, so `/mobile/` and `/mobile/nfc/` get their own pages. `MobilePullCard` refetches this window, and every running store refills from it (not only lists, habits, and the other patched stores). An edit to a store that does not write back is gone after a refresh. Settings → Mobile Sync can still force a snapshot through `data/mobile-sync.json`; that is the old copy, and the window does not use it. Texts, calls, and location stay on Settings → **Phone sync**. The spare Mac as the one file is **Planned** ([`docs/PHONE_WINDOW_PLAN.md`](../../docs/PHONE_WINDOW_PLAN.md) phases 4–5). _Last mapped: 2026-11-01._ While the app is open, it checks the Mac's write stamp every 15 s and reloads the window, at most once a minute, after a write that did not come from the phone (`lib/hub-stamp-watch.ts`). A desk edit now reaches an open phone without pull to refresh.

## iPhone app opens the desk

_Last mapped: 2026-11-01._ The iOS app starts on the desk page (`capacitor.config.ts` has no `appStartPath`). The phone shell stays at `/mobile/`; the app no longer opens it on launch, by request. The desk's phone bar is Back, Forward, BRAIN2, +, BIM Chat, Menu. On the phone, BRAIN2 and the Go key labels (Home, Lists, …) use `w95fa`, the same face as Home's weekday plate (`components/shell-chrome.css`, 2026-11-01). In the iOS app its Menu sheet adds a **Phone** group after Capture (`phone-desk-keys.tsx`): the **Mac** key (✓ loaded, … loading, ✕ failed; tap to reload) with its status line, NFC (opens `/mobile/nfc/`), Bulk Add, From Notes, and Phone Notes. Refresh stays the left key of that sheet. Inbox, Quick Add, and Rituals (the shell's Reviews) were already in the sheet. On mount the group engages and loads the Mac window, the same as the shell. BIM Chat is the `>_` key on the phone bar between + and Menu (2026-11-01). It used to sit in the sheet: the sheet closes when any button inside it is clicked, and React passes clicks from a portaled dialog up through the sheet, so every tap in BIM Chat closed the sheet, and BIM Chat closed with it. The sheet now ignores clicks from outside its own DOM. `PhoneKeyboard` mounts the keycap keyboard outside the sheet, which the desk page otherwise lacks. Stores first hydrate from the phone's own storage, then rehydrate from the Mac. A desktop browser and Electron render nothing for this group.

## Mobile hub

_Last mapped: 2026-10-30._ `/mobile/hub/` (`app/mobile/hub/page.tsx`, `hub/MobileHub.tsx`) watches every phone link on one page. Rows: Mac data, Hub (a `/api/sync/status` ping, 6 s), phone edits waiting in the outbox, Location, Health, NFC, and how many days the sideloaded app still opens. Each row has a tone (ok, warn, bad, off) and, when not ok, the fix to try. The summary line names what is broken. `lib/mobile/hub-checks.ts` words the rows from plain input and has the tests; the screen only gathers input. Below the rows are the Pull, Location, Health, and NFC cards, so a broken link can be fixed on the same page. It rechecks every 15 s and when the Mac window settles. Opened from **Mobile hub** in the desk Menu's Phone group and **Hub** in the shell nav. `lib/phone-window.ts` gained `getPhoneWindowReport()` (hub address, last load time, outbox count). A log of past failures is **Planned**.

## Keycap deck: dropped letters and sudden closes

_Last mapped: 2026-11-01._ Seen in BIM Chat on the iPhone app. Three bugs: a letter missed now and then, the deck closing mid-typing, and then BIM Chat itself closing. What changed:

- **No dead gaps.** The deck takes every touch, not each cap (`onDeckDown` in `keyboard/mobile-keyboard.tsx`). A tap in the 5–6px gap between caps, or on the deck's edge, goes to the nearest cap (`nearestKey` in `keyboard-logic.ts`, which weighs a vertical miss more than a sideways one). Caps register their action in a `WeakMap`; they no longer have their own pointer handlers. A pressed cap gets `.is-down`, because cancelled touches leave iOS `:active` unreliable.
- **Fingers are counted.** The old `holding` flag went off 80 ms after any key lifted. The timer was never cleared, so with two thumbs it could go off while the next key was still down, and a blur then closed the deck. Each pointer is now tracked by id and leaves the set 80 ms after it lifts.
- **Grace close.** A blur that hide, return, or a closed field did not ask for leaves the deck up for 350 ms. A key tap in that time refocuses the field and types. Before this, the deck vanished and the next keystroke hit the dialog scrim, which Radix read as a tap outside, so BIM Chat closed.
- **Bottom edge.** While the deck is open, `BrainKeyboard` (in `ios/App/App/AppViewController.swift`, JS `lib/mobile/keyboard-bridge.ts`) defers the bottom screen edge. iOS then stops holding bottom-row taps while it checks for a home swipe. Home takes a second swipe while the deck is up. Reachability is not covered.
- **BIM log memoized.** `ChatLog` in `components/Bim/console/bim-console.tsx` no longer re-renders on each keystroke.

Second pass, same day:

- **Space shows at once.** A focused field is now typed through `document.execCommand` (`insertText`, `delete`), the browser's own editor. Setting `.value` left the iOS caret before a trailing space until the next key. The value setter stays as the fallback. Undo now works too.
- **No screen jerk.** In the iPhone app every field is armed (`inputmode=none`) as it lands in the page, by a `MutationObserver`, and stays armed after blur. Quick Add focuses its box on open; before, that summoned the system keyboard for a moment, and iOS shoved the whole screen down under the status bar. `revealField` no longer calls `scrollIntoView`; it scrolls only the field's nearest scrolling box, and the page only when the field is outside a fixed layer.
- **Slides up.** The deck rises from the bottom edge (260 ms). Reduced motion turns it off. It does not slide down yet.
- **Mic cap.** A mic glyph at rest. While listening the cap stays pushed in, with a red square LED (`.is-live`, `.m-kb-led`), not the green CRT.
- **Dictation keeps earlier words.** After a pause iOS starts a fresh transcript. `SpeechPlugin.swift` now keeps the words before the pause (`committed`), so "hello", a pause, then "world" reads "hello world". A new transcript is a partial that comes 0.7 s or more after the last one and starts on a different word. Start skips the permission prompts once both are granted, and sets the audio session up only once.

Third pass, 2026-11-02 (closes still happened, only inside pop-ups):

- **Deck taps stop at the deck.** `onDeckDown` stops `pointerdown` from reaching `document`. A Radix dialog hears it there, waits for a click for touch, and the deck swallows that click. Once the deck re-rendered or closed, the dialog judged a tap on a node that was gone as outside and closed the whole pop-up.
- **The page's own blur no longer closes the deck.** Only a blur within 900 ms of a tap outside the deck starts the 350 ms close. Any other blur (a re-render, a dialog moving focus) leaves it up, and the next key refocuses the field (`revive` now always runs). A tap on the page with no field focused puts it away.
- **Return no longer arms a close.** `closing` was set by any return except a newline and cleared only on blur, so after a submit (a chat box) the next stray blur closed the deck with no safety net. Only a return that blurs sets it, and it expires after 500 ms.
- **Mic cap.** Icon and LED are centered on the face. Listening is the same pressed modifier cap as any held key, with a brick-red LED (`#7A3C31` to `#78292E`).

A pop-up of the pressed letter, a haptic tap, and a slide-down on close are **Planned**.

## Folders

_Last mapped: 2026-10-29_

- `location/` — iPhone location card and its test
- `health/` — iPhone Health import card and its test
- `moon/` — Phone Moon sheet. The tile still lives in `components/Home/home-moon-tile.tsx`. Inside this shell it opens the sheet (phase, illumination, neighboring major phases) instead of the desktop sky chart. Close and the dim scrim dismiss it. Escape does too. Desktop and Electron keep the sky dialog.
- `nfc/` — iPhone NFC card and its test
- `keyboard/` — `mobile-keyboard.tsx`, `mobile-keyboard.css`, `keyboard-logic.ts`, and their tests. The deck replaces the system keyboard while a text field is focused.
- `hub/` — Mobile hub page and its CSS
- `nfc-hub/` — phone NFC hub page, its CSS, and its test

## Entry points

_Last mapped: 2026-10-28_

| Path | Role |
|------|------|
| `app/mobile/page.tsx` | Route `/mobile/` |
| `MobileApp.tsx` | _Last mapped: 2026-10-28._ Login gate + sticky full-width topbar. Home, Lists, Inventory, BIM, Plan, and the NFC link are silver keycaps (44px). **Plan** lazy-loads the Plan BIMBY (`components/Lab/PlanBimby/PlanBimbyPanel.tsx`), a short-term plan you say, confirm, and play through. **BIM** lazy-loads `BimPhoneScreen` (`components/Bim/phone/bim-phone.tsx`), the Telegram bot's executor as a text terminal; the Pull, Location, Health, and NFC cards hide on that tab. Inventory lazy-loads `InventoryPhoneScreen` from `components/Inventory/phone/inventory-phone.tsx`, the same phone room as the 767px gate. A shelf or packing tap opens this shell's item popup through `openItemDetailPopup`. The action row is the same cap: **Quick Add** (the desktop capture dialog, with Bulk and Plain on that sheet), Inbox, Bulk Add, From Notes, Phone Notes, Reviews, Log out. Listing Apple Notes still needs Mac Notes.app. Phone Notes is the Telegram Shortcut queue. |
| `phone-sheet-close.test.ts` | The shell sheet offset stays in `mobile.css`, and the full-viewport phone sheets stay off `100dvh`. |
| `phone-desk-keys.tsx` | _Last mapped: 2026-10-30._ The Phone group in the desk header's Menu sheet, iOS app only. See **iPhone app opens the desk**. |
| `use-in-mobile-shell.ts` | True only when `.cogs-mobile-app` is in the document. Shared tiles use it so Electron keeps the desktop tree. |
| `mobile.css` | _Last mapped: 2026-10-29._ Shell layout. Lists on this shell hides Import spreadsheet and keeps the Display codes on one 26px line. The rest of that phone chrome (title play, keycaps, Address folder toggle) lives with Lists and also runs on a phone-width full site. Wide desktop is unchanged. Portaled dialogs sit on `body`, outside `.cogs-mobile-app`, so the close fix is `html:has(.cogs-mobile-app)`. `--phone-sheet-top` is the status-bar inset and at least 59px when that inset is 0. Every portaled dialog starts below that band, so its header close can be tapped, and a strip of scrim under the band dismisses a dialog that listens for the overlay. Widget handhelds keep the corner key on screen (44px) while the detail scrolls. Electron does not load this file. Desktop dialogs are unchanged. |
| `keyboard/mobile-keyboard.tsx` | _Last mapped: 2026-10-30._ Mounted from `app/mobile/layout.tsx`. A focused text field, textarea, or contenteditable gets this deck instead of the system keyboard. Letter keys are silver keycaps. Shift, delete, 123, ABC, space, hide, and return are darker modifier caps. Shift latches once; a second tap within a moment locks caps, and that cap is the CRT. Return on a single line submits its form, or hides the deck. The deck cancels `touchstart` and `mousedown` and swallows clicks, because iOS ignores `preventDefault` on `pointerdown`: without that, a tap blurred the field (the deck collapsed) and the click fell through to the page behind. A phone pad is used for tel and number. A tap between caps goes to the nearest cap, and an unasked blur keeps the deck up for 350 ms (see **Keycap deck: dropped letters and sudden closes**). _Last mapped: 2026-11-01._ The **mic** cap (letters board, beside 123) dictates, because the deck hides the system keyboard and its mic. While it listens it stays pushed in with a red square LED; words land at the caret and are rewritten as they firm up; a second tap, hide, or leaving the field stops it. In the iPhone app it uses `ios/App/App/SpeechPlugin.swift` (`BrainSpeech`, on-device when it can) through `lib/mobile/speech-bridge.ts`; a browser with the Web Speech API uses that; elsewhere the cap is absent. |
| `moon/mobile-moon-sheet.tsx` | Phone Moon detail. Close, the scrim, and Escape dismiss it. The sky chart stays on the desktop dialog. |
| `MobileLogin.tsx` | Credentials: **admin** / **admin** |
| `MobilePullCard.tsx` | _Last mapped: 2026-10-31._ Refetches the Mac vault into memory. It does not restore `data/mobile-sync.json` onto the phone. The phone card has a **Hub** URL field and a **Hub token** field (password input). The token is saved on Refresh as a small pin in `localStorage` (`readPhoneHubTokenPin` / `writePhoneHubTokenPin` in `lib/phone-window.ts`), because the vault that holds the ingest store is itself behind the token. |
| `location/MobileLocationCard.tsx` | _Last mapped: 2026-10-28._ iPhone location, the primary share. Shows only in the iOS build. Upload setup (URL, upload-only token, capture public key), Save goes straight on to Turn on (asks While Using, then Always, then starts). Recording stays on across launches until Turn off. **Set to Always** opens iPhone Settings while only While Using is granted. Send now. The plugin keeps the setup; the card stores nothing. BIM Live Location paints only when this share did not. See [`docs/phone-sync/03-location.md`](../../docs/phone-sync/03-location.md). |
| `health/MobileHealthCard.tsx` | _Last mapped: 2026-10-28._ **Import all history**. On the iPhone app this reads Apple Health from the oldest sample to now, 30 days at a time: steps, walking and running distance, flights, active energy, heart rate, sleep, and workouts. The line under the button is the month in progress, then the imported counts, nothing new, an empty history, or access off. In the browser the same button says the import runs in the iPhone app. HealthKit is read only. See [`docs/phone-sync/04-health.md`](../../docs/phone-sync/04-health.md). |
| `nfc/MobileNfcCard.tsx` | _Last mapped: 2026-10-28_ iPhone NFC. Shows only in the iOS build (`BrainNfc`). Hub URL and hub token stay in the app. Scan reads the sticker’s hardware id. The first tap picks which saved tag that chip is (`brain2-nfc-chips`). A dose asks how many. Blank posts `nfc:{id}`. A door or a plain event posts with no question. `POST /api/scan` on `npm run phone:hub`. **NFC hub** opens `/mobile/nfc/`. The Simulator cannot scan. Shortcuts stay. See [`docs/shortcuts/nfc-tags.md`](../../docs/shortcuts/nfc-tags.md). |
| `nfc-hub/MobileNfcHub.tsx` | _Last mapped: 2026-10-28_ Phone-only NFC hub at `/mobile/nfc/`. Writes the hub URL, token, and sync URL onto a sticker, reads that record back, and scans a sticker the same way the home card does. See [`nfc-hub/README.md`](nfc-hub/README.md). |
| `lib/mobile-auth.ts` | sessionStorage login (no app-data keys) |
| `lib/mobile-sync.ts` | HTTP client for the hub (`/api/sync` on the dev server). A native shell cannot use `127.0.0.1` (that is the phone). It reads `public/mobile-hub.json` for the Mac's LAN address. A saved port 3847 is ignored. The iPhone must allow Local Network or that fetch never leaves the phone. |

## Same vault as the Mac, for this session

_Last mapped: 2026-10-30._ `npm run electron:dev` (or `npm run dev`) serves the page and `/api/persist` on one port. The phone does not keep its own full vault.

1. On the coding Mac: `npm run electron:dev`. The file the phone reads is this checkout's `data/shared-persist.json`.
2. Phone, same Wi-Fi: the installed app, or `http://<mac-lan-ip>:3000/mobile/`. Login `admin` / `admin`.
3. The shell fetches the vault. Notes, attributes, and the time grid past a week are in that session. Kill the app and the memory is gone. The next launch uses the cache if the Mac is quiet.

A phone edit of a list, the time grid, plan text, a habit, a night, or a goal is posted as `{ name, source: "phone", patch }`. A whole store from the phone is refused. Electron still writes `localStorage` and still posts its own keys. `data/mobile-sync.json` remains the manual snapshot for Settings → Force push / Force pull. The server never deletes Electron storage by itself.

## Sideload onto iOS

### A) Capacitor native app (recommended)

Requires macOS + Xcode + a free Apple ID + CocoaPods (`brew install cocoapods`).

```bash
npm install
npm run mobile:ios:init   # first time only — adds ios/ project
npm run mobile:ios        # static site, sync, launch an iPhone Simulator
```

`npm run mobile:ios` and `npm run build` can run while `npm run dev` is up. Next's static export always compiles into `.next` (a custom `distDir` becomes the export folder, and the compile directory is forced back to `.next`). The Turbopack dev server already owns `.next`, and sharing it makes page-data collection load a dev `/_document`. `npm run build` (`scripts/static-export-build.mjs`) stages a copy in `.mobile-build`, runs `next build` there, and copies `out/` back. The iOS script (`scripts/mobile-static-build.mjs`) writes the LAN hub hint first, then uses that same stage. It then syncs `ios/` and launches an iPhone Simulator (`scripts/mobile-ios-sim.mjs`). A booted iPhone is used when one is already running; otherwise the first available iPhone. To install on a physical iPhone, open `ios/App/App.xcworkspace` in Xcode → **Signing & Capabilities** → your Team → Run. NFC reading needs the **NFC Tag Reading** capability on the App ID `com.cogs.mobile`. A personal team cannot sign a profile that includes it, so `ios/App/App/App.entitlements` leaves that key out and a free Apple ID can install the app. It cannot scan a sticker. The Simulator cannot scan one either. On a paid Apple Developer account, add `com.apple.developer.nfc.readersession.formats` with `NDEF` and `TAG`. Scan reads the chip’s hardware id. NFC hub can also write and read one testing-settings text record. Without that capability the radio stays off.

Health import needs the HealthKit capability (`com.apple.developer.healthkit` in `ios/App/App/App.entitlements`). A personal team that cannot sign HealthKit will not install until that key is removed, and then the import cannot read Health. A signed build asks for read access to steps, walking and running distance, flights, active energy, heart rate, sleep, and workouts. It does not write Apple Health. Only a phone with Health data can prove a real import.

If `pod install` complains about UTF-8, the npm scripts already export `LANG=en_US.UTF-8`.

### B) Safari “Add to Home Screen”

1. `npm run dev`
2. Note the `phone:` URL printed (includes `/mobile/`)
3. Open it on iPhone → Share → **Add to Home Screen**
4. Log in. The shell loads the Mac vault. `electron:dev` has to be running on that Mac.

Login: `admin` / `admin`.
