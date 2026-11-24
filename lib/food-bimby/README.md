# `lib/food-bimby/` — The Food BIMBY

_Last mapped: 2026-11-22_

A **BIMBY** (small, single-job sub-agent) for food said in plain sentences. It reads what was eaten, looks up nutrition for every part, and files each meal on the Food book with the numbers.

Why it exists: a long line in BIM chat ("everything I've eaten today, yesterday and the day before: soup which was 1 can of corn …, 2 apple redbulls and 2 mexican cokes … PLEASE LOG ALL THIS FOOD") came back as `Logged: <the whole line>`. The ladder filed it as one log note. Nothing was looked up, and nothing reached the Food book.

## What it does

1. **Notice** (`read.ts`, code). `looksLikeFoodLog` takes a line that asks for food tracking or nutrition ("log all this food", "calories", "macros"), or that names eating and two foods. "had a call with marilyn", "spent 12 on coffee" and "can you track calories?" are left alone.
2. **Read** (`read.ts`, local model). One call turns the line into meals. Each meal has a day offset (0 today, −1 yesterday, −2 the day before), a kind (meal, snack, drink), whether it is homemade, and its parts. Each part has grams and a nutrition guess for the amount eaten. Models think in servings, so the guess is a total, and `guessPer100` turns it into per 100 g. Calories the person stated win ("150 calorie ones"). The guess is seven numbers in a fixed order, not named keys: _2026-11-22_, a full day with named keys ran past the token cap ("gave cut-off JSON"). Food they plan to eat goes in `planned` and is not logged, and a plan that only repeats eaten food is dropped. Food eaten "with" a dish is a part of that dish.
   - **No model, or the model failed.** `readMealsInCode` reads only a short line: one sentence, 25 words at most, no plan words (`codeCanRead`). A longer line files nothing and gets a **try again** key. _2026-11-22:_ the cut-off answer fell back to the comma split, which filed three days of food as one plate on yesterday with the planned kewpie on it.
3. **Look up** (`research.ts`, code, then one short model call). For each part: saved foods and the catalog, then USDA FoodData Central, then Open Food Facts (`lib/kitchen-search.ts`). `candidates` keeps up to four records whose name holds at least half the search words (a single word of the person's own, like "cheese", is not enough), whose calories sit within about 2× of the guess, and whose cooked state agrees (uncooked rice is not priced as cooked). Then the model, as judge, picks one per part or none (`judgeWith` in `run.ts`). Why: word overlap alone let "Red Bull apple" match *Red Cabbage with Apple*, bacon match a vegan bacon, and broth match a ramen. With no judge, `pickHit` takes the best record naming most of the search words. With no pick, the guess is used and saved as a food marked "(estimate)". Network answers are kept for the session. At most three searches run at once.
4. **File** (`apply.ts`, code). One Intake instant per meal on its day (class food, `logSource` `bim`), with an accepted kitchen plate and its nutrient snapshot. Past days get an unknown clock, and today gets an estimated one. A homemade dish is first saved as a recipe card (the whole batch, the person's words as its note), and its plate is the servings eaten. Foods found by a lookup are saved, so the next "red bull" is found on this device.
5. **Say** (`run.ts`). Every entry by day, with kcal, protein, carbs, fat, sugar, fiber and sodium. Under each entry, every part shows its grams, its calories and where the number came from (saved food, catalog, USDA, Open Food Facts, estimate). A day with several entries gets a day total. Planned food is named, with a key ("ate rice with…") that files it once eaten. Chip: `FOOD · logged · model` (or `code`).

## Choices

- **Drinks with calories go on the Food book**, not the Drink shelf. The Food book is where plates are summed, and the request was "log all this food in food tracking". **Planned:** a drink plate on the Drink shelf once the Food book counts those.
- **Write, then undo.** The line asked for the log, so it is filed straight away rather than proposed as a card. "Undo that" (or the **undo** key) takes back the run's entries, plates and recipe cards for 30 minutes (`undoLastFood`). Saved foods stay. "No, yesterday" says how to move an entry instead of guessing.
- **Grams are estimates.** Each plate opens in Tracking → Food to change them.

## Lookups need a key

USDA's shared `DEMO_KEY` allows about 30 searches an hour per address, and a full day of food can use most of that. When it answers 429, Open Food Facts is tried, then the estimate. Set `NEXT_PUBLIC_USDA_FDC_API_KEY` in `.env.local` (a free key from api.data.gov) for steady USDA hits.

## Doors

- **BIM chat**, lane `food` (`lib/ingest/bim-lanes.ts`). It sits after `flight-ask` and before `self`, so "can you log what I ate: …" is filed rather than answered as a question about BIM. It also comes before `money`, `day` and `stream`, which would read a list of meals as a spend, a plan or a stream of thought.
- **`self`** answers "can you track food / calories?" from its `food` topic (`lib/ingest/bim-self.ts`).
- Blueprint `food-bimby` (`lib/agents/adapters/food-bimby.ts`). **Planned:** a meal photo pipeline, Telegram, and its own chat.

## Files

- `read.ts`: notice, the model prompt and schema, `readMealsReply`, `guessPer100`, `readMealsInCode`. Pure.
- `research.ts`: `nameFit`, `kcalFits`, `pickHit`, `estimateHit`, `researchPart`, `researchParts`.
- `apply.ts`: `fileMeals`, `undoLastFood`.
- `run.ts`: `tryFood`, `foodReplyText`.
- `food-bimby.test.ts`: the pasted day end to end with a fake model and a fake USDA, undo, LLM off, a failed model on a long line, the judge turning a record down, the seven-number guess, uncooked rice, a generic word, a plan that repeats eaten food, lines that are not food.
- `food-bimby.live.test.ts`: the same day against the real local model and the real USDA / Open Food Facts. Skipped unless `FOOD_LIVE=1`.

Test: `npx vitest run lib/food-bimby`
