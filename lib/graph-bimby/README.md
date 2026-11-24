# `lib/graph-bimby/`: the Graph BIMBY

_Last mapped: 2026-11-24_

The **Graph BIMBY** handles one job: you click something on BIM's **GRAPH** tab and tell BIM about it in plain words. It turns what you say into **proposed** changes to that item and the items around it. **Nothing is saved until you Accept.**

## How you use it

1. On GRAPH, click a node. The inspector now has **Tell BIM about this ↵** below **Ask BIM about this ↵**. It works on any item: a person, a project, a plain item, a place.
2. The compose well gets `Tell BIM about Linda Gibbins Croft: ` and CHAT opens. Type what you know and send. The node's id is kept (`target.ts`), so two items with the same name are never mixed up.
3. BIM answers with a plan card (the same card, store and accept queue as the Dump, Social and Report BIMBIES, `components/Bim/report-card.tsx`).
4. Back on GRAPH, every change still waiting shows as a **dashed node** on a dashed edge from the center, labeled with what it would add ("proposed: lives in"). Click one to see why, then **Accept ✓** or **reject** there. An accepted change becomes the real node it wrote.

**Groups.** Shift-click (or Cmd-click) items to pick several. A strip shows "GROUP · N picked" and a **Tell BIM about these ↵** key. The lead joins the names with ` + `. A group card puts the note on every item. It also reads the shared plans, considerations and facts ("they are …"), and proposes a **list** that holds them all.

**Days.** On a date node (a deadline, a scheduled day, a day you saw someone), **Tell BIM about this day ↵** writes `day log for 2026-11-20: `. The Day Log BIMBY keeps the words in that day's log, word for word, and rebuilds it (`lib/day-log-bimby/`).

## What it reads

The example "Linda Gibbins Croft is my boyfriend Elijah Gibbins Croft's biological mother. She is a former social worker and currently a remote therapist. She lives at 245463463 wallaby way. etc etc" gives:

| Card | Kind | Accept writes |
|------|------|---------------|
| NOTE | `item-note` | The whole message on Linda's Notes log (`noteLog`), dated now. Always proposed, so nothing you said is lost |
| RELATION | `kin` | A `mother-of` link from Linda to Elijah (`lib/person-relations.ts` seeds). It shows on both graphs and Links tabs. The other person is made in People I Know when new. An existing link is not proposed again |
| TO YOU | `relation` | Relation field "boyfriend's biological mother" when it is blank. With a seed picked, a link to the self person too |
| FACT | `fact` | "Linda is a former social worker and currently a remote therapist" as a new line in the person's **Notes** attribute (standing notes on the person page). On a non-person item it goes in `notes` |
| PLACE | `place` | A **Location** item (`lib/location-types.ts`, kind Home, the Address attribute) found by address or made, linked `lives-in` from Linda, and `personProfile.address`. A replaced address goes on the Notes log |

Other reads:

| Said | Kind | Accept writes |
|------|------|---------------|
| "Saw her at Thanksgiving and she made me mad" | `seen` (SEEN) | A `personProfile.interactions` row with `saw: true` on that day, with the sentence, so Last seen moves. Holidays (Thanksgiving, Christmas, Easter …) and every `findDay` phrase are read. Past tense takes the last one |
| "She wants me to send my Christmas list ASAP" | `todo` (TO DO) | "Send my christmas list to Linda" on today's To Do (this week with no hurry said), linked `about` Linda. When an open task is already about it ("Send Linda Christmas list"), the change is an `amend` of that task instead (the Dump BIMBY's writer) |
| On a project: "Next step is to book the venue" | `step` (PART) | A child item of the project, in its lists. Today's To Do when ASAP |
| "Thinking about moving it to spring", "not sure whether …" | `consider` (CONSIDER) | A dated "Considering: …" row on the Notes log |
| "Her birthday is March 3" | `birthday` | The Social BIMBY's writer: set when blank, never overwritten |
| "Her number is …", "ig @…", an email | `contact` (CONTACT) | Phones (and the Phone Number attribute), Instagram (`addInstagramToPerson`), `personProfile.emails` |
| A group | `group` (GROUP) | A new list (or the one with that name) holding every item |

A sentence the rules cannot read is kept in the note only. The card's trace lists those sentences.

## LLM on

The rules read first. With LLM on, the sentences the rules left go to one schema-bound call on the crew's `extract` ladder (`llm.ts`). Each read must quote words from that sentence, or it is dropped. A relation needs a word `relationWord` knows and a person named in the sentence. Groups skip the model. With no model, the card holds the rules' reads.

## Flow

- **Lane** `graph-tell` in `CHAT_LANES` (`lib/ingest/bim-lanes.ts`), second, right after `handoff`. The explicit lead names its item, so no shape lane (dump, social, fact) should take the words first. Body in `lib/ingest/bim-chat.ts`.
- A lead whose name matches no item gets "I can't find “X” in Brain2" and nothing is filed.
- Graph: `lib/memory-graph/build.ts` now draws a person's address (`place` node, unless a linked Location already says it) and the days you saw them (date nodes). It shows the address, last seen, a Location's address and the standing notes in the inspector. Date nodes carry `day`. Location items are `place` nodes.

## Files

| File | Role |
|------|------|
| `parse.ts` | Pure. `parseTellLead` (one name or `A + B`), `tellLead`, `sentences`, `dayIn` (holidays + `findDay`), `readAbout` |
| `plan.ts` | Pure. `buildGraphPlan`: the card from the reads and a snapshot (people, open tasks, the subject's address, relation and links) |
| `ghosts.ts` | Pure. `withProposals` (waiting changes as `proposal` nodes on the center), `waitingFor` |
| `llm.ts` | `readsFromModel` (pure check against the sentences), `readWithModel` |
| `apply.ts` | One writer per kind, by item id, one undo step each. `lib/report-bimby/apply.ts` sends the eleven kinds here |
| `target.ts` | `useGraphTellTarget`: the ids the GRAPH key named |
| `run.ts` | `tryGraphTell`: lead → items → card → `useReportStore` |
| `graph-bimby.test.ts` | The Linda example, Thanksgiving, contact, project parts, considerations, groups, ghosts, the model check |

## Limits and Planned

- Rules read one subject per sentence. "She and Elijah went …" is a note, not a link between them.
- Two items with the same title (for example "Linda" and "Linda Gibbins Croft" as two people) stay two. **Planned:** a "same person?" merge proposal.
- **Planned:** proposed nodes drawn on the far item for a relation (today they hang off the center), a day subject that reads into Tracking as well as the Day Log, telling about a list node, and a phone GRAPH.

Test: `npx vitest run lib/graph-bimby`
