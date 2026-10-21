# Agent notes for Brain2

## Keep the room docs current

Every room folder has a `README.md`, and `lib/README.md` covers `lib/`. Read those before mapping code yourself.

When you map a module in depth (by reading it or through a subagent), write back anything future agents would otherwise have to re-derive:

- Add findings that are missing from that folder's README, or that disagree with it. Fix the README where the code wins. Where the doc describes intent the code has not reached yet, label it **Planned**.
- Put `_Last mapped: YYYY-MM-DD_` at the top of each section you add or change.
- If changes are planned for the module, say so in its README and link the plan doc (for example `docs/TODO_REDESIGN.md`).
- Keep the house voice: short, plain sentences, file paths in backticks, and approximate line numbers (`~123`) only where they save a search.

Design language is in `docs/DESIGN_STYLE.md`. Redesign plans live in `docs/*_REDESIGN.md`.

Style slants (Hipgnosis, retrofuturism) live in `docs/mockups/slants/`. Use one only when asked for it by name. A slant never changes the house style.

## Do not merge the three task editors

Item detail → Subtasks, the To do drawer and the To do task card all edit one task on purpose. They have different jobs, so they keep different UI and components. Do not merge them or make one mirror another without allie's yes. Why: `components/Home/ToDo/README.md` → "Three ways to edit a task stay separate".
