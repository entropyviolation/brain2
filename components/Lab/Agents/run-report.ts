/**
 * components/Lab/Agents/run-report.ts — A "Try it" run as plain text for a coding agent
 *
 * Pure. Labeled sections, one per stage in order: the agent, the input, the summary, each stage with its
 * prompt and output, then the result. Meant to be pasted into a chat to discuss or adjust the agent.
 */

export interface ReportStage {
  stage: string
  note?: string
  ms?: number
  prompt?: string
  output?: unknown
}

export interface RunReport {
  agent: string
  /** Where the agent's code lives, so the reader knows what to change. */
  where?: string
  input: string
  /** The one-line summary the lab shows (route, counts, time, model). */
  summary: string
  stages: ReportStage[]
  /** Result lines, e.g. the blocks or proposals. */
  result: string[]
}

const fence = (body: string) => "```\n" + body + "\n```"

export function formatRunReport(r: RunReport): string {
  const out: string[] = [`# Agent run report: ${r.agent}`]
  if (r.where) out.push(`Code: ${r.where}`)
  out.push("", "## Input", fence(r.input), "", "## Summary", r.summary, "")
  r.stages.forEach((s, i) => {
    out.push(`## Step ${i + 1} of ${r.stages.length}: ${s.stage}${s.ms != null ? ` (${s.ms} ms)` : ""}`)
    if (s.note) out.push(`Note: ${s.note}`)
    if (s.prompt) out.push("Prompt the model saw:", fence(s.prompt))
    out.push("Output:", fence(JSON.stringify(s.output, null, 2) ?? "undefined"), "")
  })
  out.push("## Result", ...(r.result.length ? r.result.map((l) => `- ${l}`) : ["- (nothing)"]))
  return out.join("\n")
}
