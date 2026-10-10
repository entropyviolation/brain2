# Analytics vision

This folder is a product design for the analytics tab Brain2’s stored records can support. It is synthesized from Tracking, Habits, Plan, Now, and Telegram. It ignores the current analytics UI on purpose: nothing here audits or describes the Analytics tab that already ships.

| File | What it covers |
| --- | --- |
| [`01-tracking.md`](01-tracking.md) | Minute intervals, pens, tags, day summary, cycle marks, sleep, counts |
| [`02-habits.md`](02-habits.md) | Habit cells, the app’s own grades, sources, priority, willpower |
| [`03-plan.md`](03-plan.md) | Events, planned actions, period prose, and the task’s schedule |
| [`04-now.md`](04-now.md) | The header Now door, reconstructed from what its writers leave behind |
| [`05-telegram.md`](05-telegram.md) | The phone door (BIM): the rolling conversation and the stamps that survive it |
| [`06-language.md`](06-language.md) | **Intention, unbuilt.** Read the sentences already stored — task why, why an action was not taken, gratitude, day / week / month / season plan text, optional habit prioritize-why prose, and the other prose fields — with classical counts and, beside them, sentiment, machine learning, language models, and vector embeddings. A word cloud is one picture among others. |
| [`ANALYTICS_VISION.md`](ANALYTICS_VISION.md) | One tab: each section’s implementation, then the joins across them |

Plan writings are **prospective**; Tracking paint, task actuals, and day-summary prose are **retrospective** ([`TEMPORAL_POLARITY.md`](../TEMPORAL_POLARITY.md)).

The section reports stay the detailed source. The combined report points at them and does not replace them. A chart belongs in the combined tab only when these files say the fields exist, or when the join is marked partial because one side is missing. Language readings in [`06-language.md`](06-language.md) are an intention over prose that is already stored, including optional habit prioritize-why. A reading is not itself a stored field. The why is stored. The natural-language processing, machine-learning, and knowledge-graph reading of it is unbuilt.

How that tab gets built without dropping a working view is [`docs/analytics-plan/`](../analytics-plan/README.md). Those briefs cite this folder. They do not replace it.
