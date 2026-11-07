/**
 * lib/agents/info.ts — Say "info" to any BIMBY and it tells you what it is
 *
 * Pure and read-only. `infoText` turns a Blueprint into a short manual: the job, what to say, what it
 * can do, what it writes, and what it will not do. The facts come from the Blueprint, so they cannot drift
 * from the agent; only the "say things like" lines are written by hand, in `INFO_EXAMPLES`.
 * A BIMBY's chat calls `isInfoRequest` first and, on a hit, answers with `infoText` and runs nothing else.
 * To teach a new BIMBY the word, add its id to `INFO_EXAMPLES` and call the two functions in its chat.
 */

import type { Blueprint, NamedPipeline, PipelineStage } from "./blueprint"

/** The command is `/info`. A bare "info" (any case) is kept as an alias; a line that only contains the word is not a request.
 * Matches "/info", "info", "bimby info" or "info?" (nothing else on the line). */
const INFO_LINE = /^\s*\/?(?:(?:bimby|helper)\s+)?(?:info|information)\s*[?!.]*\s*$/i

export function isInfoRequest(text: string): boolean {
  return INFO_LINE.test(text)
}

/** Lines to try, written by hand because no Blueprint says how a person talks. Keyed by Blueprint id. */
export const INFO_EXAMPLES: Record<string, string[]> = {
  "tracking-helper": [
    "“I woke up at 8, worked at the library until noon, then walked home”",
    "“make that 20 minutes” (changes the blocks it just proposed)",
    "“always track my time on Speed Read as Reading” (becomes a checked plan card)",
  ],
  "habit-helper": [
    "“took 2 adderall and ran 3 miles”",
    "“what's left today?”",
    "“I skipped the gym because I was tired”",
  ],
  "lists-helper": [
    "“find duplicate items”",
    "“help” (lists every tool it has)",
    "“undo” (puts back the last change)",
  ],
  "overcome-bimby": ["“I can't make myself start the taxes” (said to BIM chat; it picks this up)"],
  "plan-bimby": ["Describe your day; it makes a plan you can edit before it runs"],
  "link-bimby": ["Save a link in the Inbox; it guesses what it is and where it goes"],
  "inbox-bimby": ["Open an Inbox item and ask for help; it suggests a list or a match"],
  "critic-bimby": ["Finish a plan; it gives a second look against your own words"],
}

const PROPOSAL_NAME: Record<string, string> = {
  "time-block": "timeblocks",
  "habit-cell": "habit cells",
  "miss-reason": "reasons for a miss",
  "shorthand-name": "shorthand names",
}

const noun = (p: string) => PROPOSAL_NAME[p] ?? p

function stageLine(s: PipelineStage): string {
  const cost = s.cost === "code" ? "code" : s.cost === "local-model" ? "local model" : "hosted"
  return `${s.label} (${cost}): ${s.does}`
}

function builtPipelines(b: Blueprint): NamedPipeline[] {
  return b.mind.kind === "pipeline" ? (b.mind.pipelines ?? []).filter((p) => p.status === "built") : []
}

function plannedPipelines(b: Blueprint): NamedPipeline[] {
  return b.mind.kind === "pipeline" ? (b.mind.pipelines ?? []).filter((p) => p.status === "planned") : []
}

/** The manual for one agent, as plain text a chat can show. */
export function infoText(b: Blueprint, opts: { href?: string } = {}): string {
  const out: string[] = [`${b.name}`, b.purpose]

  const tries = INFO_EXAMPLES[b.id]
  if (tries?.length) out.push("", "Try saying:", ...tries.map((t) => `• ${t}`))

  const built = builtPipelines(b)
  if (built.length) out.push("", "What it can do:", ...built.map((p) => `• ${p.name.replace(/ pipeline$/i, "")}: ${p.does}`))
  else if (b.mind.kind === "pipeline" && b.mind.stages.length) out.push("", "How it works:", ...b.mind.stages.map((s) => `• ${stageLine(s)}`))

  const planned = plannedPipelines(b)
  if (planned.length) out.push("", "Not built yet:", ...planned.map((p) => `• ${p.name.replace(/ pipeline$/i, "")}`))

  if (b.skills.length) out.push("", `Skills it ships with: ${b.skills.map((s) => s.name).join(", ")}.`)

  const proposes = b.door.proposes
  out.push(
    "",
    proposes.length
      ? `It writes nothing itself. It proposes ${proposes.map(noun).join(", ")}, and only your accept writes them.`
      : "It writes nothing. It only reads and answers.",
  )
  const wrote = b.tools.filter((t) => t.writes)
  if (wrote.length) out.push(`Tools that can change data: ${wrote.map((t) => t.name).join(", ")} (each shows a plan first).`)
  if (b.models.localOnly) out.push("Everything stays on this machine.")
  if (opts.href) out.push(`Lab page: ${opts.href}`)
  out.push("", "Type /info any time to see this again.")
  return out.join("\n")
}
