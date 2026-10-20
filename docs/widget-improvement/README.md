# Widget improvement

Readings of the Visual dashboard widgets and the Module cards against the vault as it is.

## Kinds and installed copies

_Last mapped: 2026-10-20_

The Home widget row is now the **Visual dashboard** ([`WIDGETS_REDESIGN.md`](../WIDGETS_REDESIGN.md), built parts in [`components/Home/README.md`](../../components/Home/README.md#visual-dashboard)). Each page below is about one widget **kind**: the app, as the Widget gallery lists it. What sits on the dashboard is an **installed copy** of a kind, with its own settings behind a gear in its detail. A kind installs `once`, once per key (`perKey`: one Language study per language, one Weather per place), or `many` times (Countdown, Points).

Names changed with the redesign: **Countdown** was Days Until (id `daysuntil`), and **Language study** was Vocab (id `vocab`). Ids did not change. The readings below are from 9 Oct 2026, before copies existed, so they speak of one square per id.

These are research reports from the live Electron localStorage vault (origin `http://localhost:3000`, userData `~/Library/Application Support/cogs`) on 9 Oct 2026. Implementation plans are in [`plan/`](plan/). The Home and Modules catalogs record those readings. Hidden widgets stay hidden, the milled face stays, and overview type is not resized again there. Each problem below is the first item in that report’s “Biggest problems right now.”

## Visual dashboard kinds

| Kind | File | Biggest problem right now |
| --- | --- | --- |
| Rituals | [`home-widget-review.md`](home-widget-review.md) | The CRT number is a backlog, and the footer calls it today. |
| Points | [`home-widget-points.md`](home-widget-points.md) | The square adds unlike things into one integer-looking score, then annotates a different scale. |
| Latest award | [`home-widget-award.md`](home-widget-award.md) | Tonight it is a one-point inbox handle, while the same calendar day already paid +50 seven times and +50 again for beating last week’s habit grades. |
| Today's Progress | [`home-widget-progress.md`](home-widget-progress.md) | 21 left is three different states. |
| Affirmation | [`home-widget-affirmation.md`](home-widget-affirmation.md) | The line never reaches the strip. |
| Weather | [`home-widget-weather.md`](home-widget-weather.md) | The glance describes 3p after 3p is gone. |
| Screen pet | [`home-widget-pet.md`](home-widget-pet.md) | The square hides a 25% day inside a sleep face. |
| Next | [`home-widget-next.md`](home-widget-next.md) | The hit is an untimed inbox cue, and the calendar gap is silent. |
| Day lamp | [`home-widget-daylamp.md`](home-widget-daylamp.md) | The word is an unweighted mean of two percents, and tonight that mean is a bad picture of the day. |
| Countdown (was Days Until) | [`home-widget-countdown.md`](home-widget-countdown.md) | Built: one copy per mark, units, repeats, progress, milestones, what happens when it passes, and install setup. |
| Language study (was Vocab) | [`home-widget-language-study.md`](home-widget-language-study.md) | Built: one copy per language, studied or native, CEFR levels, and placement quizzes. More modes are still planned. |
| Moon | [`home-widget-moon.md`](home-widget-moon.md) | The tile says the new moon is both now and tomorrow. |
| Solar remainder | [`home-widget-solar.md`](home-widget-solar.md) | The number on the glass changes meaning at sunset. |
| Tracking now | [`home-widget-tracking.md`](home-widget-tracking.md) | The square says `last known` and never says when. |
| Night well | [`home-widget-night.md`](home-widget-night.md) | Tonight’s face is an empty night, and the last night is three mornings back. |
| Harvest leftover | [`home-widget-harvest.md`](home-widget-harvest.md) | The CRT is not points still available from habit scoring. |
| Inbox mill | [`home-widget-inbox.md`](home-widget-inbox.md) | The instrument is off while the pile is the problem. |
| Already flowing | [`home-widget-flow.md`](home-widget-flow.md) | Generated same-day Done rows are “new.” |
| Plan and lived | [`home-widget-paint.md`](home-widget-paint.md) | The word Close is a match between two piles that are not a plan and a day. |

## Module cards

| Widget | File | Biggest problem right now |
| --- | --- | --- |
| List Explorer | [`modules-widget-list-explorer.md`](modules-widget-list-explorer.md) | Five draws from 1024, each one a pile of unlabeled text. |
| Writing Generator | [`modules-widget-writing-prompt.md`](modules-widget-writing-prompt.md) | The card is not on the desk. |
| List Summary | [`modules-widget-list-summary.md`](modules-widget-list-summary.md) | The card is not on the desk. |
| Analytics Stat | [`modules-widget-analytics-stat.md`](modules-widget-analytics-stat.md) | The week that produced 3,472.45 is five unequal days, two still ahead, and 147 rows, and none of that is on the card. |
| Random Task | [`modules-widget-random-task.md`](modules-widget-random-task.md) | The title asks for now, and the draw is the whole open list. |
| Rules | [`modules-widget-rules.md`](modules-widget-rules.md) | The card is not in the vault. |
