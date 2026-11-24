/**
 * lib/graph-bimby/plan.ts — The card for what you told BIM about one item, or a group (pure)
 *
 * One proposed change per read, each with why, the sentence it rests on, and fields to edit. The words always
 * go on the item's Notes log word for word (one `item-note` per item in a group). Nothing is written here; the
 * writers are `apply.ts`, run on Accept. A plan said again that an open task is already about is an `amend`
 * of that task (the Dump BIMBY's writer), not a twin. A link that already exists is not proposed again.
 */

import { matchTask } from "@/lib/dump-bimby/match"
import { PERSON_RELATIONS } from "@/lib/person-relations"
import { fmtDateTime } from "@/lib/report-bimby/time"
import type { Effect, ReportPlan } from "@/lib/report-bimby/types"
import { readAbout, type GraphRead, type KnownPerson, type Subject } from "./parse"

export interface PlanData {
  subject: Subject
  /** Every item when the words were about a group (the subject is the first). */
  group?: Subject[]
  people: readonly KnownPerson[]
  /** Open tasks by name, for amending instead of adding a twin. */
  tasks: readonly { id: string; name: string }[]
  /** What the subject already holds, so a change says what it replaces or is skipped. */
  known: { address?: string; relation?: string; linkedIds: readonly string[] }
}

const PERSON_SEEDS = [...new Set(PERSON_RELATIONS.filter((r) => !r.toTypes || r.toTypes.includes("person")).map((r) => r.id))]
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name
const quoted = (s: string) => `“${s.length > 160 ? `${s.slice(0, 157)}…` : s}”`
const seedLabel = (id: string) => PERSON_RELATIONS.find((r) => r.id === id)?.label ?? id.replace(/-/g, " ")

export function buildGraphPlan(body: string, now: Date, data: PlanData, modelReads: readonly GraphRead[] = []): { plan: ReportPlan; reads: GraphRead[]; unread: string[] } {
  const id = `graph_${now.getTime().toString(36)}`
  const group = data.group && data.group.length > 1 ? data.group : null
  const subject = data.subject
  const ids = group ? group.map((g) => g.id) : [subject.id]
  const who = group ? group.map((g) => g.name).join(" + ") : subject.name
  // A group's pronouns could be anyone in it, so only the shared reads (plans, considerations, facts) are read.
  const reader: Subject = group ? { id: subject.id, name: who, person: false } : subject
  const rules = readAbout(body, reader, data.people, now)
  const reads = [...rules.reads, ...modelReads]
  const effects: Effect[] = []
  const push = (e: Omit<Effect, "id" | "status">) => effects.push({ ...e, id: `${id}-${effects.length}`, status: "pending" })
  const stamp = fmtDateTime(now.getTime(), true)

  for (const g of group ?? [subject])
    push({
      kind: "item-note",
      ref: g.id,
      about: [g.id],
      title: `Note on ${g.name}: what you said, word for word`,
      reasoning: ["Everything you told BIM is kept on the item's Notes log, dated now, so nothing said is lost even if you reject the rest."],
      evidence: [quoted(body)],
      fields: [
        { key: "text", label: "Note", type: "text", value: body },
        { key: "at", label: "When", type: "datetime", value: stamp },
      ],
    })

  const linked = new Set(data.known.linkedIds)
  let relationSet = !!data.known.relation
  for (const r of reads) {
    const evidence = [quoted(r.quote)]
    switch (r.kind) {
      case "kin": {
        if (r.otherId && linked.has(r.otherId)) break
        const role = `${r.qualifier ? `${r.qualifier} ` : ""}${r.role}`
        push({
          kind: "kin",
          ref: r.otherId,
          about: ids,
          title: `${subject.name} is the ${role} of ${r.otherName}`,
          reasoning: [
            `A link "${seedLabel(r.relation)}" from ${subject.name} to ${r.otherName}, so each shows on the other's graph and Links tab.`,
            r.otherId ? `${r.otherName} is already in People I Know.` : `${r.otherName} is not in People I Know yet: Accept makes them.`,
          ],
          evidence,
          fields: [
            { key: "other", label: "Linked to", type: "text", value: r.otherName },
            { key: "relation", label: "Relation", type: "select", value: r.relation, options: PERSON_SEEDS },
          ],
        })
        if (r.toMe && !relationSet) {
          relationSet = true
          push({
            kind: "relation",
            ref: subject.id,
            about: ids,
            title: `${first(subject.name)} to you: ${r.toMe}'s ${role}`,
            reasoning: [`Their Relation field is blank. You said ${r.otherName} is your ${r.toMe}.`],
            evidence,
            fields: [
              { key: "relation", label: "Relation", type: "text", value: `${r.toMe}'s ${role}` },
              { key: "link", label: "Link to you", type: "select", value: "none", options: ["none", ...PERSON_SEEDS] },
            ],
          })
        }
        break
      }
      case "relation": {
        if (relationSet) break
        relationSet = true
        push({
          kind: "relation",
          ref: subject.id,
          about: ids,
          title: `${first(subject.name)} to you: ${r.word}`,
          reasoning: [data.known.relation ? `Replaces "${data.known.relation}".` : "Their Relation field is blank.", r.relation ? `Also links them to you as "${seedLabel(r.relation)}".` : "No standard link for this word; the field keeps it as said."],
          evidence,
          fields: [
            { key: "relation", label: "Relation", type: "text", value: r.word },
            { key: "link", label: "Link to you", type: "select", value: r.relation ?? "none", options: ["none", ...PERSON_SEEDS] },
          ],
        })
        break
      }
      case "fact":
        push({
          kind: "fact",
          ref: subject.id,
          about: ids,
          title: `Fact: ${r.text}`,
          reasoning: [subject.person && !group ? "A standing fact, kept in their Notes field on the person page (not the dated log)." : "A standing fact, added to the item's notes."],
          evidence,
          fields: [{ key: "text", label: "Fact", type: "text", value: r.text }],
        })
        break
      case "place":
        push({
          kind: "place",
          ref: subject.id,
          about: ids,
          title: `${first(subject.name)} lives at ${r.text}`,
          reasoning: [
            "A Location item (kind Home) with this address, linked “lives in” from the person, and the address on their page.",
            data.known.address && data.known.address.toLowerCase() !== r.text.toLowerCase() ? `Replaces "${data.known.address}"; the old one goes on their Notes log.` : "",
          ].filter(Boolean),
          evidence,
          fields: [
            { key: "address", label: "Address", type: "text", value: r.text },
            { key: "precision", label: "How exact", type: "select", value: r.precision, options: ["mailing", "neighborhood", "state", "country"] },
          ],
        })
        break
      case "seen":
        push({
          kind: "seen",
          ref: subject.id,
          about: ids,
          title: `Saw ${first(subject.name)} ${r.date}`,
          reasoning: [r.dateSaid ? "Kept as a day you saw them, so Last seen updates." : "No day said, so today. Edit the day if it was earlier."],
          evidence,
          fields: [
            { key: "date", label: "Day", type: "text", value: r.date },
            { key: "text", label: "What happened", type: "text", value: r.text },
          ],
        })
        break
      case "consider":
        push({
          kind: "consider",
          ref: subject.id,
          about: ids,
          title: `Considering: ${r.text.length > 70 ? `${r.text.slice(0, 67)}…` : r.text}`,
          reasoning: ["Weighed, not decided: kept as a dated “Considering” note so it can be asked about later."],
          evidence,
          fields: [{ key: "text", label: "Consideration", type: "text", value: r.text }],
        })
        break
      case "todo":
      case "step": {
        const match = matchTask(r.title, data.tasks.filter((t) => !ids.includes(t.id)))
        if (match) {
          push({
            kind: "amend",
            ref: match.id,
            about: ids,
            title: `${match.name}: said again${r.urgent ? ", ASAP" : ""}`,
            reasoning: [`You already have this open: “${match.name}”. Amending it instead of making a twin.`],
            evidence,
            fields: [
              { key: "urgency", label: "Priority (1–5)", type: "select", value: r.urgent ? "4" : "keep", options: ["keep", "3", "4", "5"] },
              { key: "today", label: "On today's to do", type: "select", value: r.urgent ? "yes" : "no", options: ["yes", "no"] },
              { key: "by", label: "Due by", type: "datetime", value: "" },
              { key: "note", label: "Note on the task", type: "text", value: `About ${who}: ${r.quote}` },
            ],
          })
          break
        }
        if (r.kind === "step")
          push({
            kind: "step",
            ref: subject.id,
            about: ids,
            title: `Part of ${subject.name}: ${r.title}`,
            reasoning: [`A plan for ${subject.name}, proposed as a part of it (a child item in its lists).`, r.urgent ? "Said as ASAP, so on today's To Do." : ""].filter(Boolean),
            evidence,
            fields: [
              { key: "title", label: "Part", type: "text", value: r.title },
              { key: "today", label: "On today's to do", type: "select", value: r.urgent ? "yes" : "no", options: ["yes", "no"] },
            ],
          })
        else
          push({
            kind: "todo",
            ref: subject.id,
            about: ids,
            title: `To Do: ${r.title}`,
            reasoning: [`A new To Do linked to ${who}, so it shows on the graph.`, r.urgent ? "Said as ASAP, so today." : "No day said, so this week."],
            evidence,
            fields: [
              { key: "title", label: "To Do", type: "text", value: r.title },
              { key: "when", label: "When", type: "select", value: r.urgent ? "today" : "this week", options: ["today", "this week"] },
            ],
          })
        break
      }
      case "birthday":
        push({
          kind: "birthday",
          about: ids,
          title: `${first(subject.name)}'s birthday: ${r.date}`,
          reasoning: ["Set on the person's Birthday field when it is blank. A different birthday already there is not overwritten."],
          evidence,
          fields: [
            { key: "person", label: "Person", type: "text", value: subject.name },
            { key: "date", label: "Birthday", type: "text", value: r.date },
          ],
        })
        break
      case "contact":
        push({
          kind: "contact",
          ref: subject.id,
          about: ids,
          title: `Contact for ${first(subject.name)}: ${[...r.phones, ...r.handles.map((h) => `@${h}`), ...r.emails].join(", ")}`,
          reasoning: ["Added to their person page. Nothing they already have is removed."],
          evidence,
          fields: [
            { key: "phone", label: "Phone", type: "text", value: r.phones.join(", ") },
            { key: "instagram", label: "Instagram", type: "text", value: r.handles.join(", ") },
            { key: "email", label: "Email", type: "text", value: r.emails.join(", ") },
          ],
        })
        break
    }
  }

  if (group)
    push({
      kind: "group",
      about: ids,
      title: `Group: ${group.length} items in one list`,
      reasoning: ["You told BIM about these together. A list keeps them together on the Lists page and as one node on the graph. Reject it to keep only the notes."],
      evidence: group.map((g) => g.name),
      fields: [{ key: "name", label: "List name", type: "text", value: who.length > 60 ? `${who.slice(0, 57)}…` : who }],
    })

  const trace = [
    `Read ${rules.sentences.length} sentence${rules.sentences.length === 1 ? "" : "s"} about ${who}: ${reads.length} read${reads.length === 1 ? "" : "s"}${modelReads.length ? ` (${modelReads.length} by the model)` : ""}.`,
    rules.unread.length ? `Kept only in the note: ${rules.unread.map((s) => quoted(s)).join(" ")}` : "",
  ].filter(Boolean)
  return { plan: { id, text: body, at: now.toISOString(), trace, effects, about: subject.id, ...(group ? { aboutIds: ids } : {}) }, reads, unread: rules.unread }
}
