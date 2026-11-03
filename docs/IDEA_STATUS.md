# Idea status — two stream-of-consciousness logs, sorted

_Last mapped: 2026-11-02_ (eleven ideas moved from list 3 to list 2, planned in `docs/STREAM_LOG_PLAN.md`)

This file sorts every app idea from two logs: the October log (Foxtide, the task card, the timer) and the long `needs-` list. It checks each one against the code and the plan docs. Life to-dos are left out (meds, Foxtide, the house, food, bills). They are listed once at the end so nothing looks lost.

How this was checked: folder READMEs, plan docs, and code searches. Nothing was run in the app. An idea counts as **built** when a person can do the thing today, even roughly. **Planned** means a plan doc or wave names it. **Could be** means it fits the app and nothing names it yet. **Does not fit** means a written decision or an outside limit is against it.

Duplicates from the two logs are merged into one line.

---

## 1. Already built

### Phone, sync, always-on
- **Mobile app.** Capacitor iOS app (`ios/`, opens `/mobile/`). Phone pages for To do, Habits, Tracking, Plan, Goals, Lists, Inventory. Keycap deck, dictation, live sync with the desk. The free personal team works, so the $99 account is not required (`scripts/ios-reinstall.mjs` reinstalls before it expires).
- **Texts and calls logged.** Phone sync is live: every text archived, calls counted as time with that person (`docs/PHONE_SYNC_PLAN.md`).
- **Health import** on the iPhone, full history in 30-day pages.
- **iPhone Screen Time, Calls, Texts, Location** by Shortcut, plus `screen:`, `call:`, `text:`, `gps:` over BIM. Telegram Live Location paints Location.
- **Desktop app.** Electron window (`electron/`).
- **Always-on Mac installer** and setup guide (`docs/ALWAYS_ON_MAC_SETUP.md`, `deploy/mac`). The Oracle relay box and sealed uploads are built (`docs/BIM_ALWAYS_ON_PLAN.md`).
- **Chrome history** by the Brain2 extension (`extensions/chrome-history`), shown in Data → Sources → Browser and Screen Time.
- **Spotify** connection (Settings → Spotify accounts, `docs/SPOTIFY_LISTENING.md`).

### Knowledge graph and asking questions
- **Whole-vault knowledge graph.** Data → Library → Atlas: PageRank, communities, insight sentences, rule-chain gaps. Proposals from written relations, wiki links, and dates, with accept / dismiss (graph inbox, Links shelf).
- **Ask the knowledge base,** early form. Search answers a house question from the vault graph. BIM chat answers from Plan events. The BIM flow bench has Ask about me, Summarize a topic, Recap a day.
- **A model sees prior context before it writes,** early form: BIM chat reads Plan events and earlier answers (`log: … (answer to "…")`).

### Capture, Quick Add, Inbox
- **Quick Add shortcut** Cmd/Ctrl-Shift-A.
- **Quick Add and Bulk combined.** Bulk is a checkbox in the same dialog. The field grows into a big box on wrap or newline.
- **Untag / remove-tag** × on each auto-tag chip.
- **Inbox → log** transfer (key `t`, `lib/inbox-transfer-log.ts`).
- **Log / thought process from Quick Add** (`log:`, `tp:`).
- **Inspo / link inbox.** Inbox → Links tab for saved links (`lib/saved-links.ts`, `docs/RESOURCE_LINKS.md`).
- **Tracking Helper chat** with a proposal board (helps sort incoming lines).
- **Journal scan and receipt OCR** for photos and PDFs. A photo's caption routes it (receipt, journal, outfit, log, inbox), so not every photo is a journal page (`lib/ingest/apply-media.ts`).
- **Apple Notes and iPhone Notes importers.**

### Telegram / BIM
- **Slash menu** exists: `/start`, `/help`, `/now`, `/quicklists`, `/info`.
- **Lists by text.** `lists` / `info` dump data back as plain text; quick lists are numbered.
- **`call:` with a colon** is the call verb (`call: Jane 12m`).
- **BIM asks you.** Check-ins ("What are you doing right now?", "How are you feeling?") on the **ask me** key. "I don't know" asks you and files the answer.
- **`day:`, `mood:`, `review` / `ritual`, `intake:` / `ate` / `drank` / `took`, `switch: company …`.**

### To do, task card, sessions, timer
- **Play button and pen clock,** one clock. Objectives with added → done spans, Now and Next. Stop asks what to do with open objectives. A pause asks why.
- **End-of-sitting sheet:** estimate vs actual per task and step, objectives with minutes, handoff note, satisfaction, energy, what got in the way.
- **Time tab:** each block as a plate with step, label, notes, objectives.
- **Bare minimum / Goal / Exceptional** as cumulative estimates on the task card, and as quantity thresholds on habits (`lib/completion-tiers.ts`).
- **Precursor tasks.** Prerequisites lock steps; dependencies combine; blockers sort first.
- **Item detail: one window per item.** Opening another minimizes this one to the keycap dock (Nov 1).
- **Timeblock auto-push** is an opt-in switch, off by default.

### Habits, rituals, reviews
- **Habit cells open detail** on double-click.
- **Habits hooked to their correlates.** Auto-links from sleep, a list, a tag, a keyword, the daily floor.
- **Optional why** when a habit is prioritized, when a task is pushed, and on a missed-opportunity cell. Night asks why something was blocked.
- **Why-it-didn't notes** listed with counts in Data → Reviews.
- **Morning review** split into one module per step. Week and month look-ahead, sorted by importance.
- **Habits scratch pad** per day / week / month / season, and a Day View lens.
- **Day tubes / glass tubes** on Habits.
- **Willpower gems with a physics lab** (the bouncing-ball HUD).
- **New moon reminder** (repeat `new-moon`), birthday and full-moon Star Lord report.

### Tracking
- **Date picker** on double-click of the Tracking date and the Habits nameplate.
- **Discrete events** as ticks; `log:` lines are real tracking entries.
- **Company** takes several people at once.
- **Last seen, last called, last texted** kept apart on the person. Texts do not count as seen in person.
- **Cycle detail** dialog.
- **Prospective vs retrospective** is a written rule (`docs/TEMPORAL_POLARITY.md`). Plan is the prospective calendar.

### Lists, Docs, Data, Modules
- **Photo gallery and document cover shelf** list displays.
- **Gravity, pile-up, and network** list views.
- **Select mode on search results:** add hits to folders and lists in one go.
- **Docs editor** with auto-linkify for typed and pasted URLs. The docs reader renders markdown and finds with Cmd+F.
- **Analytics renamed Data,** with Regret, Reflection, Reviews, Research report (a plain rundown of a period), Health, Places, Browser.
- **Instagram:** following and followers lists with **Follows me back** / **I follow them back** (this is the raw unfollow list). Drive watcher reads each day's export.
- **Inventory:** closet (cutout photos; outfit history and lookbooks are still Planned), kitchen, bookshelf with covers, gems, shopping.
- **Food log** with dishes and a meal plan.
- **Money widget** already named Money; opens the money book. Statement import (`lib/bank-statement.ts`).
- **Port in any app,** first form: an uploaded `.html` file or a downloaded package runs as a module with a small `window.brain2` bridge (`docs/MODULE_PLATFORM.md`). Tidy, Trip, GradSearch, Film DNA are modules.
- **Language study** (vocab, placement quiz).
- **UI lab / mockup lab** of the real room frames (`docs/mockups/ui-lab/`).

---

## 2. Not built, but planned

| Idea | Where it is planned |
|---|---|
| Text misreads: `now`, `with` / `alone` tails, `back` to undo, no clock guess without `@` or am/pm, no bare `text` shortcut, words like "probs" kept, one shorthand for Quick Add and BIM | `docs/STREAM_LOG_PLAN.md` §1, Wave 16 |
| Several dates in one capture, each on its own part (item, deadline, range, new step) | `docs/STREAM_LOG_PLAN.md` §2 |
| Three pages as a doc per day tied to the habit (no `-3p` flag, decided 2026-11-02), page mode, Google Docs import, weekly prune-writing habit | `docs/WRITING_PLAN.md` |
| Who wrote it: you, a model, a person, or copied; auto-tagged hand-typed text and an opt-in 100% human document | `docs/WRITING_PLAN.md` |
| Objectives auto-tag to steps; one timeline per sitting; the completion lag | `docs/STREAM_LOG_PLAN.md` §5 |
| Bare minimums cleared more than one way, advanced view only | `docs/STREAM_LOG_PLAN.md` §6 |
| **Named events as moving due dates**, Before … lists, repeat stats, planned-event lead time, "frog concert with Becca" | `docs/NAMED_EVENTS_PLAN.md` (first priority) |
| Rename or merge a person and every record follows; new-person mark in text analytics; topic → person | `docs/STREAM_LOG_PLAN.md` §8 |
| Period summary with songs, photos, places, company, palette, symbols: view in Data, edit in Rituals | `docs/PERIOD_SUMMARY_PLAN.md` |
| Email watch (Telegram notice), email cleaner module, needs-a-reply mail | `docs/STREAM_LOG_PLAN.md` §10 |
| Printable, scannable sheets and booklets; reMarkable round trip | `docs/PAPER_LOOP_PLAN.md` |
| Wiki `[[links]]` to items, PDF page provenance, doc version history (covers "date / version tracking like Google Docs") | `docs/PLAN_OF_ACTION.md` Wave 12 |
| Go through screenshots and mark fixes in place | Wave 0 |
| History, restore, workflows | Wave 9 |
| Tracking diet and Working Now polish (Now popup, objectives) | Wave 6 |
| Location end to end (deploy upload route, Tailscale on the phone, hub drain) | `docs/PHONE_SYNC_PLAN.md` "To do, in order" |
| Phone wave 2: Screen Time, DMs, email, phone plates | `docs/PHONE_SYNC_PLAN.md` step 7, `docs/phone-sync/05-screen-dms-email.md` |
| Call pen keyed by person id, so a rename does not split it | `docs/PHONE_SYNC_PLAN.md` known issues |
| Watch for the Instagram "your information is ready" email | `docs/INSTAGRAM_DATA_SOURCES.md` (mail rule, IMAP, or Gmail) |
| Unfollows over time ("gone since" for followers and following) | `components/Analytics/README.md` Planned |
| BIM texting you on its own: check-ins timed to gaps in Activity | `components/Bim/README.md` Planned |
| Embedding (semantic) search beside word search | `components/Lab/BimFlow/README.md` |
| Knowledge graph next steps: saved links that mention a person, gift ideas from messages, entity vs document | `docs/KNOWLEDGE_GRAPH_PLAN.md` (KG-*) |
| Texts: weekly / monthly comparisons, notes, on-demand analysis, training on your own life | `docs/TEXTS_ANALYTICS_PLAN.md` |
| Analytics deep dive: estimate vs actual calibration, language analysis, viz | `docs/analytics-plan/` (08-cross, 10-language, 11-viz) |
| Money: expected vs received, owed, payee rules, import dedupe | `docs/BUDGET_REDESIGN.md` (partly built) |
| Friend companion: suggestion engine, rewards and quests, nest dialog | `docs/FRIEND_COMPANION.md` |
| Tutorial with a local model that tailors the tour | `docs/TUTORIAL_PLAN.md` |
| One room to see and tune every agent (BIMBIES) | `docs/AGENT_LAB_PLAN.md` |
| Modules: hand-written manifest (rung 2) and later rungs | `docs/MODULE_PLATFORM.md` |
| Habits: settings, iOS habits, daily habit helper, header grid bar (covers "make habits richer", habit edit) | `docs/briefs/habits-2026-11/` (uncommitted) |
| More widgets (Objective tape, Mood ampoule, Screen hourglass, …) | `docs/FUTURE_WIDGET_IDEAS.md` |
| Person detail redesign | `docs/PERSON_DETAIL_REDESIGN.md` |
| YouTube channel and category by oEmbed | `components/Analytics/README.md` Planned |

---

## 3. Not built, not planned, could be

### Telegram / BIM and text input
- Rituals as slash commands (`/gm`, `/gn`, `/review`), plus `/` commands for lists, logging, plan.
- Read the whole Telegram transcript and fix every glitchy keyword.
- A leading clock means "as if typed at that time" (for messages that queued).
- `so:` edits and adds detail to the live objectives checklist.
- Make intake more useful.
- Stop auto-pinning grocery dumps in the chat.
- Today menu by number (view and update lists, logs, summaries).
- Points for sending texts; correspondence reminders for texts, DMs, and email you owe.
- Type an excuse to the mission critter before skipping.

### Quick Add and capture
- Auto-tag people by name (Item mentions Person), easy to remove.
- Saying a file's name tags it as a resource on the item.
- Inbox ingestion that gathers more about each idea.
- Log → inbox (the reverse transfer).
- Reels / TikTok input stream with preview and transcript.
- Shopping cart link → items with prices and links; bulk cart add (a Chrome extension could also take "what am I doing on this site").
- Attach pictures from Pinterest to items.

### To do, sessions, objectives, items
- Rate motivation and expected time for each task, logged.
- To do sessions as a negotiation ("the most you will do now").
- Plan as a loop: plan, do steps, evaluate, note resistance or excitement, repeat. Bigger plan box.
- Priority that fades unless refreshed with a written reason.
- Quick assign to this day / week / month from item detail.
- Create or search a new item from the dependency picker.
- "Relies on" / "awaiting" as kinds of dependency.
- 30 minutes earns a break; 1 h 30 earns Brain2 time.
- To do status bar with week and month, not one period.
- Standing count of required things left undone.

### Habits, rituals, mood
- Richer habit types with their own detail and routing (text to send letters).
- Habit edit pass (if the briefs above do not cover it).
- Fold the tracking summary into `gn` / night.
- Morning review: season to-dos, a capped count with "see more", reasons on daily priorities, current value shown in quick-input boxes.
- A day recollection you scroll day to day outside the ritual.
- Text walkthrough for mood; where feelings sit (enjoyment vs the rest); mood semantic reactions.
- Track crying, with reasons, against the cycle.
- Thought-loop detection over your writing.
- New-moon reminder at the exact minute.
- Redesign morning ritual; redesign reminders hub.

### Tracking
- Text detail in Tracking that shows sender and receiver; texts sit like logs.
- Percent of day passed beside percent tracked.
- Optional reasoning on spending; regret and notes logs.
- Counts of visits to one restaurant over any period.
- "Met" event type that adds a person to People I know.
- Last shower as a log; rings by finger, "assume still wearing".
- NFC tags on coats tied to temperature.
- Image recognition to auto-tag clothing.
- Per-type timeblock detail (no auto-push for calls and texts).
- Pen settings and timeblock settings redesign.
- Day tubes: better sampling, fixed buttons, hourglass mode (the hourglass exists only in the time-grid-lab slant).

### People, Instagram, texts
- Open person detail from any texts view.
- Detailed profiles of feelings and history with each person, with **secret** marks; ask a model about relationships.
- Birthdays shown on the calendar.
- "Who they know" graph and LinkedIn-style bridges.
- Segment texts by people and events, logged in Tracking with real dates (every concert in eight years, and who with).
- Merch Instagram into Data.

### Data (analytics)
- Restyle the Data tab.
- Metacognition layer: comment on reviews, add causal links, regret / satisfaction values, analysis written back as data.
- Journals, three pages, and recorded audio as Data tabs.
- Click to highlight rows.

### Docs and files
- Cmd+F inside a doc in the Docs editor.
- Password protect sensitive docs (needs real encryption; the vault is plain files today).
- Beautiful markdown and PDF viewer / editor.
- Covers for every book linked to its PDF.
- Plain-text view and copy of a list.
- Merge two lists from search; two-way links between lists in list settings.
- Hide auto-created lists in some places, or show their hierarchy.
- Sort and tag phone photos and computer files.

### Modules and widgets
- Candywrapper as a module, built on the export data.
- Learning-course modules timed against a "study 1 hr" habit.
- Every Noise as a module or link.
- Widgets: host any HTML on Cloudflare (`docs/SHARE_HTML_OVER_TUNNEL.md` is a manual how-to, not a widget), transcribe a video from a link or file.
- A plain-text prompt that makes a local model write a module **blueprint** or view (fits the module platform).
- Module marketplace.
- Fix small text on widgets.

### Hardware, design, process
- Always-on recorder (Plaud-like) that also runs BIM.
- Song recognition around you, all the time.
- Better OCR and handwriting training for journals.
- Design deck and a Figma file of the look.
- Grays to include: `#c0c0c0`, `#c0bfba`, `#999686` (warmer), `#b7bcbf` (cooler).
- Cuter BIM; orb icon cleanup; better velvet; stylized date picker.
- Pin nav menus at the top.
- A model that finds security holes; a model that acts as a test user.
- One more pass mixing in cybernetics, graph theory, category theory, Korzybski, Buddhism, Taoism (several essays exist in `docs/`).
- Click counts on ideas, by origin, that strengthen links.
- Five uses of time (the note gives no detail).

---

## 4. Does not fit

| Idea | Why |
|---|---|
| Instagram unfollow automation, Candywrapper scanning inside instagram.com | Declined on purpose: Brain2 does not call Instagram, and the unfollow queue is out of scope (`components/Lists/README.md`). |
| Follower counts of other accounts filled automatically | Not in the export, and the Instagram API does not return them. The column stays typed by hand. |
| Live bank login | `docs/BUDGET_REDESIGN.md` puts bank sync out of scope. Statement upload is the path. |
| YouTube → MP3 widget | Ripping YouTube breaks its terms. Not something to ship. |
| Highest-quality stem splitting "with nothing else to run" | Needs a local model and Python (Demucs-class). It could exist as a local module, but not with nothing installed. |
| A model that rewrites the app's source for each user | Clashes with one shared codebase and one database ("custom views are welcome; custom databases are not", `docs/MODULE_PLATFORM.md`). The blueprint version is in list 3. |
| An LLM friend that picks a different task to argue for | `docs/FRIEND_COMPANION.md`: a model may only phrase the already-chosen task. Arguing **for** the chosen task with your own reasons fits. |

---

## Not app ideas (left out)

These were in the logs as to-dos, not features: Oracle needs $1 in an account; the Apple developer account; install the location Shortcut; check that tax texts sent offline were logged at the right time; Sam logging checkout; dh skincare; call gran; Jenny's birthday; merge branches and push; restart processes.
