# Demo corpus

Invented vault layered onto the stock Demo profile (`lib/demo-vault.ts`). Nothing here is copied from a live vault. The persona stays River Hale at the Cedar Stacks library: kiln, letterpress, a ferry, a short hop.

`enrichDemoSeed` keeps the base rows and adds:

- Tasks built as `type: "task"` carry the next-action field set (stage, reward, estimate, load, urgency, importance, context, entropy, partial completion, dependencies, lists, tags, links, subtasks). Plain `type: "item"` rows carry the list-item set, with reward 1, and skip the scheduling block unless that item is itself scheduled. The iron-black proof task keeps its own `proofSheets` attribute. Clay & ink order keeps `itemTypeId` `shopping`, a type the corpus already puts on its rows.
- Nested lists and folders, linked lists, operations with part formulas, flights with a layover, books, films, places, furniture, shopping, resources, notes, sources, and beliefs. Links use relations such as `supported-by`, `has-phase`, `adapted-from`, and `needed-for`.
- Tracking pens nested under Work and Home, variants, a standing pen link, midnight spans, instants, splits, secondary pens, screen-time stamps, and a call/text ping.
- A plan log, an agenda block, and a calendar event for every day of the current week, plus week, month, and quarter logs.
- Habit cells that mix tracked minutes, typed values, incremental scores, and text.

`coverCurrentWeek` is the safety net. If a day of the current Monday–Sunday week still has no plan, no tracked block, or (for today and earlier) no completion, it inserts one or two stable fictional rows for that empty channel.
