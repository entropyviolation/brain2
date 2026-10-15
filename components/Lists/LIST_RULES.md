# List rules — lists that fill themselves

List Settings → **Rules** → **Auto-add**. A list can carry rules
(`List.membershipRules`). When an item matches any enabled rule, it joins the
list. The engine is `lib/list-membership-rules.ts`; the editor is
`dialogs/list-properties/MembershipRulesEditor.tsx`.

Examples a person could build by hand:

- **Books**: *Item type is Book* — every Book in the vault joins.
- **Due within a week**: *Due date in the next 7 days* and *is not done*, with
  **Remove when it stops matching** on — items come and go with the date.
- **Gift ideas for Elijah**: *on Gift ideas* and *tag elijah*.
- **Unscheduled reading**: *on Books* and *Scheduled date is empty*.

## A rule

One or more conditions, joined by **all** or **any**. A list's rules are
joined by *any*: matching one rule is enough. A rule with no conditions
matches nothing, so an empty rule can never pull the whole vault in. A rule
can be switched off without deleting it.

| Condition | Reads |
|-----------|-------|
| Item type | `Task.type` is one of the chosen types |
| On other lists | on any / all / none of the chosen lists |
| Date within | Due date, Scheduled date, Created, Completed, or a datetime attribute — in the next N days (optionally also overdue) or the past N days, counted from today |
| Attribute | is / is not / contains / more than / less than / is set / is empty |
| Tag | has any / all / none of the tags (case-insensitive) |
| Done | is done / is not done |

The Rules tab shows a live preview: how many items match now, how many are
already on the list, how many will join on **Save Changes**, and how many stay
off because you took them off.

## How membership is written

Exactly like connected lists ([`LIST_LINKS.md`](LIST_LINKS.md)): the rule
writes the list id onto `Task.lists`, so every view, count, sort, export, and
habit already sees it. The task store applies rules:

- when an item is created or updated (after the link step, so a manual
  removal is already recorded),
- when a list's rules are saved (`updateList` re-runs them over the vault),
- on a clock — after hydrate, every hour, and when the window comes back —
  because date rules move with today (`hooks/use-list-membership-rules-tick.ts`,
  store action `applyListMembershipRules`).

A list a rule adds is then expanded through connected lists like any join.

## What a rule never does

- **Never re-adds an item you took off.** Removing an item records the list in
  `Task.listMembershipExclusions` (the same exclusion connected lists use).
  Adding it back by hand clears the exclusion.
- **Never removes an item you added.** With **Remove when it stops matching**
  on, only items a rule added (`Task.listRuleAddedIds`) leave when they stop
  matching. Off (the default), an item that joined stays.
- Never runs on folder All Items or the Next Actions smart lists.

## Automation rules (unchanged)

The same tab also holds the older attribute **Rules** (`ListRulesEditor`,
`List.rules`): automation that runs when an attribute changes (for example
"when Purchased, set Owned"). They moved from the Items tab; their data and
behavior did not change.
