# components/Lab/Geniuses — the geniuses lab

_Last mapped: 2026-11-24_

Route `/lab/geniuses` (`app/lab/geniuses/page.tsx`). Every model call a baby animal friend or a genius makes is here, with its exact prompt. Engine: `lib/geniuses/`. Writes only the geniuses store. Plain Tailwind, like the Overcome lab.

| File | What it draws |
|---|---|
| `GeniusesLab.tsx` | Header, the model bar, five tabs. |
| `lab-kit.tsx` | Model bar (installed models from Ollama, temperature, Fresh = skip the call cache, Script only), the live vault read, `PromptBox` (the filled system and user text, editable once before sending; "Rebuild" drops the edit), `SentMeta` (model or script and why, hops with timings, raw JSON). |
| `TalkTab.tsx` | Pick a genius and a task (its open steps, or any words), then argue. Six exchanges at most. Shows the cards a reply would offer; "Remember" keeps the model's note; "Remember what I typed" keeps yours; end buttons set the outcome. |
| `CouncilTab.tsx` | Name a time or a question, seat two or more active geniuses. Step 1: each asks. Step 2: each hears the others' asks and holds or gives way. Then you pick (with a reason) or keep the minutes undecided. Each genius's prompt is editable; "Ask this one again" reruns one. |
| `GeniusesTab.tsx` | Name, face, status (7 active at most), area, charter, bindings (lists, goals, objectives, habits, project root items) and the area read it will see. Add, remove, restore starters. |
| `PromptsTab.tsx` | The saved templates and their slots. Edits apply to every later call; Reset returns to the default. |
| `MemoryTab.tsx` | One genius's MEMORY block as its next prompt will carry it, its notes (add, forget), talks (open, delete) and councils (delete). |

Checked live on 2026-11-24 with `qwen2.5:14b-instruct`: a talk turn rescheduled to the time named and offered a note; a three-genius council asked, answered and yielded by name; the kept note showed up in the next council ask. A cold 14B load on a full Mac took over 120 s, so the first turn fell back to the script, as designed.
