/**
 * lib/bim-flow/tests-real.ts — Bench tests worded from the person's own BIM texts
 *
 * Every input is a line (or a run of lines) the person actually sent to BIM
 * between Oct 14 and Oct 30, 2026 ("Real ·"), or lives in the rest of the vault
 * ("Vault ·": older text-log entries from Sep 23–Oct 15, lists and their items,
 * habits, task regrets, day reviews, day notes), picked for variety: shorthand and typos,
 * one-word lines, open-ended times, spending, medicine counts, dreams, feelings,
 * brain2 ideas that are not activities, shopping fragments, rules that want a
 * build, and long run-ons. Clock times are placed by hand. A few strangers'
 * names were swapped; first names the vault already holds were kept.
 *
 * `expect` says in words what a good run does. Most tests have no hard check,
 * because the right output is a judgment, so they show as "review" until read.
 */

import type { BimTest } from "./tests"

const lines = (...l: string[]) => l.join("\n")

export const REAL_TESTS: BimTest[] = [
  // ── Log: BIM text (routed) ───────────────────────────────────────────────
  {
    id: "real-shower-egg-bites", name: "Real · Log (routed): resist shower → shower → egg bites", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: lines("16:15 Feeling strong resistance to shower, using music to motivate me to get in", "16:44 Done with shower now time to get dressed", "16:50 Starting to cook making egg bites", "17:25 Still cooking egg bites", "17:48 Done cooking and eating egg bites") },
    expect: "A shower block ending 16:44, a cooking block 16:50–17:48 with eating at the end, a resistance reading on showering. The 'still cooking' line adds no new block.",
    checks: { blocksContain: ["cook"] },
  },
  {
    id: "real-evening-mixed", name: "Real · Log (routed): messy evening, chores and errands between", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: lines("19:07 Nap i think maybe o idk nap since 10 idk still tired but i took my meds and i need to worrkkkk", "19:08 Def want to scroll less", "20:12 Finally changed my outfit", "20:13 Take out trash and recycling -i", "20:14 Mineral oil on rocks , jewelry class", "20:17 Need a lotttt of frames kept seeing em at goodwill and not getting them put that for sure on goodwill list and rate it as if reasonable price, neeeeed and buy!", "21:16 Went much fatter this time and it's ironic because it's kind of like I literally smoked it on my responsibilities. Should write a journal entry about that actually.") },
    expect: "A nap/rest block from about 10, meds taken, a want (scroll less), a to-do (trash and recycling, marked), a Goodwill list item (frames) tagged need/buy, a journal prompt. Not one invented work block.",
  },
  {
    id: "real-spend-shorthand", name: "Real · Log (routed): spending in shorthand", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: "01:33 Spent 21.50 on 2sfrb 1 apple rb 1 dp 1 lemonade pack of gum" },
    expect: "Reads rb as Red Bull and dp as a drink, keeps $21.50 as the spend, and logs the drinks and gum as intake. No activity block.",
  },
  {
    id: "real-open-walk", name: "Real · Log (routed): a walk begun at a clock time", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: "00:09 Walking since 4:46" },
    expect: "One walking block that opens at 4:46 and stays open. The clock in the text beats the time the message was sent.",
  },
  {
    id: "real-one-word-lines", name: "Real · Log (routed): one-word lines (O, Up, Plucky, J)", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: lines("13:10 O", "13:19 O", "00:08 Up", "19:54 Plucky", "19:18 J", "07:42 Camshare") },
    expect: "O is the orgasm pen (two counted), Up is waking. Plucky, J and Camshare carry too little to place: kept as notes, nothing invented.",
  },
  {
    id: "real-o-count-sleep", name: "Real · Log (routed): 'O x 2 sleeping til 3'", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: "23:30 O x 2 sleeping til 3 something" },
    expect: "O logged with a count of 2, then a sleep block with an end near 3 (not a start).",
  },
  {
    id: "real-wake-dream", name: "Real · Log (routed): woke from a dream about people", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: lines("21:40 Woke dream involving school, Alexis wanting to be friends again", "12:48 From a dream where me and someone else made, my sister were in a park next to an older woman and we said the right thing and then she liked us and gave Rebecca a job or s") },
    expect: "A dream note (journal), not an activity. Alexis and Rebecca linked as people when they exist. Waking marks the end of sleep.",
  },
  {
    id: "real-brain2-ideas", name: "Real · Log (routed): brain2 ideas that are not activities", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: lines("02:48 Brain2: define habits completion tiers option; bare minimum drink water is drink any water, etc", "02:49 Brain2: EXPAND THE AUTOLINK DETECTION STUFF and also for stuff like instagram and phone number from data allow search by contact name or display name", "01:56 Brain: still deciding whether to keep having to manually click save over and over for changes to an item.. maybe make it auto?") },
    expect: "Each goes to the brain2 to-do or idea list. None becomes a 'Computer Work' block, and none is read as the person doing it now.",
  },
  {
    id: "real-people-and-tasks", name: "Real · Log (routed): one run-on with two people and four jobs", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: "00:48 Tell elijah about texts and instagram analysis also tell rebecca also text rebcca back also how many pieces do i wish (how much addy is left)" },
    expect: "Splits into: tell Elijah, tell Rebecca, text Rebecca back (typo linked), count what is left of the pills. Two people, three to-dos, no block.",
  },
  {
    id: "real-med-count", name: "Real · Log (routed): medicine taken with a count left", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: lines("19:26 Taking another addy 14 left now wow how much i need a higher dose wowwwww need to get it upped for real", "06:14 Took the addy btw (2)") },
    expect: "Intake for the pill with the time, remaining count 14 kept as a fact, and 'get the dose raised' as a to-do. The (2) is the second dose.",
  },
  {
    id: "real-intentions-done", name: "Real · Log (routed): intentions, then one done", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: lines("03:37 Intention: take chlorophyll , take adderall, get water", "03:53 Took the chlorophyll", "03:53 Intention: get wipe to clean laptop", "04:46 Gonna go grab red bull") },
    expect: "Three intentions set, then the chlorophyll one checked off; the laptop wipe and the Red Bull errand open.",
  },
  {
    id: "real-company-chore", name: "Real · Log (routed): company and a chore born of a complaint", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: lines("16:03 Just o elijah now waking up", "16:43 motivated to clean room bc elijah complained in his journal which i barely peeked at", "17:25 Elijah bday dinner tm also Jordan thing") },
    expect: "Elijah as company at the first line, a clean-the-room job with a reason, and two plans for tomorrow (a birthday dinner, a Jordan thing).",
  },
  {
    id: "real-thought-process", name: "Real · Log (routed): a long 'Thought process' run-on", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: "06:35 Thought process: getting rly snacky and hungry (seaweed pack some salami and a chunk of mozzarella cheese) but need to get this foxtide stuff done TONIGHHHT so gonna take" },
    expect: "Intake (seaweed, salami, mozzarella), a Foxtide commitment for tonight, a thought entry. The cut-off ending is not guessed.",
  },
  {
    id: "real-grief-free-feeling", name: "Real · Log (routed): feeling lines", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: lines("23:49 (Olaying by myself outside)", "23:49 Making me happy", "02:05 No one else will ever know what its like to be you and you wont ever know what its like to be anyone else", "21:16 Life is beautiful") },
    expect: "A mood (happy) with outside as the place, the quotes saved as thoughts or quotes. No block for a line like 'Life is beautiful'.",
  },
  {
    id: "real-link-notes", name: "Real · Log (routed): links with a one-word note", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: lines("00:19 https://www.instagram.com/reel/EXAMPLE1/?rpxt=abc holograph pendant", "00:16 Mirror craft with disco sheet https://www.instagram.com/reel/EXAMPLE2/?psln=abc", "07:33 https://www.instagram.com/reel/EXAMPLE3/?psln=abc foxtide", "04:17 https://shop.example.com/products/bison-tallow-balm-sandalwood?utm_source=ig") },
    expect: "Each link goes to the inbox or the craft/foxtide list by its note, the note kept with it. A link with no note goes to the inbox plain.",
  },
  {
    id: "real-day-1-long", name: "Real · Log (routed): a long night (10 lines, many topics)", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: lines("00:39 Brain2: actually package it into a desktop app, improve mobile app, make hardware component (compatible with remarkable?)", "00:44 Objective: make coffee", "00:45 dishes really stinky need to add importance and points to do dishes also oooo adding suggested chores and connecting cleaning module to \"clean for 15 min\" ?", "00:47 So coffee being made now, next is start a 30 min session for cd design specifically, with bare min being mockups completed for every element of both cds", "06:43 Intake: bricoche hamburger bun grilled with about 1-2 tbs of butter garlic powder and salt served with goat cheese and mozzarella chunks, plus now black coffee", "06:53 Log: OKAY SERIOUSLY NO MORE BRAIN2 UNTIL AT LEAST 1 CD DESIGN FULLY DONE IN GOOGLE DRIVE. Also how u earn a chicken wing.") },
    expect: "An objective set, a coffee block, a CD-design session planned (not logged as done), intake of a meal, a rule for the person to stay off brain2. Dishes are a chore idea.",
  },

  // ── Log: grammar first ───────────────────────────────────────────────────
  {
    id: "real-grammar-verbs", name: "Real · Log (grammar first): BIM's own verbs as they were sent", flowId: "log-grammar", entry: "bim-text",
    input: { kind: "paste", text: lines("17:00 Log: o", "10:48 Intake: brig", "16:11 Start substack", "16:12 Today menu", "01:40 /start") },
    expect: "log: o and intake: and Start are decided by code with no model; the menu and /start are commands, not notes. Check the trace for model calls.",
  },
  {
    id: "real-grammar-link-first", name: "Real · Log (grammar first): link first, note after; plain line behind it", flowId: "log-grammar", entry: "bim-text",
    input: { kind: "paste", text: lines("19:28 https://www.instagram.com/reel/EXAMPLE4/?obrf=abc foxtide viz", "19:59 Get my carrrrrrrr", "09:47 Super glue and baking soda") },
    expect: "The link line takes the link door with its note; the other two go on to the routed flow as an errand and a shopping item.",
    checks: { proposalsContain: ["Inbox"] },
  },

  // ── Log: phone capture ───────────────────────────────────────────────────
  {
    id: "real-phone-shopping", name: "Real · Phone capture: shopping fragments", flowId: "log-phone", entry: "phone-capture",
    input: { kind: "paste", text: lines("19:40 Portable scanner", "03:16 2 color tights", "19:20 Gotta get shoes sole repair stuff", "04:59 Need more macbook bricks", "04:37 Get: more big, sheer scarves") },
    expect: "Each lands as one shopping item, de-duplicated against the existing list (macbook bricks may already exist). None goes to Ask.",
  },
  {
    id: "real-phone-objective-later", name: "Real · Phone capture: Objective, Later, Idea, Plan prefixes", flowId: "log-phone", entry: "phone-capture",
    input: { kind: "paste", text: lines("00:44 Objective: make coffee", "20:12 Later: update how bim receives images", "23:30 Idea: using nfc tags to track drinking water, eating, weed, adderall, any pills, and \"went outside\" auto logging", "22:07 Plan: work on cds, finish them and have the 3d mockup emailed with options by 6pm for at least 1 of them to buy time, text shelby and elijah back") },
    expect: "Objective sets the current objective; Later is a deferred to-do on brain2; Idea is an idea note; Plan becomes a dated plan with a 6pm deadline and two text-back jobs.",
  },
  {
    id: "real-phone-rule-request", name: "Real · Phone capture: a rule to build ('text back {}')", flowId: "log-phone", entry: "phone-capture",
    input: { kind: "question", text: "Brain2: autoadd to texts to send list and correspondence list from to do list and plans matching \"text back {}\" or \"text {} back\" , \"respond to {}\"" },
    expect: "Not a note and not a question: a build request for a rule between existing lists. Today it should be routed as a to-do for brain2 and flagged as unbuilt.",
  },
  {
    id: "real-phone-reminder-bday", name: "Real · Phone capture: a birthday statement", flowId: "log-phone", entry: "phone-capture",
    input: { kind: "question", text: "Today is Mina's birthday" },
    expect: "A dated fact (a birthday for Mina, today), not a to-do and not a question. If Mina is not a known person, offer to add her.",
  },
  {
    id: "real-phone-question-count", name: "Real · Phone capture: a count question", flowId: "log-phone", entry: "phone-capture",
    input: { kind: "question", text: "how many red bulls have i had this week?" },
    expect: "Goes to Ask, not logged as a note. The count is code's, the model only phrases it.",
  },
  {
    id: "real-phone-hybrid", name: "Real · Phone capture: a thought with a task in it", flowId: "log-phone", entry: "phone-capture",
    input: { kind: "question", text: "Soda came to visit for first time since elijah left" },
    expect: "A journal/thought with Soda (a cat or person) and Elijah linked. Not a question, no block.",
  },

  // ── Log: time-grid note ──────────────────────────────────────────────────
  {
    id: "real-grid-snacky", name: "Real · Time-grid note: snacks while working", flowId: "log-grid", entry: "time-grid",
    input: { kind: "paste", text: "06:35 getting rly snacky and hungry (seaweed pack some salami and a chunk of mozzarella cheese)" },
    expect: "The activity is known, so only intake is pulled (three foods). No new block, no mood unless the text says one.",
  },
  {
    id: "real-grid-company", name: "Real · Time-grid note: who was there", flowId: "log-grid", entry: "time-grid",
    input: { kind: "paste", text: "16:03 Just o elijah now waking up" },
    expect: "Company: Elijah. The o count if the model catches it. No block, because the entry already has its activity.",
  },
  {
    id: "real-grid-song", name: "Real · Time-grid note: a mood from singing", flowId: "log-grid", entry: "time-grid",
    input: { kind: "paste", text: "08:44 excited about baby animal was singing in free styling over some songs now I might be making a sandwich inspired by one of those special videos if I get t" },
    expect: "A mood (excited) with a reason. 'Might be making a sandwich' is a possibility, not intake.",
  },

  // ── Ritual views ─────────────────────────────────────────────────────────
  {
    id: "real-reason-glass", name: "Real · Ritual: reason on a scary chore", flowId: "reason", entry: "miss-reason",
    input: { kind: "question", text: "Clean out the living room rug — possible glass in it, not sure how to do it without an animal getting hurt" },
    expect: "A safety/uncertainty reason (not laziness), and an idea to ask for advice. If earlier pushes of this chore exist, they are named.",
  },
  {
    id: "real-reason-brain2", name: "Real · Ritual: reason pointing at brain2 itself", flowId: "reason", entry: "miss-reason",
    input: { kind: "question", text: "Review the shortcut rundowns — got pulled into brain2 for 3 hours again, now it's 3am" },
    expect: "Reason: distraction by a favorite project and lateness. It cites how often brain2 was the reason before, if the push log has it.",
  },
  {
    id: "real-night-brain2-promise", name: "Real · Ritual: night, a promise broken", flowId: "ritual-night", entry: "ritual-night",
    input: { kind: "question", text: "OKAY SERIOUSLY NO MORE BRAIN2 UNTIL AT LEAST 1 CD DESIGN FULLY DONE. Ended up on brain2 for 3 hours anyway. Should write a journal entry about that actually." },
    expect: "A judgment on a broken rule, with earlier broken-rule answers pulled up. Not advice, and not scolding.",
  },
  {
    id: "real-night-guilt-free", name: "Real · Ritual: night, a plan that trades", flowId: "ritual-night", entry: "ritual-night",
    input: { kind: "question", text: "If I just work on Fox at seven until midnight, then I can guilt free super fucking log on BRAIN2 until the concert tomorrow" },
    expect: "A plan with a trade in it (Fox first, brain2 after). Compared with earlier plans that used the same trade, and how those went.",
  },
  {
    id: "real-morning-cds", name: "Real · Ritual: morning plan with a deadline", flowId: "ritual-morning", entry: "ritual-morning",
    input: { kind: "question", text: "Today: work on cds, finish them and have the 3d mockup emailed with options by 6pm for at least 1 of them, text shelby and elijah back, deposit money" },
    expect: "Four intentions with a 6pm deadline on one. Compared with past mornings that planned the CDs.",
  },

  // ── Ask / count / topic / day ────────────────────────────────────────────
  {
    id: "real-ask-pills-left", name: "Real · Ask: how many pills are left", flowId: "ask", input: { kind: "question", text: "how much addy do i have left?" },
    expect: "Finds the last 'N left' figure and the doses taken since, says when it was written. If not enough, says so.",
  },
  {
    id: "real-ask-fly-color", name: "Real · Ask: a detail that was never written (flies)", flowId: "ask", input: { kind: "question", text: "what color was the fly i almost swallowed?" },
    expect: "The notes mention the fly but not its color: it should say what it knows and that the color is not recorded.",
    checks: { confidenceIs: ["none", "low", "medium"] },
  },
  {
    id: "real-ask-why-shower", name: "Real · Ask: why do I resist showering", flowId: "ask", input: { kind: "question", text: "why do i keep resisting showers?" },
    expect: "Cites the resistance lines near showers, with dates. No diagnosis beyond the person's own words.",
  },
  {
    id: "real-ask-dream", name: "Real · Ask: a dream", flowId: "ask", input: { kind: "question", text: "what was the dream about my sister and the park?" },
    expect: "Finds the dream note and its date; quotes it, not a retelling.",
  },
  {
    id: "real-calc-red-bull", name: "Real · Ask (counted): Red Bulls this week", flowId: "ask-calc", input: { kind: "question", text: "how many red bulls this week?" },
    expect: "Counts intake rows that name Red Bull / rb; the number comes from code. Lists the days.",
  },
  {
    id: "real-calc-coffee-streak", name: "Real · Ask (counted): days in a row with coffee", flowId: "ask-calc", input: { kind: "question", text: "how many days in a row have i had coffee?" },
    expect: "A streak counted by code, with the day it broke. Says 'none' only if coffee was never written.",
  },
  {
    id: "real-calc-last-talked", name: "Real · Ask (counted): when did I last see Elijah", flowId: "ask-calc", input: { kind: "question", text: "when did i last see elijah?" },
    expect: "A days-since from entries with Elijah as company, or from the last mention. Which Elijah, if two fit.",
  },
  {
    id: "real-topic-nfc", name: "Real · Summarize: nfc tags", flowId: "topic", input: { kind: "question", text: "summarize what i have said about nfc tags" },
    expect: "The idea (track water, pills, outside) from Oct 24, the start on Oct 27, and the open step (set up tags). Dates given.",
  },
  {
    id: "real-topic-cds", name: "Real · Summarize: the cds", flowId: "topic", input: { kind: "question", text: "summarize what i have said about the cds" },
    expect: "The 30-minute session plan, the 6pm mockup deadline, the 'no brain2 until one is done' rule. What is still open.",
  },
  {
    id: "real-topic-brain2-ideas", name: "Real · Summarize: brain2 ideas this week", flowId: "topic", input: { kind: "question", text: "summarize my brain2 ideas from this week" },
    expect: "Grouped by area (habits, sync, mobile, texts, nfc) with no repeats. Short.",
  },
  {
    id: "real-day-oct16", name: "Real · Recap: a day from shower to dinner plans", flowId: "day", grouping: "day",
    input: { kind: "paste", text: lines("16:03 Just o elijah now waking up", "16:06 bowl? shower asap, make egg bites and arugula salad and Vietnamese coffee for breakfast, finish working on cds", "16:15 Feeling strong resistance to shower, using music to motivate me to get in", "16:44 Done with shower now time to get dressed", "16:50 Starting to cook making egg bites", "17:25 Elijah bday dinner tm also Jordan thing", "17:48 Done cooking and eating egg bites", "20:19 6 min of yt vid abt incredibles bowl smoked switching rooms rq gnna enter stuff into brain2", "20:39 bedroom now tbh feelong rllyyy sleepy") },
    expect: "Morning plan against what happened: the shower and egg bites got done, the CDs are not mentioned again. Ends sleepy in the bedroom. The recap adds nothing else.",
  },

  // ══ The rest of the vault ════════════════════════════════════════════════
  // Older text-log entries (Sep 23 – Oct 15), written into the time grid.
  {
    id: "vault-intake-ration", name: "Vault · Log (routed): intake with a count and a 'ration'", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: "00:23 intake: 3 iced oatmeal cookies and 1 more brought in as a ration even though sugar and oat and yeah yeah yeah also brought in a yerb ration" },
    expect: "Intake: cookies (3, plus 1 more) and a yerba mate. The rambling 'yeah yeah' is not food. Sugar/oat are not separate items.",
  },
  {
    id: "vault-intake-drugs-forgot", name: "Vault · Log (routed): intake: drugs: with 'forgot to say' and 'idk when'", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: "15:15 intake: drugs: another adderall forgot to say but 2 more earlier too idk when also black coffee and 1 disgusting sip of yerba mate" },
    expect: "One dose now plus two earlier at unknown times (marked as unknown, not made up), black coffee, and a sip of yerba mate. The 'disgusting' is a reaction, kept as a note.",
  },
  {
    id: "vault-exercise-spend", name: "Vault · Log (routed): exercise with a spend and a total", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: lines("19:24 exercise spent 11$ on 2 lemonade and gum and beer salt 44m", "19:25 total exercise 60m") },
    expect: "An exercise block of 44 minutes, then a correction to 60 total (not two blocks of 104). Spend $11 as purchases. Beer salt is a drink item.",
  },
  {
    id: "vault-wake-eggs", name: "Vault · Log (routed): woke, called, ate, scrolled in one line", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: "17:41 Woke up around called elijah had deviled eggs and scroll 15:00" },
    expect: "Wake at about 15:00 (written at 17:41), a call to Elijah, deviled eggs, a scrolling block. The 15:00 belongs to the waking, not the scroll.",
  },
  {
    id: "vault-queue-number", name: "Vault · Log (routed): a number that is not a time", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: "12:15 now 36-48 waiting at rubios 15 m away" },
    expect: "Waiting at Rubios is a place and a wait; 36-48 is an order number or a range, not a clock; '15 m away' is a distance. Nothing invented.",
  },
  {
    id: "vault-world-event", name: "Vault · Log (routed): a fact about the outside world", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: lines("15:05 neighbors chatter confirms power off everyone so hopefully will be fixed for everyone soon", "07:20 lowkey kind of a big event- ran out of usage for cursor. finally took elijah's amex off (guilty gutpunch) but therefore im prevented from working on 'this' (brain2) in at all the same way") },
    expect: "Power outage as an event (a fact, not an activity). The second: an event with a feeling (guilt), a money change (card removed), and a constraint on brain2 work.",
  },
  {
    id: "vault-body-bits", name: "Vault · Log (routed): small body notes", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: lines("02:56 hydrocolloid off", "06:05 Heads been really itchy", "10:13 need to shower", "03:33 identity feels loose. mood?") },
    expect: "Hydrocolloid off is a skincare step; itchy head a body note; need to shower a to-do; 'identity feels loose' a mood prompt with the person's own question left open.",
  },
  {
    id: "vault-cooking-ideas", name: "Vault · Log (routed): cooking ideas that are not cooking", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: lines("06:43 Kindaa want to make a bacon sandwich", "07:08 Make hummus", "07:40 Making me want a rice cooker damn", "07:45 Kimchi", "08:35 Confit egg yolks") },
    expect: "Wants and ideas for the cook list, a rice cooker as a wanted item. None of these is a cooking block. 'Making me want' is not 'making'.",
  },
  {
    id: "vault-switching-rooms", name: "Vault · Log (routed): place switches in a work session", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: lines("20:52 switching rooms again bc laptop dying", "18:36 switch from brain 2 to getting delivery from home depot/ grocery outlet of stuff for the house (cleaning supplies) now switching again to potentially journalling amap before the other delivery arrives", "20:58 Out") },
    expect: "Place changes (room, then out). A switch from brain2 to a delivery, then to maybe journaling: one finished block, one open, one a maybe.",
  },
  {
    id: "vault-surprise-hour", name: "Vault · Log (routed): lost time and what was done in it", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: "22:41 holy shit oh fuck wtf how the fuck has it been an hour what the fuckkk ahhh what did i do uh i cleaned up inbox and added a shift to log function for better and faster clearing" },
    expect: "A block of about an hour ending now, with the activity in it (inbox cleanup, working on the log feature) after the 'what did i do'. Surprise as a mood.",
  },
  {
    id: "vault-o-meaning", name: "Vault · Log (routed): O whose meaning changed", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: lines("21:07 O and dabbing rrrrnnn (log o totally changing meaning) mildew smell still in lr thinking abt how I need to post more pictures and how I wanna go on a trip", "07:22 Damn 1 o carried away") },
    expect: "An O is logged (one at 07:22). The note that its meaning is changing stays a note on the pen. Dabbing as intake, mildew in the living room a chore/issue, two wants (post pictures, go on a trip).",
  },
  {
    id: "vault-work-timebox", name: "Vault · Log (routed): a time box on a distraction", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: "03:31 Wellll tbh now im feeling sooooo drawn to work on brain 2 maybe ill just give myself until 4:30 to get that last bit out of system before locking in deep to foxtide" },
    expect: "A plan: brain2 until 4:30, then Foxtide deep work. A desire, not a log of doing it. The 4:30 is a future end time.",
  },
  {
    id: "vault-passwords", name: "Vault · Log (routed): a line a vault should not file", flowId: "log-routed", entry: "bim-text",
    input: { kind: "paste", text: "01:38 rn literally changing my instagram password and had a big semantic reaction to a spam account post" },
    expect: "Logged as the activity (changing a password, a reaction). No password or secret is stored anywhere; none is in the text, and none should be asked for.",
  },
  {
    id: "vault-day-oct-7", name: "Vault · Recap: Oct 7, a long night in 12 lines", flowId: "day", grouping: "day",
    input: { kind: "paste", text: lines("00:23 intake: 3 iced oatmeal cookies and 1 more brought in as a ration, also brought in a yerb ration", "01:07 in shower - where is water from and how to filter, regret for not showing full love and feelings coming off too cold", "01:32 Went to kitchen and helped elijah make sauce for noodles (yummy pb homey sesame ginger soy garlic sauce + poached egg)", "01:34 Just put on some shorts boutta go back out", "01:40 now im sitting on bed thinking of allie prime brain2 features and wantting sooo badddd to work on that but i know i have to work on foxtide", "01:48 Drank a bit of water elijah STILL eating noodles", "01:59 Starting walk", "02:57 Chilling w elijah", "03:11 Gotta just suck it up and drink from the jar i rly need water", "03:31 Wellll tbh now im feeling sooooo drawn to work on brain 2 maybe ill just give myself until 4:30", "04:09 Considering taking more adderall", "04:23 Smoked some j", "07:22 Damn 1 o carried away", "07:34 sparked j playing w simulation") },
    expect: "Shower → kitchen with Elijah → walk → chat → work pull → substances → dawn. Water as an unmet need that the person set up as a rule. No conflict invented between foxtide and brain2: it was a tug.",
  },
  {
    id: "vault-day-oct-10", name: "Vault · Recap: Oct 10, from money loss to a feast", flowId: "day", grouping: "day",
    input: { kind: "paste", text: lines("01:38 rn literally changing my instagram password", "02:40 Wanting to eat more of that bacon. Needing water", "03:33 identity feels loose. mood?", "06:35 i love omakase i wish i have unlimited time sad it's almost morning and elijah gonna wake up (need more work time)", "07:20 ran out of usage for cursor. finally took elijah's amex off (guilty gutpunch)", "08:05 feelings extremely happy and grateful for existing setup of this app", "09:03 scrolled for literally like a second but now gonna use brain2 to log stuff and plan foxtide work and rest of day then take addy, count addy, and take small nap", "10:13 need to shower", "12:15 now 36-48 waiting at rubios 15 m away", "14:36 had 1/2 the kids meal burrito and corn and little soda and it was a NEVER ENDING gorging FEAST!", "15:05 neighbors chatter confirms power off everyone") },
    expect: "A day that went from sad to grateful to full. The recap names the money event, the plan at 9:03 and what happened to it (nap/shower not confirmed), and the meal.",
  },

  // ── Lists, habits and the rest of the vault: Ask, Summarize, reasons ────
  {
    id: "vault-ask-bathroom-needs", name: "Vault · Ask: what do I need for the bathroom (many lists)", flowId: "ask", input: { kind: "question", text: "what do i need for the bathroom?" },
    expect: "Pulls from Needed, needed, needed for the house, Cleaning and Shopping lists: bathmat, hand towel ring, cabinet storage, a shower curtain that will not mold, mirror organizers. Each with its list.",
  },
  {
    id: "vault-ask-dehumidifier", name: "Vault · Ask: which list has the dehumidifier", flowId: "ask", input: { kind: "question", text: "which list is the dehumidifier on?" },
    expect: "Names the list (Needed) and not a list it merely resembles. If it is on two, both.",
  },
  {
    id: "vault-ask-foxtide-cds", name: "Vault · Ask: what is left on the Foxtide CDs list", flowId: "ask", input: { kind: "question", text: "what is left on my foxtide cds list?" },
    expect: "Open items only (Insert clean, Disc mockup, …); done ones are named as done or left out.",
  },
  {
    id: "vault-ask-habits-daily", name: "Vault · Ask: which habits are daily", flowId: "ask", input: { kind: "question", text: "which of my habits are daily?" },
    expect: "Daily ones: exercise 30 min, clean 15 min, write 3 pages, read 5 pages, meditate, go outside, brush teeth, skincare, chlorophyll, and so on. Not weekly ones (laundry, send a letter).",
  },
  {
    id: "vault-ask-films", name: "Vault · Ask: films on my list", flowId: "ask", input: { kind: "question", text: "what films do i have saved to watch?" },
    expect: "Reads the Films list (Enter the Void, The Worst Person in the World, Ace in the Hole, …). It is a list of titles, not watched or rated.",
  },
  {
    id: "vault-ask-affirmations", name: "Vault · Ask: my affirmations", flowId: "ask", input: { kind: "question", text: "read me my affirmations" },
    expect: "Quotes from the Affirmations list, no new ones made up. If long, a sample and the count.",
  },
  {
    id: "vault-ask-regret", name: "Vault · Ask: what I most regret not doing", flowId: "ask", input: { kind: "question", text: "what do i regret not doing the most?" },
    expect: "The tasks scored highest in regret (call the shop about the order, finish booking the trip, book a stay, find someone to hike with), with their scores. The score is the person's, not the model's.",
  },
  {
    id: "vault-ask-review-jun18", name: "Vault · Ask: what I wrote about a day", flowId: "ask", input: { kind: "question", text: "what did i write in my review for june 18?" },
    expect: "Reads the day review of 2026-06-18: waking late, sweet texts, guilt about missing a birthday breakfast, and the plan to make it up. Quoted, not reinterpreted.",
  },
  {
    id: "vault-ask-trip-left", name: "Vault · Ask: what is left before the trip", flowId: "ask", input: { kind: "question", text: "what's left to do before the trip?" },
    expect: "Reads 'To Do Before Trip' (find restaurants, hold mail, get a camera chip) and the South America plan lists. Names the lists it used.",
  },
  {
    id: "vault-ask-perfume", name: "Vault · Ask: perfume supplies", flowId: "ask", input: { kind: "question", text: "what do i need for the perfume trials?" },
    expect: "Reads the 'Bare-minimum supplies' and 'Fragrance' lists: Turkish rose absolute, vanillin or CO₂ vanilla, guaiacwood, and so on. It does not guess others.",
  },
  {
    id: "vault-ask-hours-brain2", name: "Vault · Ask (counted): hours on Brain2 this month", flowId: "ask-calc", input: { kind: "question", text: "how many hours did i spend on brain2 this month?" },
    expect: "Counts entries on the Brain2 pen and its 'Using Brain2' sibling, not text-log lines that mention it. Says which pens it used.",
  },
  {
    id: "vault-calc-sleep-longest", name: "Vault · Ask (counted): longest sleep", flowId: "ask-calc", input: { kind: "question", text: "what is my longest sleep this month?" },
    expect: "The longest Sleep entry in the window. If entries are open-ended it says so.",
  },
  {
    id: "vault-calc-scrolling", name: "Vault · Ask (counted): scrolling this week vs last", flowId: "ask-calc", input: { kind: "question", text: "am i scrolling more this week than last week?" },
    expect: "Compares minutes on the scrolling pen over two equal spans; machine-painted rows are left out unless asked.",
  },
  {
    id: "vault-calc-habit-gap", name: "Vault · Ask (counted): days since a habit", flowId: "ask-calc", input: { kind: "question", text: "how long since i did my laundry?" },
    expect: "Finds the last laundry mark (habit done, entry, or text); if there is none it says it never saw one.",
  },
  {
    id: "vault-topic-allie-prime", name: "Vault · Summarize: Allie Prime", flowId: "topic", input: { kind: "question", text: "summarize what i have said about allie prime" },
    expect: "The name's two spellings (allieprime, allie prime) joined; the goal to set a solid plan and template; the pull to work on it instead of Foxtide.",
  },
  {
    id: "vault-topic-south-america", name: "Vault · Summarize: South America trip", flowId: "topic", input: { kind: "question", text: "summarize the south america trip so far" },
    expect: "Reads the trip lists (To Do Before Trip, City Places, the field plan) and the regret items (finish booking, book a Cusco stay). Done vs open.",
  },
  {
    id: "vault-topic-cooking", name: "Vault · Summarize: what I want to cook", flowId: "topic", input: { kind: "question", text: "what do i want to cook or make?" },
    expect: "Pulls from the cook lists and text log: confit egg yolks, hummus, kimchi, dry-ice drinks, whipped honey, squash soup. Tools wanted are separate from dishes.",
  },
  {
    id: "vault-topic-elijah-stress", name: "Vault · Summarize: how I feel about time alone", flowId: "topic", input: { kind: "question", text: "what have i said about wanting more time alone?" },
    expect: "Grouped quotes: not wanting someone to come home so soon, needing more work time, and the dates. No diagnosis.",
  },
  {
    id: "vault-reason-call", name: "Vault · Ritual: reason on a dreaded call", flowId: "reason", entry: "miss-reason",
    input: { kind: "question", text: "CALL PLUSH IN A RUSH; MAKE ORDER! — dreading the phone call, don't know what to say" },
    expect: "A reason of dread of a call (avoidance), not time. The task has a regret of 9: say it matters more than most. Suggest a first small step if the push log shows many pushes.",
  },
  {
    id: "vault-reason-booking", name: "Vault · Ritual: reason on a task with too many choices", flowId: "reason", entry: "miss-reason",
    input: { kind: "question", text: "FULLY finish booking south america — too many options, don't know which stays" },
    expect: "A choice-overload reason. Compare to 'book cusco stay' and 'plan trip' tasks that are stuck for the same reason.",
  },
  {
    id: "vault-night-review", name: "Vault · Ritual: night, a day review as written", flowId: "ritual-night", entry: "ritual-night",
    input: { kind: "question", text: "i woke up really late in the day to some really sweet texts from elijah. I felt a bit bad because i missed a few social things including a birthday breakfast but 11am is really hard for me and i tried to make up for it. and i will make a note to continue making that up in the future." },
    expect: "A guilt-and-repair answer. It links to the late-waking pattern, not to advice on sleep. Earlier answers with the same repair move are shown.",
  },
  {
    id: "vault-morning-dev-plan", name: "Vault · Ritual: morning, a numbered plan", flowId: "ritual-morning", entry: "ritual-morning",
    input: { kind: "question", text: "next stuff i plan to do with brain2 dev (@7:30): 1. Finish what i started (all 3 or 4 things) 2. Continue the claude redesign 3. do timegrid if changes didnt transfer well" },
    expect: "Three numbered intentions with a 7:30 start. 'All 3 or 4 things' is vague and flagged, not guessed. Compared with earlier brain2 plans.",
  },

  // ── Phone capture: list placement, duplicates, odd shapes ───────────────
  {
    id: "vault-phone-duplicate-reading", name: "Vault · Phone capture: an item already on the list", flowId: "log-phone", entry: "phone-capture",
    input: { kind: "question", text: "add Finite and Infinite Games to my reading list" },
    expect: "It is already on the Reading List: say so and add nothing (or add a note), not a duplicate.",
  },
  {
    id: "vault-phone-duplicate-habit", name: "Vault · Phone capture: a habit that exists", flowId: "log-phone", entry: "phone-capture",
    input: { kind: "question", text: "make a new daily habit called drink water" },
    expect: "'Drink water' already exists: offer it, don't create a second. If the person wants a different version, ask.",
  },
  {
    id: "vault-phone-multi-item", name: "Vault · Phone capture: two items in one line", flowId: "log-phone", entry: "phone-capture",
    input: { kind: "question", text: "culinary tweezers, oils in sauce bottles for plating" },
    expect: "Two items, one list (cooking). Plating is the reason, not an item.",
  },
  {
    id: "vault-phone-purchase-moves", name: "Vault · Phone capture: bought it", flowId: "log-phone", entry: "phone-capture",
    input: { kind: "question", text: "bought bulk nfc tags (300)" },
    expect: "Matches the wanted/needed item and moves it to Purchased with the count, or adds to Purchased if none. A spend if there is a price.",
  },
  {
    id: "vault-phone-idea-recipe", name: "Vault · Phone capture: a recipe idea", flowId: "log-phone", entry: "phone-capture",
    input: { kind: "question", text: "carbonate any drink with dry ice" },
    expect: "An idea for the cook list (a technique), not a shopping item. Dry ice may be offered as an item to get.",
  },
  {
    id: "vault-phone-reminder", name: "Vault · Phone capture: a reminder to ask for something", flowId: "log-phone", entry: "phone-capture",
    input: { kind: "question", text: "Request a new Instagram export" },
    expect: "A reminder/to-do with no date, on the REMINDERS list. 'Instagram' is a context, not a person.",
  },
  {
    id: "vault-phone-money", name: "Vault · Phone capture: money to-dos", flowId: "log-phone", entry: "phone-capture",
    input: { kind: "paste", text: lines("12:00 redo amex spreadsheet", "12:01 need money for the trip", "12:02 put cash in and get new york tickets ($300 ish try to get downnnn)") },
    expect: "A job (redo spreadsheet), a need (money), and a plan with a budget ($300) for tickets. Three items; the budget is kept as a number.",
  },
  {
    id: "vault-phone-cleaning-block", name: "Vault · Phone capture: a pasted cleaning checklist", flowId: "log-phone", entry: "phone-capture",
    input: { kind: "question", text: "To do in bathroom; organize mirror cabinet Clean sink and surfaces Protect prints and art with framing" },
    expect: "Three bathroom jobs on the Cleaning list under Bathroom, split by capital letter. Not one long item.",
  },
  {
    id: "vault-phone-heroes", name: "Vault · Phone capture: a name for a list of people I admire", flowId: "log-phone", entry: "phone-capture",
    input: { kind: "question", text: "Robert Anton Wilson" },
    expect: "A name alone: already on Heroes. Don't make a person card or a task. Say it is there.",
  },
  {
    id: "vault-phone-french-word", name: "Vault · Phone capture: a French word", flowId: "log-phone", entry: "phone-capture",
    input: { kind: "question", text: "rencontre" },
    expect: "A word from the 1000 common French words list: don't treat as an item or a task. If it's on the list, say so.",
  },
  {
    id: "vault-phone-gift", name: "Vault · Phone capture: a gift for a person", flowId: "log-phone", entry: "phone-capture",
    input: { kind: "question", text: "Shelby birthday gift necklace" },
    expect: "An item on the Gifts list tied to Shelby, with the occasion. Not a shopping item without the person.",
  },
  {
    id: "vault-phone-time-grid-note-zoo", name: "Vault · Time-grid note: a walk with a place", flowId: "log-grid", entry: "time-grid",
    input: { kind: "paste", text: "13:30 walking around at zoo !" },
    expect: "Place: the zoo. Mood: delight. No block, no intake. 'At zoo' also matches a place the vault knows.",
  },
  {
    id: "vault-grid-neighborhood", name: "Vault · Time-grid note: a route", flowId: "log-grid", entry: "time-grid",
    input: { kind: "paste", text: "13:00 walking around the neighborhood, to the cliffs" },
    expect: "Place: the cliffs. Where it went, not who with. Nothing else.",
  },
  {
    id: "vault-grid-spent", name: "Vault · Time-grid note: Spent pen with a store name", flowId: "log-grid", entry: "time-grid",
    input: { kind: "paste", text: "00:00 Ralphs" },
    expect: "The entry is on the Spent pen: Ralphs is the store, not a person or an item. No amount: leave it open.",
  },
]
