# `lib/link-bimby/` — The Link BIMBY

_Last mapped: 2026-11-06_

A **BIMBY** (small, single-job sub-agent) for Inbox → **Links**. For one saved link it guesses what in Brain2 the link is most likely a resource for, and how it would be used there. UI: the **Guess** key on each Links row (`components/inbox-links.tsx`), with the reading painted by `components/inbox/link-guess.tsx`.

## Flow

PEEK → POOL → PICK → CLEAN → REVIEW → USE.

- **Peek.** `peek.ts` calls `GET /api/link-peek?url=` on this Mac (`scripts/link-peek-api.mjs`, dev and prod servers). The server asks the public oEmbed door (TikTok, YouTube), then reads the page's `og:` / `twitter:` / `<title>` tags with the link-preview crawler user agent. For an Instagram reel this is the caption (often the full recipe or how-to), the account name and the thumbnail URL. No sign-in, no cookies for the page itself. Loopback only; hosts that resolve to private addresses are refused. Null when the server is not there (phone, static export) or the page did not answer.
- **Watch.** The row asks with `watch=1`, so the Mac also runs `scripts/reel-watch.mjs`: yt-dlp fetches the smallest video (≤ 80 MB, ≤ 6 min) into a new temp folder, ffmpeg pulls the audio, whisper (`base`, or `BRAIN2_REEL_WHISPER_MODEL`) writes what is said, ffmpeg takes a frame every 3 s (at most 10) and tesseract reads the on-screen text. The folder is removed; the reading is cached in `data/link-peek/` (gitignored), so each reel is watched once. A new reel takes one to two minutes. TikTok and YouTube need no sign-in. **Instagram serves reel video only to a signed-in session**. `BRAIN2_REEL_COOKIES_FROM_BROWSER` (e.g. `chrome:Default`) or `BRAIN2_REEL_COOKIES` lets the dev server use a sign-in, under the account guard below. It is off. Without it the strip says the video was not watched and the guess uses the caption. _2026-11-06:_ `.env.local` set `BRAIN2_REEL_COOKIES_FROM_BROWSER=chrome:Default` (the profile signed in to Instagram); now commented out. yt-dlp searches a profile folder recursively and took an extension's newer `Cookies` file, so for a named Chromium profile `cookieArgs` links only that profile's `Cookies` into the run's temp dir and points yt-dlp there. Instagram reels now download, transcribe and OCR (a 35 s reel: clean transcript; OCR of stylized captions is noisy). A photo post (`/p/…`, no video) falls back to `readStill`: tesseract on its `og:image` preview, cached with `still: true`. The prompt gets up to 900 characters of speech (a music clip's lyrics say little, and the prompt says so) and 400 of on-screen text.
- **Pool.** `context.ts`. The query is the note, words from the link path, and the peeked title, caption and author. Candidates are every list (with a few of its item names) and every open item that is not in the Inbox, not a log row and not a saved link (with its list names). Each gets a shared-word score; `embedScores` (`nomic-embed-text`) adds a meaning score when it is installed, for all lists and the 400 items with the best word match, then the newest (`EMBED_ITEMS`; a whole vault of about 10k items took minutes on first use). `shortlist` keeps the best 14 lists and 22 items as refs `L1…`, `I1…`. `pastLinks` brings the 8 closest saved links that have a note or a list, each with where it went (lists, or items tied `resource-for`), so the model sees how this person files links.
- **Pick.** `suggest.ts`. One schema-bound call on the `pick` ladder through `escalate`. It returns `gist` (what the link is) and up to 3 `guesses` (`ref`, `why`, `use`, `sure`). Instagram titles that repeat the caption are cut to the account name (`pageTitle`) to save context.
- **Clean.** `cleanGuesses` keeps only refs on the shortlist, once each, sorted by `sure`. Refs the model still writes in prose (`L3's 'Code Projects'`) become names. With no model, or when it finds nothing, `guessByRules` offers the best word matches with "Shares the words …".
- **Review.** Each guess has ✓ (approve) and ✗ (reject); each reading has a comment box. **Use** also marks the guess approved. `feedback.ts` turns every reviewed reading into a lesson line (`WRONG: Recipes; RIGHT: Retile the kitchen backsplash — they said: "…"`). `feedbackLines` sends the 6 closest lessons (shared words; a comment always counts) to the prompt under **FEEDBACK ON YOUR EARLIER GUESSES**, and the system prompt says to repeat RIGHT, never repeat WRONG for a similar link, and follow what was said. Again or × on a reviewed reading moves it to `past`, so the lesson stays.
- **Guess all.** The Links tab bar (`LinkGuessBar`) walks every link with no reading, one at a time, newest first, with progress and Stop. The queue lives at module level in `components/inbox/link-guess.tsx`, so closing the Inbox does not stop it. **Redo all** appears once every link has a reading. The bar shows guessed / reviewed / ✓ / ✗ / comments, and **To review** filters to read links with no verdict and no comment.
- **Use.** `apply.ts` `applyGuess`. A list guess adds that list to the link and files it out of the Inbox. An item guess adds an `ItemLink` `{ relation: "resource-for", targetId }` to the link, adds the item's lists, and files it. The row calls `rememberWorld` first, so Cmd/Ctrl-Z undoes.

## Test pass, 2026-11-06

All 124 links on Links were guessed. 121 were watched (3 are a ResearchGate page, a PubMed page and a shop page, read from their page tags only); photo posts used `readStill`. A first pass ran nearly every link twice: `qwen2.5:14b` copied whole shortlist lines as refs (`"L1 list: medical stuff"`), so `cleanGuesses` dropped them and `escalate` climbed to `qwen3:30b`. The ref is now read from the head of the string, and 14b answers stand. 32 links had an Instagram-follower list among their guesses (the site being Instagram was read as a reason). A prompt rule now rules that out, and a re-guess cut it to 11, mostly lower-ranked or thin-content. `creative projects` is the first guess on 32 links: watch it in review. Speed: about 30–60 s a link once watched; a new reel takes 20 s to 3 min to watch.

**The Instagram account was restricted after this pass.** About 120 signed-in reel fetches in two hours (Guess all plus a pre-watch script, through `BRAIN2_REEL_COOKIES_FROM_BROWSER`) is what Instagram flags as automation. The sign-in line in `.env.local` is commented out, and the guard below was added.

## Instagram account guard

_Last mapped: 2026-11-06_

In `scripts/reel-watch.mjs`, before any Instagram fetch:

- **Signed out** (the default): yt-dlp is not run for Instagram at all, since the video is never served. The guess uses the caption.
- **Guess all never uses the sign-in.** The row passes `batch=1`; only cached watches are used.
- **A single Guess may use it**, at most one every 3 minutes, 5 an hour, 15 a day.
- **Any pushback** (rate limit, 429, checkpoint, challenge, login wall while signed in) stops signed-in fetches for 72 hours.
- **Signed-out page reads** of instagram.com go one at a time, at least 15 s apart (`igPaced` in `link-peek-api.mjs`), since they share the home IP.
- State is in `data/link-peek/instagram-guard.json`. Never script a loop over `/api/link-peek` for Instagram links.

Fetching with a real account is against Instagram's terms however slow it is. Turning the sign-in back on is the person's call. A spare account is safer than their own.

## Rules this BIMBY keeps

- **Advice is not data.** A reading lives in `store.ts` (`brain2-link-bimby`, newest 400 by task id, plus 300 replaced reviewed readings in `past`; version 2). It is never written onto the task. Only **Use** changes the task.
- **Never invent a place.** A guess must name a shortlist ref. It cannot create a list or an item.
- **Planned.** Describing frames with a vision model when one is installed (OCR reads only text); the phone's Links tab; showing `resource-for` links on the target item's detail page.

## Files

- `types.ts`: `LinkPeek`, `Candidate`, `PastLink`, `LinkGuess`, `LinkReading`.
- `context.ts`: `words`, `pathWords`, `linkText`, `buildPool`, `shortlist`, `pastLinks`.
- `suggest.ts`: `GUESS_SCHEMA`, `GUESS_SYSTEM`, `pageTitle`, `guessPrompt`, `cleanGuesses`, `guessByRules`, `guessLink`.
- `peek.ts`: `peekLink`.
- `apply.ts`: `RESOURCE_FOR`, `applyGuess`.
- `feedback.ts`: `guessKey`, `isReviewed`, `withVerdict`, `withComment`, `feedbackLines`, `tally`.
- `store.ts`: `useLinkBimbyStore` (`put`, `drop`, `setVerdict`, `setComment`), `reviewedReadings`.
- `link-bimby.test.ts`.
- `../../scripts/link-peek-api.mjs`: the peek route.
- `../../scripts/reel-watch.mjs`: `watchReel` (with `batch`), `readStill`, `cleanOcr`, `isInstagram`, `instagramRefusal`, `readGuard`.

_2026-11-07:_ Lab page `/lab/link-bimby` (`components/Lab/LinkBimby/`): pick a saved link, Peek (optionally watch), see the guesses. A dry run; nothing is filed, linked or reviewed.
