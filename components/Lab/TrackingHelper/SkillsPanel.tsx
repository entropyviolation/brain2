/**
 * components/Lab/TrackingHelper/SkillsPanel.tsx — Review what the Tracking Helper has learned
 *
 * Shows success per category from the experience log, a "Find new skills" key (the evolve step: weak categories only,
 * a local model when one answers, plain lessons otherwise), and every skill with Accept / Edit / Retire. New skills
 * arrive `proposed` and reach no prompt until accepted. Per device (`skillbank:tracking-helper`, `skillexp:…`).
 * Research and rules: `docs/SKILLRL_RESEARCH.md`, `lib/skills/README.md`.
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { editSkill, loadBank, rate, saveBank, setStatus } from "@/lib/skills/bank"
import { evolve, statsByCategory, weakCategories, withProposals } from "@/lib/skills/evolve"
import { loadExperiences } from "@/lib/skills/experience"
import { TRACKING_HELPER_SKILLS } from "@/lib/skills/seeds"
import type { Experience, Skill, SkillBank } from "@/lib/skills/types"
import { HELPER_AGENT_ID } from "@/lib/tracking-helper/learn"
import "./helper-tests.css"
import "./skills-panel.css"

const ORDER: Record<Skill["status"], number> = { proposed: 0, active: 1, retired: 2 }

export function SkillsPanel() {
  const [bank, setBank] = useState<SkillBank>({ agentId: HELPER_AGENT_ID, skills: [] })
  const [exps, setExps] = useState<Experience[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ name: "", principle: "", whenToApply: "" })

  useEffect(() => {
    setBank(loadBank(HELPER_AGENT_ID, TRACKING_HELPER_SKILLS))
    setExps(loadExperiences(HELPER_AGENT_ID))
  }, [])

  const commit = useCallback((next: SkillBank) => {
    setBank(next)
    saveBank(next)
  }, [])

  const stats = statsByCategory(exps)
  const weak = new Set(weakCategories(exps).map((s) => s.category))

  const find = async () => {
    setBusy(true)
    setNote(null)
    try {
      const crew = await chatCrew().catch(() => null)
      const ladder = crew?.extract ?? []
      const r = await evolve({ experiences: exps, bank, call: crew ? ollamaCall(crew.main, undefined, { fresh: true }) : null, ladder })
      if (!r.weak.length) setNote("Nothing is weak enough yet. A category needs at least 3 cases and under 80% accepted as proposed.")
      else if (!r.proposals.length) setNote("No new skills: what the corrections taught is already in the bank, or none of them gave a better move.")
      else {
        commit(withProposals(bank, r.proposals))
        setNote(`${r.proposals.length} proposed from ${r.sampled.length} corrections in ${r.weak.map((w) => w.category).join(", ")}${r.model ? ` (written by ${r.model})` : r.fallback ? ` (plain lessons: ${r.fallback})` : ""}.`)
      }
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (s: Skill) => {
    setEditing(s.id)
    setDraft({ name: s.name, principle: s.principle, whenToApply: s.whenToApply })
  }

  const skills = [...bank.skills].sort((a, b) => ORDER[a.status] - ORDER[b.status] || Number(a.source === "hand") - Number(b.source === "hand"))

  return (
    <section className="tht ths" aria-label="Learned skills">
      <h2>Skills · what the Helper has learned</h2>
      <p>
        Every Add, edit, dismiss and correction in Tracking is logged. A skill is only a line in the model&apos;s prompt, never a write. New ones wait here until you accept them. The shipped skills restate the prompt and are not sent twice.
      </p>

      <h3>Accepted as proposed, by part</h3>
      {stats.length ? (
        <ul className="ths-stats">
          {stats.map((s) => (
            <li key={s.category} data-weak={weak.has(s.category) ? "1" : "0"}>
              <code>{s.category}</code>
              <span className="ths-bar" aria-hidden>
                <i style={{ width: `${Math.round(s.rate * 100)}%` }} />
              </span>
              <span>
                {Math.round(s.rate * 100)}% of {s.n}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No reactions logged yet. Use the Helper in Tracking, then add, edit or dismiss what it proposes.</p>
      )}

      <div className="tht-row">
        <button type="button" onClick={find} disabled={busy || !exps.length}>
          {busy ? "Reading corrections…" : "Find new skills"}
        </button>
        <span>{exps.length} reactions logged</span>
      </div>
      {note ? <p role="status">{note}</p> : null}

      <h3>Skills</h3>
      <ul className="tht-list">
        {skills.map((s) => (
          <li key={s.id} data-status={s.status}>
            {editing === s.id ? (
              <>
                <input aria-label="Skill name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                <textarea aria-label="Principle" rows={2} value={draft.principle} onChange={(e) => setDraft({ ...draft, principle: e.target.value })} />
                <input aria-label="When to apply" value={draft.whenToApply} onChange={(e) => setDraft({ ...draft, whenToApply: e.target.value })} />
                <div className="tht-row">
                  <button
                    type="button"
                    onClick={() => {
                      if (draft.name.trim() && draft.principle.trim() && draft.whenToApply.trim()) commit(editSkill(bank, s.id, { name: draft.name.trim(), principle: draft.principle.trim(), whenToApply: draft.whenToApply.trim() }))
                      setEditing(null)
                    }}
                  >
                    Save
                  </button>
                  <button type="button" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="tht-row">
                  <b>{s.name}</b>
                  <span className="ths-tag">{s.status === "active" && s.source === "hand" ? "shipped" : s.status}</span>
                  <code>{s.category}</code>
                </div>
                <p>{s.principle}</p>
                <p>
                  <i>When:</i> {s.whenToApply}
                </p>
                <div className="tht-row">
                  <span>
                    used {s.uses} · accepted {s.wins}
                    {s.uses ? ` (${Math.round(rate(s) * 100)}%)` : ""}
                  </span>
                  {s.status !== "active" ? <button type="button" onClick={() => commit(setStatus(bank, s.id, "active"))}>{s.status === "proposed" ? "Accept" : "Restore"}</button> : null}
                  <button type="button" onClick={() => startEdit(s)}>
                    Edit
                  </button>
                  {s.status !== "retired" ? <button type="button" onClick={() => commit(setStatus(bank, s.id, "retired"))}>{s.status === "proposed" ? "Reject" : "Retire"}</button> : null}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
