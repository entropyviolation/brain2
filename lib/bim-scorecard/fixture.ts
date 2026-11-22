/**
 * lib/bim-scorecard/fixture.ts — A small paraphrased sample of the person's real lines, for CI
 *
 * The real labelled lines stay in `data/bim-log-export/real-lines.labelled.jsonl` (gitignored). These 40 keep the
 * shape of real ones (the lanes, the short fast wording, two things in one line) with every name, place and private
 * detail changed. Labels follow the same rules as the real set (`docs/BIM_CHAT_USAGE.md` §8).
 */

import type { LabelledLine } from "./score"

const at = (i: number) => new Date(Date.UTC(2026, 10, 10, 18, i)).toISOString()

const L = (expectedLane: string, text: string, expectedAction: string, labelConfidence = 0.9): LabelledLine => ({ text, ts: "", source: "fixture", expectedLane, expectedAction, labelConfidence })

export const FIXTURE_LINES: LabelledLine[] = [
  L("link", "https://www.instagram.com/reel/AbCdEf123/ lamp made of dials", "save link with note"),
  L("link", "https://example.com/articles/sleep-and-light", "save link"),
  L("track", "starting dishes", "Activity block: dishes, now"),
  L("track", "walking since 4:40", "Activity block: walking from 4:40"),
  L("track", "taking a shower rn", "Activity block: shower, now"),
  L("track", "home from walk", "end walking block"),
  L("track", "doing: computer work on the app", "Activity: computer work"),
  L("todo", "need to book the train tickets", "To Do: book the train tickets"),
  L("todo", "take out trash", "To Do: take out trash"),
  L("todo", "to do later call the bank to do later renew passport", "To Do x2"),
  L("todo", "To do: plant the basil", "To Do: plant the basil", 0.95),
  L("intake", "took another pill btw (2)", "intake: pill, second"),
  L("intake", "Intake: toast with butter and black coffee", "intake: toast, coffee", 0.95),
  L("intake", "2nd energy drink of the day", "intake: energy drink"),
  L("mood", "mood: tired", "mood: tired", 0.95),
  L("mood", "randomly nauseous and lightheaded", "symptom: nausea"),
  L("shopping", "g oat milk", "grocery: oat milk", 0.95),
  L("shopping", "grocery list: maple syrup", "grocery: maple syrup", 0.99),
  L("shopping", "need more phone chargers", "wants: phone chargers"),
  L("list", "Cleaning: kitchen: wipe the counters", "Cleaning list: kitchen", 0.95),
  L("list", "Lyric: the river keeps the shape of the moon", "Lyrics list", 0.9),
  L("meta", "Brain2: let estimated blocks overlap", "Brain2 list", 0.95),
  L("meta", "be able to tell bim i want to scroll less", "Brain2 idea"),
  L("log", "thinking about how quiet the street gets at night", "plain log", 0.8),
  L("log", "log: the new pen finally works", "plain log", 0.95),
  L("thought", "Thought process: maybe two hours of study then a walk, or the other way round", "thought process", 0.95),
  L("plan-day", "Plan for rn: make coffee, answer emails, then clean for 15 min", "plan now", 0.95),
  L("habit", "played guitar and exercised today and yesterday", "habits: instrument, exercise x2 days"),
  L("habit", "also just stretched.", "habit: stretch"),
  L("chat", "oh what's up", "greeting reply", 0.8),
  L("chat", "feeling kind of lonely tonight", "short warm reply", 0.7),
  L("ask", "what was yesterday like for me?", "recap yesterday", 0.95),
  L("ask", "how many days ago did my friend leave for the trip?", "count days", 0.9),
  L("texts", "what did my friend last say to me over text?", "texts answer", 0.95),
  L("web", "what is the water temperature at the beach right now?", "web answer", 0.95),
  L("tell", "The last time I saw my cousin was July 5th", "tell: last seen", 0.9),
  L("money", "spent 21.50 on drinks and gum", "spend $21.50", 0.9),
  L("command", "info", "info", 1),
  L("command", "status", "status", 1),
  L("dream", "woke from a dream about an old school hallway", "dream note", 0.9),
  // The person's flagged case (`docs/BIM_CHAT_USAGE.md` §5, failure 1), paraphrased: made-up names, no real places.
  {
    ...L(
      "social",
      "while in the city i hung out with Mira, Jo (super briefly), Teo, Sam, Pax, Rue, Lio, and Wren, and met new friends Kit (whose 21st birthday it was the night of the concert) and this guy Bram who is very kind and from the coast but only 20 and for some reason i had a weird feeling about him even though i liked him but he let me stay at his apartment in a room with huge windows.",
      "Each person found or proposed; Kit and Bram as new people (how met, when, how it felt); Kit's birthday from the concert night; a trip hang-out event with the dates from the flights; Bram's apartment as a place; questions back: which concert, who was there when, what you did",
      0.95,
    ),
    priority: true,
    expect: { social: { named: ["Mira", "Jo", "Teo", "Sam", "Pax", "Rue", "Lio", "Wren", "Kit", "Bram"], newPeople: ["Kit", "Bram"], birthdayOf: "Kit", event: true, place: "apartment", followUp: true } },
  },
].map((l, i) => ({ ...l, ts: at(i) }))
