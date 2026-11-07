/**
 * lib/rules/rules-engine.ts — Fire an event at the rules; the trigger and sink registries
 *
 * `fireRuleEvent` is the one door. For each enabled rule whose trigger matches, it
 * shapes the delivery and hands it to the rule's sink, once per distinct event.
 * Loop guard: sinks only write notes and never raise events, and the page listener
 * ignores `.docs-editor`, so a delivery cannot trigger a rule.
 * Planned: rate cap per rule, a firing log, more trigger and sink kinds.
 */
import { entryHtml, isLongEnough, textHash } from "@/lib/text-mirror/text-mirror"
import { appendToDoc } from "./sink-doc-append"
import type { Rule, RuleEvent } from "./rule-types"
import { useRulesStore } from "./rules-store"

type Delivery = { html: string; hash: string }

/** Does this rule's trigger match the event, and what is delivered? */
const TRIGGERS: Record<Rule["trigger"]["kind"], (rule: Rule, event: RuleEvent) => Delivery | null> = {
  "typed-text": (rule, event) => {
    if (event.kind !== "typed-text" || rule.trigger.kind !== "typed-text") return null
    if (!isLongEnough(event.text, rule.trigger.overWords)) return null
    return { html: entryHtml(event.source, event.at, event.text), hash: textHash(`${event.source}\n${event.text.trim()}`) }
  },
}

/** Deliver to the sink; the sink may report a corrected target (a re-found note). */
const SINKS: Record<Rule["sink"]["kind"], (rule: Rule, delivery: Delivery) => Promise<boolean>> = {
  "doc-append": async (rule, delivery) => {
    if (rule.sink.kind !== "doc-append") return false
    const done = await appendToDoc(rule.sink, delivery.html)
    if (!done) return false
    if (done.docId !== rule.sink.docId) useRulesStore.getState().update(rule.id, { sink: done })
    return true
  },
}

/** True when some enabled rule listens for this kind of event (lets listeners stay idle). */
export function anyRuleListens(kind: RuleEvent["kind"]): boolean {
  return useRulesStore.getState().rules.some((r) => r.on && r.trigger.kind === kind)
}

export function fireRuleEvent(event: RuleEvent): void {
  const store = useRulesStore.getState()
  for (const rule of store.rules) {
    if (!rule.on) continue
    const delivery = TRIGGERS[rule.trigger.kind](rule, event)
    if (!delivery || rule.seen.includes(delivery.hash)) continue
    store.remember(rule.id, delivery.hash)
    void SINKS[rule.sink.kind](rule, delivery).then((ok) => {
      if (!ok) useRulesStore.getState().forget(rule.id, delivery.hash)
    })
  }
}
