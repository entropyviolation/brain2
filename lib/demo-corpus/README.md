# Demo corpus

Invented vault layered onto the stock Demo profile (`lib/demo-vault.ts`). Nothing here is copied from a live vault. The persona stays River Hale at the Cedar Stacks library: kiln, letterpress, a ferry, a short hop.

`enrichDemoSeed` keeps the base rows and adds:

- Nested lists and folders, linked lists, operations with part formulas, flights with a layover, books, films, places, furniture, shopping, resources, notes, sources, and beliefs. Links use relations such as `supported-by`, `has-phase`, `adapted-from`, and `needed-for`.
- Tracking pens nested under Work and Home, variants, a standing pen link, midnight spans, instants, splits, secondary pens, screen-time stamps, and a call/text ping.
- A plan log, an agenda block, and a calendar event for every day of the current week, plus week, month, and quarter logs.
- Habit cells that mix tracked minutes, typed values, incremental scores, and text.

`coverCurrentWeek` is the safety net. If a day of the current Monday–Sunday week still has no plan, no tracked block, or (for today and earlier) no completion, it inserts one or two stable fictional rows for that empty channel.
