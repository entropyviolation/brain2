/**
 * lib/ingest/command-catalog.ts — Complete BIM command surface
 *
 * Source of truth for every phrase BIM accepts, derived from
 * `parse-message.ts` VERBS, `expand.ts` CONTEXTUAL, `log:`/`log-` header,
 * habit/discrete presets in `text-triggers.ts`, list-dump / before-due bulk,
 * morning GM steps, and retired bare-`g` grocery. Glossaries and
 * `docs/BIM_COMMANDS.md` format from this list.
 */

export type CatalogStatus = "active" | "retired"

export type CatalogCategory =
  | "help"
  | "pair"
  | "grocery"
  | "needed"
  | "capture"
  | "bulk"
  | "habits"
  | "log"
  | "monitor"
  | "plan"
  | "todo"
  | "review"
  | "track"
  | "note"
  | "sleep"
  | "gps"
  | "screen"
  | "call"
  | "text"
  | "iphone-notes"
  | "pin"
  | "inventory"
  | "receipt"
  | "journal"
  | "read"
  | "shortcut"
  | "media"

export interface CatalogEntry {
  /** Stable id for tests / docs anchors. */
  id: string
  category: CatalogCategory
  /** Primary form users should learn. */
  primary: string
  /** Every alias / synonym that still parses (or used to). */
  forms: string[]
  /** How to format a message. */
  format: string
  /** What it does. */
  explanation: string
  status: CatalogStatus
  /** Extra note (retirement, stamps, clarifications). */
  note?: string
}

export const CATALOG_CATEGORY_LABELS: Record<CatalogCategory, string> = {
  help: "Help & manuals",
  pair: "Pairing",
  grocery: "Grocery",
  needed: "Needed",
  capture: "Capture / add / Inbox",
  bulk: "Bulk add & list dumps",
  habits: "Habits",
  log: "Discrete event log",
  monitor: "Activity monitor (currently / stopped / switched)",
  plan: "Plan log",
  todo: "To-do & Next Actions",
  review: "Rituals (GM / night / start / end)",
  track: "Tracking (location / activity / mood / working now)",
  note: "Notes",
  sleep: "Sleep",
  gps: "GPS / Live Location",
  screen: "iPhone Screen Time",
  call: "iPhone Calls",
  text: "iPhone Texts",
  "iphone-notes": "iPhone Notes park",
  pin: "Pinned grocery card",
  inventory: "Pantry / inventory",
  receipt: "Receipt OCR",
  journal: "Journal / PDF scan",
  read: "Read-back & status",
  shortcut: "Built-in one-letter expansions & custom shortcuts",
  media: "Media (photos / voice)",
}

/** Every command / keyword / ritual reply BIM still documents. */
export const BIM_COMMAND_CATALOG: CatalogEntry[] = [
  // ── Help & manuals ──────────────────────────────────────────────
  {
    id: "help",
    category: "help",
    primary: "help",
    forms: ["help", "/help", "commands", "?help"],
    format: "`help`",
    explanation: "Short cheat-sheet of common phrases (grocery, habits, log, monitor, plan, gm).",
    status: "active",
  },
  {
    id: "info",
    category: "help",
    primary: "info",
    forms: ["info", "/info", "instructions", "manual", "cmds"],
    format: "`info`",
    explanation:
      "BIM basics: who he is, families of input, and exactly how to ask for `{prefix} info`, `{prefix} commands`, and `all commands`.",
    status: "active",
  },
  {
    id: "prefix-info",
    category: "help",
    primary: "{prefix} info",
    forms: ["{prefix} info"],
    format: "`groc info` · `log info` · `review info` · `to do info` · `read info` · …",
    explanation: "Deep dive for one family: what it is, how to use it, how to format it.",
    status: "active",
  },
  {
    id: "prefix-commands",
    category: "help",
    primary: "{prefix} commands",
    forms: ["{prefix} commands", "{prefix} command", "{prefix} cmds"],
    format: "`grocery commands` · `habit commands` · `monitor commands`",
    explanation: "Full glossary of every command and keyword for that family.",
    status: "active",
  },
  {
    id: "all-commands",
    category: "help",
    primary: "all commands",
    forms: ["all commands", "all cmds", "all command"],
    format: "`all commands`",
    explanation: "One glossary of every command and keyword across every type BIM supports.",
    status: "active",
  },
  {
    id: "ping",
    category: "help",
    primary: "ping",
    forms: ["ping", "pong"],
    format: "`ping`",
    explanation: "Liveness check. BIM replies that he is listening and points to info / all commands.",
    status: "active",
  },

  // ── Pairing ─────────────────────────────────────────────────────
  {
    id: "pair",
    category: "pair",
    primary: "pair:",
    forms: ["pair", "/start"],
    format: "`pair: 123456` · `/start 123456` · `/start123456`",
    explanation:
      "Pair this Telegram account using the 6-digit code from Settings → Message ingest. Send to @brain2_phone_bot, never BotFather. Unknown senders get no reply.",
    status: "active",
  },

  // ── Grocery ─────────────────────────────────────────────────────
  {
    id: "groc-dump",
    category: "grocery",
    primary: "groc",
    forms: ["groc", "grocery", "groceries", "shop", "shopping"],
    format: "`groc` · `grocery` · `shop`",
    explanation: "Dump the grocery-ish list (Grocery / Groceries / Shopping) as plain text and pin it in the chat.",
    status: "active",
  },
  {
    id: "groc-add",
    category: "grocery",
    primary: "groc {item}",
    forms: ["groc …", "grocery: …", "groceries: …", "shop: …", "shopping: …"],
    format: "`groc milk` · `grocery: eggs` · multi-line under `groc`",
    explanation: "Add item(s) onto the grocery store list (Inbox off). Several lines = bulk. Identical open titles ask see / again / dismiss.",
    status: "active",
  },
  {
    id: "bought",
    category: "grocery",
    primary: "got",
    forms: ["got", "bought", "x", "check off", "checkoff", "checkout"],
    format: "`got milk` · `x bread, eggs` · `bought: oats` · `check off milk`",
    explanation: "Complete matching open grocery lines and refresh the pin.",
    status: "active",
  },
  {
    id: "pin",
    category: "pin",
    primary: "pin",
    forms: ["pin", "live", "snapshot"],
    format: "`pin` · `live` · `snapshot`",
    explanation: "Refresh the pinned grocery card (and a one-line now) without changing items.",
    status: "active",
  },
  {
    id: "g-retired",
    category: "grocery",
    primary: "g",
    forms: ["g"],
    format: "`g` (retired)",
    explanation: "Bare `g` no longer means grocery. It falls through as Inbox capture unless a custom shortcut remaps it.",
    status: "retired",
    note: "Use `groc`. Old Settings shortcuts that expanded to `g` are remapped to `groc` automatically.",
  },

  // ── Needed ──────────────────────────────────────────────────────
  {
    id: "needed",
    category: "needed",
    primary: "needed:",
    forms: ["needed", "get:"],
    format: "`needed: batteries` · `needed batteries` · `get:` then lines · `get: batteries`",
    explanation:
      "Add onto the list named \"needed\" (created if missing). Inbox off. Each item's detail notes include: sent from text. `get:` is the colon-only shortcut (same writer); bare `get` without a colon is not this command.",
    status: "active",
  },

  // ── Capture / add ──────────────────────────────────────────────
  {
    id: "add",
    category: "capture",
    primary: "add",
    forms: ["add", "qa", "quick add", "quickadd", "capture", "inbox", "idea"],
    format: "`add: pick up milk` · `qa: idea` · `inbox: …` · `idea: …` · `capture: …` · `quick add: …`",
    explanation:
      "Smart-capture into Inbox (same path as desktop Quick Add). End with -mb or -monkey to dump it in Monkey brain instead of the Inbox you mean to revisit.",
    status: "active",
  },
  {
    id: "plain-capture",
    category: "capture",
    primary: "(plain text)",
    forms: ["(any message with no verb)"],
    format: "`pick up milk`",
    explanation:
      "Prefix-less text that is not a list dump becomes an Inbox capture. -mb or -monkey on the line sends it to Monkey brain.",
    status: "active",
  },

  // ── Bulk / list dumps ───────────────────────────────────────────
  {
    id: "bulk",
    category: "bulk",
    primary: "bulk",
    forms: ["bulk", "bulk add", "bulkadd"],
    format: "`bulk:` then headers and one item per line",
    explanation:
      "Bulk Add pipeline (Inbox off). Headers `list:` / `folder: list:` / `Home: Groceries:` work. Grocery names with no other folder use the store list.",
    status: "active",
  },
  {
    id: "list-dump",
    category: "bulk",
    primary: "{List name}:",
    forms: ["{Name}: then lines"],
    format: "`Chores:` then lines · `Grocery list:` then lines · `before elijah gets home:` then lines",
    explanation:
      "Multi-line `Name:` dump files onto that list (found or created). Grocery headers land on the store list. Identical open titles ask see / again / dismiss.",
    status: "active",
  },
  {
    id: "before-due",
    category: "bulk",
    primary: "before M/D:",
    forms: ["before …:"],
    format: "`before 9/12:` · `before Friday:` · `before Sept 12:` then item lines",
    explanation:
      "Following lines are due that day (`deadline` / mustBeDoneBefore). A past M/D rolls forward a year. Non-date words after `before` stay a list name.",
    status: "active",
  },

  // ── Habits ──────────────────────────────────────────────────────
  {
    id: "habit",
    category: "habits",
    primary: "habit:",
    forms: ["habit", "did"],
    format: "`habit: exercise 30` · `did: stretch` · optional `yesterday`",
    explanation:
      "Write a habit by name. GOAL → number; BOOLEAN → done/yes/no/undo; TEXT → rest of line. Fuzzy-matches habit name.",
    status: "active",
  },
  {
    id: "h-expansion",
    category: "habits",
    primary: "h",
    forms: ["h"],
    format: "`h` alone → help · `h stretch` → `habit: stretch`",
    explanation: "Built-in expansion: bare `h` is help; with a payload it becomes habit:.",
    status: "active",
  },
  {
    id: "habits-board",
    category: "habits",
    primary: "habits",
    forms: ["habits", "hi", "habit board"],
    format: "`habits` · `hi` · `habit board`",
    explanation: "Dump today's habit board as plain text.",
    status: "active",
  },
  {
    id: "habit-hemisync",
    category: "habits",
    primary: "hemisync",
    forms: ["hemisync"],
    format: "`hemisync`",
    explanation: "Whole-message habit keyword preset (done mode) when a habit named like Hemisync has that trigger. Editable on the habit.",
    status: "active",
    note: "Stamp: from text message at {time}.",
  },
  {
    id: "habit-read-pages",
    category: "habits",
    primary: "read {n} pages",
    forms: ["read … pages", "read … page"],
    format: "`read 30 pages`",
    explanation: "Whole-message quantity keyword for reading habits (preset). Not the same as `read:` list dump.",
    status: "active",
  },
  {
    id: "habit-exercise",
    category: "habits",
    primary: "exercise {n} min …",
    forms: ["exercise …"],
    format: "`exercise 15 min walked to the cliffs`",
    explanation: "Whole-message quantity keyword for exercise habits; trailing detail goes into notes.",
    status: "active",
  },
  {
    id: "habit-chess",
    category: "habits",
    primary: "chess score {n}",
    forms: ["chess score …"],
    format: "`chess score 355`",
    explanation: "Whole-message score keyword for chess-like habits (preset).",
    status: "active",
  },

  // ── Log / discrete ──────────────────────────────────────────────
  {
    id: "log",
    category: "log",
    primary: "log:",
    forms: ["log:", "log-", "log"],
    format:
      "`log: left room` · `log: left room at 3:30` · `log: left room at 3:30 loc: home` · `log: shower 7:30 - 7:45` · `log: shower 10m` · `log: START walk` · `log: END walk 5:00` · `log: went outside 12:04` · `log went outside 7/4/26 1:00`",
    explanation:
      "Tracking note on Activity, the Event row of the Tracking log. The word log works with or without the colon. No time → point at send time. `at 3:30` is a point on the send date. `7:30 - 7:45` is a range. `10m` / `10 min` just finished (end = send time). START/END pair an activity. A line under the event is the note; the clock stays on the first line. A later block over that minute leaves the point. Times use the machine timezone. A clock with no certainty word is exact (`clockCertainty` omitted). `est` / `estimated` / `~` marks the time estimated and also sets `precision: estimated`. `unknown` keeps the named minute for placement and does not treat it as observed. Put the word after the clock, or after the place. Trailing `loc: home` reuses or creates that Location pen and paints a Location instant at the same minute (`log: left room loc: home`, `log: left room at 3:30 loc: home`). The place is the last suffix. The event phrase is stored as the title and as `eventKind`, a lowercase slug with spaces collapsed and punctuation removed, so the same phrase groups (`left room`). Saved keywords, added in Tracking settings (the gear), match the longest phrase (`log: went outside`, `log went outside 12:04`, `log: went outside 7/4/26 1:00`). The remainder is the optional date and time, not part of the title. The title is the saved phrase and `eventKind` is its slug. A bare phrase with no log prefix is not a log. On a log line, a clock with no am/pm is military time: `12:04` is noon, `18:37` is 6:37pm, and `1:00` is 1:00am, not 1pm. `1pm`, `1:00pm`, `1 PM`, `1:00 PM`, and `1:00 p.m.` are 1:00pm. `7/4/26` and `7/4/2026` are July 4, 2026 (month/day/year). Log lines, switch lines, and tracking-note clocks share that reader (`parseExpectedWhen`). Ordinary inbox text is not parsed this way. Labeled from text pipeline. Bare `o` is NOT a log.",
    status: "active",
  },
  {
    id: "thought-process",
    category: "log",
    primary: "tp:",
    forms: ["tp:", "TP:", "thought process:", "log: tp:"],
    format:
      "`tp: opening the editor to fix the clock` · `TP: …` · `thought process: …` · `log: tp: …`",
    explanation:
      "A specialized note: the crystallized thought of this moment, not a general note. Why you are doing something, what you plan to do, the exact current line of thought. Colon required on the verb, so bare `tp` and bare `thought process` stay capture. Activity instant on the Text log pen, `eventKind` `thought-process`. The first line is the title; lines under it are the note. No time uses the send time. Clocks are `parseExpectedWhen`, the same reader as a log line. A bare clock is military (`1:00` is 1:00am, `12:04` is noon). `1pm`, `1:00 PM`, and `1:00 p.m.` are 13:00. `7/4/26` is July 4, 2026. `est` / `estimated` / `~` is estimated (`clockCertainty` and `precision: estimated`). `unknown` keeps the minute for placement. A general note stays `note:` / `n`.",
    status: "active",
  },
  {
    id: "log-keywords",
    category: "log",
    primary: "log keywords",
    forms: ["log keywords", "log: keywords"],
    format: "`log keywords` · `log: keywords`",
    explanation:
      "Numbered list of saved log keywords. Does not create a log row. Phrases are added in Tracking settings (the gear) and start empty. A saved phrase is logged with `log: went outside` or `log went outside` (colon optional). A clock or US date after the phrase is the time, not part of the title. Longest saved phrase wins. A bare phrase with no log prefix is not this log. On a log line, a clock with no am/pm is military time (`12:04` noon, `1:00` is 1:00am, `1pm` is 1:00pm). Log lines, switch lines, and tracking-note clocks share that reader (`parseExpectedWhen`). Ordinary inbox text is not parsed this way.",
    status: "active",
  },
  {
    id: "intake",
    category: "log",
    primary: "intake:",
    forms: ["intake:", "intake food:", "intake drink:", "intake drug:"],
    format:
      "`intake: coffee` · `intake food: egg salad` · `intake drink: coffee at 8:15` · `intake drug: tablet est` · `intake: coffee at 8:15 unknown`",
    explanation:
      "Food, drink, medicine, or any intake — the Intake row of the Tracking log. Food is a subset of intake. Always a point — no duration. Pen: Intake. No time uses the send time. A following clock uses that time on the send date. `intake food:` / `intake drink:` / `intake drug:` set `intakeClass` and `eventKind` `intake.food` / `intake.drink` / `intake.drug`. Bare `intake:` leaves `intakeClass` unset and sets `eventKind` to `intake`. A clock with no certainty word is exact. `est` / `estimated` / `~` is estimated (`clockCertainty` and `precision: estimated`). `unknown` stores the minute for placement only. A line under the event is the note. `ate` / `drank` / `took` keep the Text log pen and set the same class. Vertical line on the Tracking grid. A later block leaves the point.",
    status: "active",
  },
  {
    id: "switch",
    category: "log",
    primary: "switch:",
    forms: ["switch:"],
    format:
      "`switch: location from: home to: ralphs` · `switch: activity from: working on brain2 to: working on foxtide 6:37pm` · `switch: company Elijah` · `switch: to cleaning` · `switch: from email to cleaning`",
    explanation:
      "Switch. The colon sits right after `switch`. The next word is the Tracking view when it names one you have (Activity, Location, Mood, Company, …). Omit it and the view is Activity (`switch: to cleaning`, `switch: from email to cleaning`). `from:` is what you left and `to:` is the destination; a bare name after the view is the destination (`switch: company Elijah`). Optional clock, else the send time. The clock and date are `parseExpectedWhen`, the same reader as a log line and a tracking-note clock. A bare clock is military (`18:37` is 6:37pm, `6:37` is 06:37, `1:00` is 1:00am). `6:37pm`, `6:37 PM`, `1pm`, `1:00pm`, `1 PM`, `1:00 PM`, and `1:00 p.m.` are 13:00. A bare integer is not a clock. Optional `7/4/26` or `7/4/2026` is month/day/year on the local calendar; a date with no clock keeps the send clock. `at` marks the clock and is not part of the destination. Ordinary inbox text is not parsed this way. `est` / `estimated` / `~` is estimated. `unknown` keeps the minute for placement. Activity stores the same instant as `st:`: pen Switch, title `started …` or `stopped … · started …`, plus `switchFrom` / `switchTo`. Any other view paints an instant on that scope. `to` is that scope’s pen (existing name, or created the way that view adds a pen). `from` is found or created the same way and stored; the tick’s color is the destination. There is no Goal view.",
    status: "active",
  },
  {
    id: "log-categories",
    category: "log",
    primary: "log categories",
    forms: ["log categories", "log: categories"],
    format: "`log categories` · `log: categories`",
    explanation:
      "Reply only. A numbered list of the tracking views in the store: display name, the id you type after `switch:`, and `depth N` when that view’s display depth is set. Not a logged event.",
    status: "active",
  },
  {
    id: "switch-task",
    category: "log",
    primary: "st:",
    forms: ["st:", "switch task:"],
    format: "`st: cleaning` · `switch task: cleaning at 3:30` · `st: from: email to: cleaning`",
    explanation:
      "Alias of Switch on Activity. `st:` or `switch task:` (colon required). Same stored instant as before: pen Switch, title `started …` (or `stopped … · started …` when from: is present). `switchFrom` / `switchTo` are filled on new rows; older rows omit them. Optional clock, else send time. `est` / `estimated` / `~` is estimated. `unknown` keeps that minute for placement.",
    status: "active",
  },
  {
    id: "switch-objective",
    category: "log",
    primary: "so:",
    forms: ["so:", "switch objective:", "switch goal:"],
    format: "`so: read` · `switch objective: read at 8:00 est` · `switch goal: read`",
    explanation:
      "Alias. There is no Goal view. `so:`, `switch objective:`, or `switch goal:` (colon required) still writes the Objective pen on Activity, title `objective …` (or `left … · objective …`). `switchFrom` / `switchTo` are filled on new rows. Same clock words as `st:`.",
    status: "active",
  },
  {
    id: "transit",
    category: "log",
    primary: "transit:",
    forms: ["transit:"],
    format: "`transit: from: home to: the store` · `transit: the store`",
    explanation:
      "Location change as a tracking note. Unlabeled text is to. Optional time, else send time. The same clock words as `st:`: exact unless `est` / `estimated` / `~` or `unknown`.",
    status: "active",
  },
  {
    id: "dh",
    category: "habits",
    primary: "dh:",
    forms: ["dh:"],
    format: "`dh: hemisync` · `dh: read 30 pages` · `dh: chess score 355`",
    explanation:
      "Habit keyword. The phrase after dh: is the existing whole-message keyword. Bare keywords are not logged.",
    status: "active",
  },
  {
    id: "de-smoked",
    category: "log",
    primary: "smoked weed",
    forms: ["smoked weed"],
    format: "`smoked weed` (whole message)",
    explanation: "Default discrete-event trigger (editable in Settings → Message ingest).",
    status: "active",
  },
  {
    id: "de-drank",
    category: "log",
    primary: "drank water",
    forms: ["drank water"],
    format: "`drank water` (whole message)",
    explanation:
      "Default discrete-event trigger. Sets `intakeClass` drink and `eventKind` `intake.drink`. Pen stays Text log.",
    status: "active",
  },
  {
    id: "de-ate",
    category: "log",
    primary: "ate {item}",
    forms: ["ate …"],
    format: "`ate egg salad`",
    explanation:
      "Default discrete-event trigger with `{item}` slot. Sets `intakeClass` food and `eventKind` `intake.food`. Pen stays Text log.",
    status: "active",
  },
  {
    id: "de-took",
    category: "log",
    primary: "took {item}",
    forms: ["took …"],
    format: "`took 2 adderall`",
    explanation:
      "Default discrete-event trigger with `{item}` slot. Sets `intakeClass` drug and `eventKind` `intake.drug`. Pen stays Text log.",
    status: "active",
  },
  {
    id: "cycle",
    category: "log",
    primary: "cycle:",
    forms: ["cycle:"],
    format: "`cycle: bleeding` · `cycle: spotting` · `cycle: ovulation` · `cycle: bleeding off`",
    explanation:
      "Set bleeding, spotting, or ovulation on the message's local calendar day. The same flag plus `off` clears it. Spotting is stored and does not change the derived phase. Colon required — bare cycle is not this command. A calendar mark, not medical advice.",
    status: "active",
  },

  // ── Monitor ─────────────────────────────────────────────────────
  {
    id: "currently",
    category: "monitor",
    primary: "currently",
    forms: ["currently", "current"],
    format: "`currently deep work` · `current cooking`",
    explanation: "Start an Activity-scope interval from now through end of day. Labeled from text pipeline.",
    status: "active",
  },
  {
    id: "stopped",
    category: "monitor",
    primary: "stopped",
    forms: ["stopped"],
    format: "`stopped deep work` · `stopped`",
    explanation: "Close the open activity interval at now.",
    status: "active",
  },
  {
    id: "switched",
    category: "monitor",
    primary: "switched to",
    forms: ["switched to", "switch to", "switched"],
    format: "`switched to cooking` · `switch to email` · `switched email`",
    explanation: "Stop previous activity, start new, log a switch instant. Labeled from text pipeline.",
    status: "active",
  },

  // ── Plan ────────────────────────────────────────────────────────
  {
    id: "plan-now",
    category: "plan",
    primary: "plan for rn:",
    forms: ["plan for rn", "plan for now", "plan now", "plan rn"],
    format: "`plan for rn:` then lines · `plan for now: …`",
    explanation: "Append today's Plan log (Home → Plan day tab). Entries from Telegram show \"from text\" after the stamp.",
    status: "active",
  },
  {
    id: "read-plan",
    category: "plan",
    primary: "read plan for today",
    forms: ["read plan for today", "read plan today", "latest plan"],
    format: "`read plan for today`",
    explanation: "Reply with the latest plan-log entry for today.",
    status: "active",
  },
  {
    id: "read-plans",
    category: "plan",
    primary: "read plans for today",
    forms: ["read plans for today", "read plans today", "read plans"],
    format: "`read plans for today`",
    explanation: "Reply with every plan-log entry for today.",
    status: "active",
  },
  {
    id: "agenda",
    category: "plan",
    primary: "agenda",
    forms: ["agenda", "calendar", "plan"],
    format: "`agenda` · `calendar` · `plan`",
    explanation: "Today's calendar / agenda events (read-only dump). Distinct from `plan for rn:`.",
    status: "active",
  },

  // ── To-do ───────────────────────────────────────────────────────
  {
    id: "todo-today",
    category: "todo",
    primary: "to do today:",
    forms: ["to do today", "todo today", "do today", "tdt"],
    format: "`to do today: call dentist` · multi-line",
    explanation: "Create Home → To Do items scheduled for today.",
    status: "active",
  },
  {
    id: "do-next",
    category: "todo",
    primary: "do:",
    forms: ["do", "next action"],
    format: "`do: call dentist` · `next action: …`",
    explanation: "Create Next Actions → General items (not day-scheduled).",
    status: "active",
  },
  {
    id: "read-todo",
    category: "todo",
    primary: "read to do today",
    forms: ["read to do today", "read todo today", "read todays list"],
    format: "`read to do today`",
    explanation: "Numbered dump of open to-do items for today.",
    status: "active",
  },

  // ── Rituals / GM ────────────────────────────────────────────────
  {
    id: "gm",
    category: "review",
    primary: "gm",
    forms: ["gm", "good morning", "goodmorning"],
    format: "`gm` · `good morning`",
    explanation:
      "Start the day morning ritual (sun) over text. Opens with last night's wake-up reminder, what matters most, and focus goals when those were saved. Then sleep (or all nighter) → 5 affirmations one-at-a-time → to-do add (lines and/or rm 1 3) → required tasks (a line of only comma-separated numbers, like 1,8 or 1, 8, selects those indexes; any other line is a new to-do) → 3–5 priorities → 1–3 habit priorities → go through each to-do (six slots: tier duration points importance resistance excitement; the last three are 0–10 and may be decimals; a bad line stays on that same item; SKIP skips one; SKIP ALL skips the rest) → plaintext day plan → circumstance branches (must-not, events, excitement) → best day → 10 gratitude. Answers save as you go. If today already has some, gm asks 1 start over, 2 continue, 3 jump (that menu only). Shortcuts stay off until STOP. Live Location is paused until the ritual ends, then the same Telegram share resumes.",
    status: "active",
  },
  {
    id: "gn",
    category: "review",
    primary: "gn",
    forms: ["gn", "good night", "goodnight", "night"],
    format: "`gn` · `good night` · `night`",
    explanation:
      "Start today's night ritual (moon) over text. Unfinished (done / push / why blocked, including other plus a note) → assumed times → how the day was spent → summary → gratitude → plan reflection → went well / improve / learned → wake-up reminder → what matters most tomorrow → goals to focus → tomorrow's plan. Week and longer reviews add the period stats and the longer reflection questions before the summary. cancel quits. A walkthrough answer is not a log.",
    status: "active",
  },
  {
    id: "all-nighter",
    category: "review",
    primary: "all nighter",
    forms: ["all nighter", "all-nighter", "all nighters"],
    format: "Reply `all nighter` at the first sleep question",
    explanation:
      "Marks the night as an all-nighter and lifts habits that carry an all-nighter block (bedtime the evening before, wake and dream that morning, unless those blocks were edited). The morning routine continues.",
    status: "active",
  },
  {
    id: "ritual-skip",
    category: "review",
    primary: "skip",
    forms: ["skip", "pass", "next", "blank", "empty", "n/a", "na", "-", ".", "—", "(empty message)"],
    format: "`skip` or `next` · a blank message on period review",
    explanation:
      "Advance a ritual step without an answer (morning, night, start, or end). Morning review moves on skip or next and leaves that question empty; a blank message waits. Live Location is paused while a text ritual is open and resumes on the next edit after it ends. Period review still treats a blank message as skip.",
    status: "active",
  },
  {
    id: "reviews",
    category: "review",
    primary: "rituals",
    forms: ["rituals", "reviews"],
    format: "`rituals` · `reviews`",
    explanation:
      "Rituals board: every available/undone slot (morning, night, start, review) with status, the Telegram command to open it, and the in-app path (Header → Rituals).",
    status: "active",
  },
  {
    id: "review",
    category: "review",
    primary: "review",
    forms: ["review", "ritual"],
    format:
      "`review` · `ritual` · `review today` · `review day|week|month|quarter|year` · `ritual start week|month|quarter|year` · `ritual end week|…` · `ritual morning` · `ritual night`",
    explanation:
      "Open a ritual. Bare review/ritual starts the first available/undone slot. review <period> / ritual end <period> = end/review for the just-ended period. ritual start <period> = plan the current period, including required: 1, 8 and priority: 2 on assigned tasks. review today / ritual night = today's night (moon). ritual morning = same as gm.",
    status: "active",
  },
  {
    id: "cancel",
    category: "review",
    primary: "cancel",
    forms: ["cancel", "quit", "nevermind", "never mind"],
    format: "`cancel` · `quit` · `nevermind`",
    explanation:
      "Stop a night / start / end ritual in progress. Morning ritual ignores cancel — send STOP in all caps to quit and save.",
    status: "active",
  },
  {
    id: "morning-stop",
    category: "review",
    primary: "STOP",
    forms: ["STOP"],
    format: "`STOP` (all caps, the whole message)",
    explanation:
      "Quit the morning ritual and keep every answer so far. Shortcuts turn back on. Lowercase stop is a normal reply. Text gm afterward to start over, continue, or jump.",
    status: "active",
  },

  // ── Tracking ────────────────────────────────────────────────────
  {
    id: "at",
    category: "track",
    primary: "at:",
    forms: ["at", "location", "here", "loc"],
    format: "`at: gym` · `location: home` · `here: cafe` · `loc: …`",
    explanation: "Paint Location from now through tonight.",
    status: "active",
  },
  {
    id: "w-expansion",
    category: "track",
    primary: "w",
    forms: ["w", "@"],
    format: "`w` alone → where · `w gym` → `at: gym` · `@ home` → `at: home`",
    explanation: "Built-in expansion for location / where.",
    status: "active",
  },
  {
    id: "track",
    category: "track",
    primary: "track:",
    forms: ["track", "tracking", "doing"],
    format: "`track: exercise 30m` · `doing: work 9-11` · `tracking: …`",
    explanation: "Paint an Activity block (duration ending now, or an explicit clock window).",
    status: "active",
  },
  {
    id: "tt-expansion",
    category: "track",
    primary: "tt",
    forms: ["tt", "trk"],
    format: "`tt` alone → track · `tt work` → `track: work`",
    explanation: "Built-in expansion for track.",
    status: "active",
  },
  {
    id: "mood",
    category: "track",
    primary: "mood:",
    forms: ["mood", "feeling", "feel", "state"],
    format: "`mood: good` · `feeling: tired` · `state: …`",
    explanation:
      "Paint Mood scope until further notice, any word. The Tracking card holds the full report; a message does not fill it.",
    status: "active",
  },
  {
    id: "m-expansion",
    category: "track",
    primary: "m",
    forms: ["m"],
    format: "`m` alone → mood · `m good` → `mood: good`",
    explanation: "Built-in expansion for mood.",
    status: "active",
  },
  {
    id: "start",
    category: "track",
    primary: "start:",
    forms: ["start"],
    format: "`start: write paper`",
    explanation: "Start working-now (operation match) or start an Activity pen.",
    status: "active",
  },
  {
    id: "stop",
    category: "track",
    primary: "stop",
    forms: ["stop", "/stop"],
    format: "`stop` · `/stop`",
    explanation: "Stop working-now / pause the live activity.",
    status: "active",
  },
  {
    id: "pause-expansion",
    category: "track",
    primary: "pause",
    forms: ["pause"],
    format: "`pause`",
    explanation: "Built-in expansion → `stop`.",
    status: "active",
  },
  {
    id: "status",
    category: "read",
    primary: "where",
    forms: ["where", "status", "now", "working now"],
    format: "`where` · `status` · `now` · `working now`",
    explanation: "Snapshot: location, activity, mood, working now, last night's sleep, inbox count.",
    status: "active",
  },

  // ── Notes ───────────────────────────────────────────────────────
  {
    id: "note",
    category: "note",
    primary: "n",
    forms: ["n", "note", "jot", "memo", "day note", "daynote", "dnote"],
    format: "`n stuck in aisle 4` · `note: left room at 8:15` · `note: left room at 8:15 est` · `jot: …` · `memo: …`",
    explanation:
      "The Note row of the Tracking log: a Text log instant. No clock uses send time. `at 8:15` is that minute on the send date. A clock with no certainty word is exact. `est` / `estimated` / `~` is estimated (`clockCertainty` and `precision: estimated`). `unknown` keeps that minute for placement. The first line is the title; lines under it are the note. Also appended onto the block covering that minute, including `n loc:` / `n mood:` / `n activity:` (those `loc:` words pick a scope, not a place on an event). `day:` stays the day jot and does not read a clock.",
    status: "active",
  },
  {
    id: "day-note",
    category: "note",
    primary: "day:",
    forms: ["day:", "daynote", "dnote", "day note"],
    format: "`day: tired` · `daynote: …` · `n day: …`",
    explanation: "Tracking day jot (append log). Bare `day` expands to `today`.",
    status: "active",
  },
  {
    id: "day-expansion",
    category: "shortcut",
    primary: "day",
    forms: ["day"],
    format: "`day` alone → today · `day tired` → `n day: tired`",
    explanation: "Built-in expansion.",
    status: "active",
  },

  // ── Sleep ───────────────────────────────────────────────────────
  {
    id: "sleep",
    category: "sleep",
    primary: "sleep:",
    forms: ["sleep", "slept"],
    format: "`sleep: 11:30-7:00` · `slept: …`",
    explanation: "Log bed/wake on the current morning key in the sleep store.",
    status: "active",
  },

  // ── GPS ─────────────────────────────────────────────────────────
  {
    id: "gps",
    category: "gps",
    primary: "gps:",
    forms: ["gps", "geo", "gps-log"],
    format: "`gps: Home` · `gps-log:` · `at: 2026-10-05T19:04:00` · Telegram Live Location",
    explanation:
      "Paint Location up to the sample time, never through the rest of the day. Same coordinates keep the current pen. A Telegram venue pin is a shared place, not where you are. A fuzzy fix does not move you. gps-log: replays lines the phone saved while offline. Message ingest hides these points unless you show GPS. A text ritual pauses Live Location and the same share resumes when that ritual ends.",
    status: "active",
  },

  // ── iPhone Screen / Call / Text ──────────────────────────────────
  {
    id: "screen",
    category: "screen",
    primary: "screen:",
    forms: ["screen", "screentime", "phone-screen", "iphone", "ios"],
    format: "`screen: Instagram 30m` · `screentime: …` · `iphone: …` · `ios: …`",
    explanation: "iPhone Screen Time interval (estimated). Not Mac ActivityWatch. Shortcut available.",
    status: "active",
    note: "`iphone-notes:` still wins over bare `iphone` when that longer alias matches.",
  },
  {
    id: "call",
    category: "call",
    primary: "call:",
    forms: ["call", "called", "phone-call"],
    format: "`call: Jane 12m` · `called: Mom 3:02-3:17` · `phone-call: …`",
    explanation: "iPhone Calls interval (who + duration or clock window). Estimated.",
    status: "active",
  },
  {
    id: "text-msg",
    category: "text",
    primary: "text:",
    forms: ["text", "sms", "imessage", "sent"],
    format: "`text: Jane on my way` · `sms: …` · `imessage: …` · `sent: …`",
    explanation: "iPhone Texts instant. First word is who; the rest is the body.",
    status: "active",
  },

  // ── iPhone Notes ────────────────────────────────────────────────
  {
    id: "iphone-notes",
    category: "iphone-notes",
    primary: "iphone-notes:",
    forms: ["iphone-notes", "iphone notes", "phone notes", "inotes"],
    format: "`iphone-notes:` body · `iphone-notes 2/3:` continuations · `inotes:` · `phone notes:`",
    explanation:
      "Park an On My iPhone note dump onto Lists → iPhone Notes Store → Parked (header Phone Notes). Not the tracker `n` jot.",
    status: "active",
  },

  // ── Inventory / receipt / journal / pdf ─────────────────────────
  {
    id: "inv",
    category: "inventory",
    primary: "inv",
    forms: ["inv", "inventory", "pantry"],
    format: "`inv` · `inventory` · `pantry` · `inv oats`",
    explanation: "Dump the pantry list, or bump a line's quantity.",
    status: "active",
  },
  {
    id: "receipt",
    category: "receipt",
    primary: "receipt",
    forms: ["receipt", "reciept", "slip"],
    format: "Photo of a receipt · caption `receipt:` / `slip:`",
    explanation: "Local OCR → grocery check-off + pantry bump. Asks when a name is new.",
    status: "active",
  },
  {
    id: "journal",
    category: "journal",
    primary: "journal",
    forms: ["journal", "notebook", "pages", "scan"],
    format: "Journal photo(s) · caption `journal:` / `notebook:` / `pages:` / `scan:`",
    explanation: "Deskew + searchable text → Docs note in folder From phone (optional PDF).",
    status: "active",
  },
  {
    id: "pdf",
    category: "journal",
    primary: "pdf",
    forms: ["pdf"],
    format: "Forward a PDF · optional caption `pdf: title`",
    explanation: "Park a PDF as a Docs item (typed `pdf:` alone needs the file).",
    status: "active",
  },

  // ── Read-back ───────────────────────────────────────────────────
  {
    id: "read",
    category: "read",
    primary: "read:",
    forms: ["read", "show", "dump", "peek"],
    format: "`read: grocery list` · `show: Groceries` · `dump: chores` · `peek: …`",
    explanation:
      "Dump a named list or folder as plain text. Grocery-ish dumps also pin. `read list: Name` / `read folder: Home` when the name is shared. Matches nothing → parks on iPhone Notes Store (not a picker).",
    status: "active",
    note: "Whole-message `read 30 pages` is a habit keyword when configured, not this verb.",
  },
  {
    id: "lists",
    category: "read",
    primary: "lists",
    forms: ["lists", "ls", "list of lists", "list lists"],
    format: "`lists` · `ls`",
    explanation: "Catalog of lists grouped by folder, with open counts. Bare `list:` is still a capture path.",
    status: "active",
  },
  {
    id: "folders",
    category: "read",
    primary: "folders",
    forms: ["folders", "dirs", "list of folders", "list folders"],
    format: "`folders` · `dirs`",
    explanation: "Catalog of folders. Bare `folder:` is still a capture path.",
    status: "active",
  },
  {
    id: "inbox-dump",
    category: "read",
    primary: "read inbox",
    forms: ["read inbox", "show inbox", "dump inbox", "open inbox"],
    format: "`read inbox` · `show inbox` · `dump inbox`",
    explanation:
      "Dump Inbox, newest first, then Monkey brain if any. Bare `inbox:` still captures. -mb / -monkey on a capture dumps it in Monkey brain.",
    status: "active",
  },
  {
    id: "search",
    category: "read",
    primary: "search:",
    forms: ["search", "find", "?"],
    format: "`search: milk` · `find: oats` · `? oat`",
    explanation: "Ranked item search across the vault.",
    status: "active",
  },
  {
    id: "today",
    category: "read",
    primary: "today",
    forms: ["today", "tdy"],
    format: "`today` · `tdy`",
    explanation: "Snapshot: inbox count, habit %, location/activity, working now, today's plan.",
    status: "active",
  },
  {
    id: "ops",
    category: "read",
    primary: "ops",
    forms: ["ops", "operations"],
    format: "`ops` · `operations`",
    explanation: "List operation names.",
    status: "active",
  },
  {
    id: "count",
    category: "read",
    primary: "count",
    forms: ["count", "counts"],
    format: "`count` · `count: grocery`",
    explanation: "Open-item sizes overall, or for a named list.",
    status: "active",
  },
  {
    id: "tags",
    category: "read",
    primary: "tags",
    forms: ["tags"],
    format: "`tags`",
    explanation: "Item tags in use.",
    status: "active",
  },

  // ── Shortcuts ───────────────────────────────────────────────────
  {
    id: "custom-shortcuts",
    category: "shortcut",
    primary: "(custom first-word shortcuts)",
    forms: ["Settings → Message ingest shortcuts"],
    format: "e.g. `store` → `groc` (first token only; letters/digits/_/-)",
    explanation:
      "User-defined first-word expansions run before the verb parser. Expansions that still point at bare `g` are remapped to `groc`.",
    status: "active",
  },

  // ── Media ───────────────────────────────────────────────────────
  {
    id: "voice",
    category: "media",
    primary: "(voice note)",
    forms: ["Telegram voice", "Telegram audio"],
    format: "Send a voice note during `gm` affirmations",
    explanation:
      "During an open morning ritual, a voice/audio message advances the step (counts as an answer). Outside a ritual, BIM acknowledges and suggests `gm`.",
    status: "active",
  },
  {
    id: "photo",
    category: "media",
    primary: "(photo)",
    forms: ["Telegram photo"],
    format: "Snap a receipt or journal page (optional caption)",
    explanation: "Routes to receipt OCR or journal scan based on caption / heuristics.",
    status: "active",
  },
]

export function catalogByCategory(category: CatalogCategory): CatalogEntry[] {
  return BIM_COMMAND_CATALOG.filter((e) => e.category === category)
}

export function formatCatalogEntry(entry: CatalogEntry): string {
  const status = entry.status === "retired" ? " [RETIRED]" : ""
  const forms =
    entry.forms.length > 1
      ? `\n  Aliases: ${entry.forms.join(" · ")}`
      : ""
  const note = entry.note ? `\n  Note: ${entry.note}` : ""
  return `• ${entry.primary}${status}
  Format: ${entry.format}
  ${entry.explanation}${forms}${note}`
}

export function formatCategoryBlock(category: CatalogCategory): string {
  const label = CATALOG_CATEGORY_LABELS[category]
  const rows = catalogByCategory(category)
  if (rows.length === 0) return ""
  return [`── ${label} ──`, ...rows.map(formatCatalogEntry)].join("\n")
}

/** Categories in display order for `all commands`. */
export const CATALOG_ORDER: CatalogCategory[] = [
  "help",
  "pair",
  "grocery",
  "needed",
  "capture",
  "bulk",
  "habits",
  "log",
  "monitor",
  "plan",
  "todo",
  "review",
  "track",
  "note",
  "sleep",
  "gps",
  "screen",
  "call",
  "text",
  "iphone-notes",
  "pin",
  "inventory",
  "receipt",
  "journal",
  "read",
  "shortcut",
  "media",
]

/** Map glossary family keys → catalog categories to include. */
export const FAMILY_TO_CATEGORIES: Record<string, CatalogCategory[]> = {
  grocery: ["grocery", "pin"],
  needed: ["needed"],
  plan: ["plan"],
  habits: ["habits"],
  log: ["log"],
  monitor: ["monitor"],
  todo: ["todo"],
  ingest: ["capture", "bulk", "shortcut"],
  review: ["review"],
  track: ["track", "sleep"],
  note: ["note"],
  sleep: ["sleep"],
  gps: ["gps"],
  screen: ["screen"],
  call: ["call"],
  text: ["text"],
  pin: ["pin"],
  inventory: ["inventory"],
  receipt: ["receipt"],
  journal: ["journal", "media"],
  "iphone-notes": ["iphone-notes"],
  read: ["read"],
  help: ["help", "pair"],
}

export function formatAllCommandsBody(): string {
  return CATALOG_ORDER.map(formatCategoryBlock).filter(Boolean).join("\n\n")
}

export function formatFamilyCommands(family: string): string {
  const cats = FAMILY_TO_CATEGORIES[family] ?? []
  return cats.map(formatCategoryBlock).filter(Boolean).join("\n\n")
}

export function catalogMarkdown(): string {
  const lines = [
    "# BIM command catalog",
    "",
    "Complete list of phrases **BIM** (Brain2 Ingestion Messenger) accepts.",
    "Generated from the live surface in `lib/ingest/command-catalog.ts`",
    "(parser verbs, expansions, habit/discrete presets, bulk dumps, morning GM, retired `g`).",
    "",
    "In chat: `info` · `{prefix} info` · `{prefix} commands` · `all commands`.",
    "",
  ]
  for (const cat of CATALOG_ORDER) {
    const rows = catalogByCategory(cat)
    if (!rows.length) continue
    lines.push(`## ${CATALOG_CATEGORY_LABELS[cat]}`, "")
    for (const e of rows) {
      const badge = e.status === "retired" ? " *(retired)*" : ""
      lines.push(`### \`${e.primary}\`${badge}`, "")
      lines.push(`- **Format:** ${e.format}`)
      if (e.forms.length) lines.push(`- **Forms / aliases:** ${e.forms.map((f) => `\`${f}\``).join(", ")}`)
      lines.push(`- **Does:** ${e.explanation}`)
      if (e.note) lines.push(`- **Note:** ${e.note}`)
      lines.push("")
    }
  }
  return lines.join("\n")
}
