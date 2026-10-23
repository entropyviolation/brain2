# Meta → Research report

_Last mapped: 2026-10-23_

`components/Analytics/ResearchReportView.tsx` gathers rows. `research-report.ts` decides which sections earn a place (floors at the top of that file). No model.

## Information
Habit days, met days and streak, week grade raw vs curved, tracking coverage, sleep nights, one wellbeing move, planned vs tracked minutes, text-pipeline stamps, gratitude lines, why and blocked-reason counts. Each section has a sentence, an n, and optional bars or a trace.

## Layout
1. Header with **Copy rundown** (plain text, unchanged).
2. Lede.
3. **Contents** (new): one chip per section; click to open and scroll to it. A filter box narrows sections by title or sentence. **Open all** / **Fold all**.
4. Each section is now a fold (open by default) with its title and n on the summary line.
5. **Why these and not others**: "Included because" and "Left out because", folded by default with counts on the summary.

## Planned
- IIB **Good-viz test** tags per section (information, story, goal, form).
- **Your-number input**: type a target (for example sleep hours) and the sentences answer against it.
