/**
 * lib/bim-flow/run-flow.ts — Walk one flow over a batch of messages
 *
 * Per message: start at the `message` node, follow every edge breadth-first.
 * A `gate` follows only `yes` or `no`. A node runs once per message even when
 * two paths reach it. After the batch, every `blocks` signal goes through
 * `assembleBlocks`, so spans are decided by code. Nothing here writes the vault.
 */

import { assembleBlocks, type BlockRules } from "./blocks"
import type { ModelCall } from "./ollama"
import { searchVault, type VaultSnapshot } from "./vault-search"
import type {
  ActivitySignal,
  ExtractField,
  Flow,
  FlowMessage,
  FlowNode,
  FlowPort,
  FlowRun,
  MessageRun,
  Proposal,
  SearchOutput,
  TraceStep,
} from "./types"

const GATE_SYSTEM =
  "Answer one yes/no question about one short message a person sent to their notes app. " +
  "The earlier messages are context only. Be strict: when unsure, answer no. JSON only."
const CHOOSE_SYSTEM =
  "Pick from the given options only. Pick none when nothing clearly fits. The earlier messages are context only. JSON only."
const EXTRACT_SYSTEM =
  "Pull the asked fields out of one short message a person sent to their notes app. " +
  "Use only what the message says. Leave a field empty, 0, or false when it is not there. JSON only."

function clockOf(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** The message with its time and the few before it, the way every node shows it. */
export function messageBlock(m: FlowMessage): string {
  const prior = m.prior.map((p) => `(earlier ${clockOf(p.at)}) ${p.text}`).join("\n")
  return `${prior ? `${prior}\n\n` : ""}MESSAGE sent ${new Date(m.at).toDateString()} ${clockOf(m.at)}: ${m.text}`
}

function fieldSchema(f: ExtractField): Record<string, unknown> {
  const desc = f.hint ? { description: f.hint } : {}
  if (f.type === "number") return { type: "number", ...desc }
  if (f.type === "boolean") return { type: "boolean", ...desc }
  if (f.type === "enum") return { type: "string", enum: [...(f.options ?? []), ""], ...desc }
  if (f.type === "clock") return { type: "string", maxLength: 8, description: `${f.hint ?? ""} H:MM as written, or empty`.trim() }
  return { type: "string", maxLength: 120, ...desc }
}

export function extractSchema(fields: ExtractField[]): Record<string, unknown> {
  return {
    type: "object",
    properties: Object.fromEntries(fields.map((f) => [f.name, fieldSchema(f)])),
    required: fields.map((f) => f.name),
  }
}

function fieldLines(fields: ExtractField[]): string {
  return fields
    .map((f) => `- ${f.name}${f.type === "enum" ? ` (one of: ${(f.options ?? []).join(", ")})` : ""}${f.hint ? `: ${f.hint}` : ""}`)
    .join("\n")
}

interface Ctx {
  message: FlowMessage
  outputs: Map<string, unknown>
  /** Outputs of this node's own path back to the message, newest first. */
  path: unknown[]
  proposals: Proposal[]
  signals: ActivitySignal[]
}

async function runNode(node: FlowNode, ctx: Ctx, call: ModelCall, snap: VaultSnapshot): Promise<Omit<TraceStep, "nodeId" | "ms">> {
  const c = node.config
  const msg = messageBlock(ctx.message)

  if (node.kind === "message") return { port: "out", output: { text: ctx.message.text, at: ctx.message.at } }

  if (node.kind === "gate") {
    const shots = (c.examples ?? []).slice(-12).map((e) => `- "${e.text}" → ${e.answer}`).join("\n")
    const prompt = `Question: ${c.question ?? ""}${shots ? `\nTaught answers:\n${shots}` : ""}\n\n${msg}`
    const out = (await call({
      system: GATE_SYSTEM,
      user: prompt,
      schema: { type: "object", properties: { answer: { type: "string", enum: ["yes", "no"] } }, required: ["answer"] },
      maxTokens: 20,
    })) as { answer?: string }
    return { port: out.answer === "yes" ? "yes" : "no", output: out.answer ?? "no", prompt }
  }

  if (node.kind === "search") {
    const out = searchVault(snap, ctx.message.text, {
      source: c.source ?? "items",
      limit: c.limit,
      all: c.all,
      scopeId: c.scopeId,
    })
    return { port: "out", output: out }
  }

  if (node.kind === "choose") {
    const from = ctx.outputs.get(c.fromNodeId ?? "") as SearchOutput | undefined
    const options = from?.options ?? []
    if (options.length === 0) return { port: "out", output: { picks: [], note: "no options" } }
    const evidence = (from?.hits ?? [])
      .slice(0, 12)
      .map((h) => `- ${h.title}${h.lists?.length ? ` (on: ${h.lists.join(", ")})` : ""}`)
      .join("\n")
    const prompt =
      `${c.question ?? "Which fit?"}\nOptions: ${options.join(" | ")}` +
      `${evidence && from?.hits[0]?.source === "items" ? `\nRelated items already in the vault:\n${evidence}` : ""}\n\n${msg}`
    const out = (await call({
      system: CHOOSE_SYSTEM,
      user: prompt,
      schema: {
        type: "object",
        properties: {
          picks: { type: "array", maxItems: c.max ?? 1, uniqueItems: true, items: { type: "string", enum: options } },
        },
        required: ["picks"],
      },
      maxTokens: 120,
    })) as { picks?: string[] }
    return { port: "out", output: { picks: out.picks ?? [] }, prompt }
  }

  if (node.kind === "extract") {
    const fields = c.fields ?? []
    const prompt = `${c.question ?? "Fill these fields."}\nFields:\n${fieldLines(fields)}\n\n${msg}`
    const out = await call({ system: EXTRACT_SYSTEM, user: prompt, schema: extractSchema(fields), maxTokens: 250 })
    return { port: "out", output: out, prompt }
  }

  if (node.kind === "blocks") {
    const input = latestObject(ctx, ["relation"])
    const activity = String(input?.activity ?? latestPick(ctx) ?? "")
    const relation = String(input?.relation ?? "")
    if (!activity || !["starting", "doing_now", "finished", "did_earlier"].includes(relation)) {
      return { port: "out", output: { signal: null, note: "no activity or relation" } }
    }
    const signal: ActivitySignal = {
      messageId: ctx.message.id,
      at: ctx.message.at,
      activity,
      relation: relation as ActivitySignal["relation"],
      since: input?.since ? String(input.since) : undefined,
      minutesLeft: Number(input?.minutes_left) || undefined,
    }
    ctx.signals.push(signal)
    return { port: "out", output: signal }
  }

  // propose: gather the nearest picks and fields into one would-be write.
  const picks = latestPick(ctx, true) as string[] | undefined
  const fields = latestObject(ctx, [])
  const action = c.action ?? "idea"
  const what = picks?.length ? picks.join(", ") : ""
  const summary =
    action === "add-to-list"
      ? `Add "${ctx.message.text}" to ${what || "Inbox"}`
      : action === "habit-done"
        ? what ? `Mark ${what} done` : "No habit picked"
        : action === "person-mention"
          ? what ? `Mention of ${what}` : "Unknown person"
          : `${action}: ${fields ? Object.values(fields).filter(Boolean).join(" · ") : ctx.message.text}`
  const proposal: Proposal = { messageId: ctx.message.id, nodeId: node.id, action, summary, data: { picks, fields } }
  ctx.proposals.push(proposal)
  return { port: "out", output: proposal }
}

/** The nearest extract output on this path that has every key. */
function latestObject(ctx: Ctx, keys: string[]): Record<string, unknown> | undefined {
  for (const o of ctx.path) {
    if (o && typeof o === "object" && !Array.isArray(o) && !("picks" in o) && !("hits" in o) && !("text" in o) && !("messageId" in o)) {
      const rec = o as Record<string, unknown>
      if (keys.every((k) => k in rec)) return rec
    }
  }
  return undefined
}

function latestPick(ctx: Ctx, all = false): string | string[] | undefined {
  for (const o of ctx.path) {
    if (o && typeof o === "object" && "picks" in o) {
      const picks = (o as { picks: string[] }).picks
      return all ? picks : picks[0]
    }
  }
  return undefined
}

export async function runMessage(
  flow: Flow,
  message: FlowMessage,
  call: ModelCall,
  snap: VaultSnapshot,
  onStep?: (step: TraceStep) => void,
): Promise<MessageRun> {
  const ctx: Ctx = { message, outputs: new Map(), path: [], proposals: [], signals: [] }
  const parent = new Map<string, string>()
  const steps: TraceStep[] = []
  const byId = new Map(flow.nodes.map((n) => [n.id, n]))
  const start = flow.nodes.find((n) => n.kind === "message")
  const queue: string[] = start ? [start.id] : []
  const seen = new Set<string>()
  while (queue.length > 0) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const node = byId.get(id)
    if (!node) continue
    const path: unknown[] = []
    for (let p = parent.get(id); p; p = parent.get(p)) path.push(ctx.outputs.get(p))
    ctx.path = path
    const t0 = Date.now()
    let step: TraceStep
    try {
      step = { nodeId: id, ms: 0, ...(await runNode(node, ctx, call, snap)) }
    } catch (err) {
      step = { nodeId: id, ms: 0, port: "no", output: null, error: err instanceof Error ? err.message : String(err) }
    }
    step.ms = Date.now() - t0
    ctx.outputs.set(id, step.output)
    steps.push(step)
    onStep?.(step)
    if (step.error) continue
    const port: FlowPort = node.kind === "gate" ? step.port : "out"
    for (const e of flow.edges) {
      if (e.from !== id || e.port !== port) continue
      if (!parent.has(e.to)) parent.set(e.to, id)
      queue.push(e.to)
    }
  }
  return { message, steps, proposals: ctx.proposals, signals: ctx.signals }
}

export async function runFlow(
  flow: Flow,
  messages: FlowMessage[],
  call: ModelCall,
  snap: VaultSnapshot,
  opts: { model: string; rules?: BlockRules; onMessage?: (run: MessageRun, index: number) => void; onStep?: (index: number, step: TraceStep) => void } = { model: "" },
): Promise<FlowRun> {
  const t0 = Date.now()
  const runs: MessageRun[] = []
  for (const [i, m] of messages.entries()) {
    const run = await runMessage(flow, m, call, snap, (s) => opts.onStep?.(i, s))
    runs.push(run)
    opts.onMessage?.(run, i)
  }
  return {
    model: opts.model,
    startedAt: new Date(t0).toISOString(),
    ms: Date.now() - t0,
    messages: runs,
    blocks: assembleBlocks(runs.flatMap((r) => r.signals), opts.rules),
  }
}
