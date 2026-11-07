/**
 * components/Lab/IdeaSwarm/ClusterMap.tsx — Every reader's idea as a point, grouped; plus the card each cluster became
 *
 * The map is a 2D flattening (PCA) of the embeddings, so distance means similarity. Dots are ideas (hollow = lone,
 * dashed = its quote is not in the passage), a ring marks the medoid (the nearest real answer to the centre), a cross
 * the centre itself, a diamond the card the strong model wrote for the cluster, a star a hidden gem. Hover for text.
 * The list beside it says, for each cluster, how close the written card sits to the centre compared with the medoid.
 */
"use client"

import { useState } from "react"
import type { Item, Run } from "@/lib/idea-swarm/types"

export const PALETTE = ["#2f5fd0", "#1b9aaa", "#7a4fd0", "#d0457a", "#2e9b5b", "#d9742b", "#5b6b7f", "#a23fb5", "#3a86c8", "#8a5a44"]
const colour = (c: number) => (c < 0 ? "#7d8796" : PALETTE[c % PALETTE.length]!)

const W = 640, H = 440, PAD = 34
const sx = (x: number) => PAD + ((x + 1) / 2) * (W - PAD * 2)
const sy = (y: number) => PAD + ((1 - y) / 2) * (H - PAD * 2)

function star(cx: number, cy: number, r: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`
  }).join(" ")
}

export function ClusterMap({ run }: { run: Run }) {
  const [hover, setHover] = useState<string | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const ideas = new Map<string, Item>((run.stages.agents?.items ?? []).map((i) => [i.id, i]))
  const cards = new Map<string, Item>([...(run.clusters.flatMap((c) => (c.synth ? [[`card.${c.id}`, c.synth.item] as const] : []))), ...((run.stages.lone?.items ?? []).map((g) => [g.id, g] as const))])
  const medoids = new Set(run.clusters.map((c) => c.medoid))
  const lone = new Set(run.clusters.filter((c) => c.lone).flatMap((c) => c.members))
  const point = (id: string) => run.points.find((p) => p.id === id)
  const hoverItem = hover ? ideas.get(hover) ?? cards.get(hover) : undefined
  const hoverPoint = hover ? point(hover) : undefined
  if (!run.points.length) return <p className="is-empty">No map for this run: it needs at least one reader to have answered and the embedding model to be installed.</p>
  const real = run.clusters.filter((c) => !c.lone)
  return (
    <div className="is-map-wrap">
      <figure className="is-fig">
        <svg viewBox={`0 0 ${W} ${H}`} className="is-map" role="img" aria-label="Map of ideas by similarity">
          {[-0.5, 0, 0.5].map((v) => (
            <g key={v}><line x1={sx(v)} x2={sx(v)} y1={PAD} y2={H - PAD} className="is-rule" /><line y1={sy(v)} y2={sy(v)} x1={PAD} x2={W - PAD} className="is-rule" /></g>
          ))}
          <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} className="is-frame" />
          {real.map((c) => {
            const centre = point(`centre.${c.id}`)
            if (!centre) return null
            const members = c.members.map(point).filter(Boolean)
            const r = Math.max(14, ...members.map((m) => Math.hypot(sx(m!.x) - sx(centre.x), sy(m!.y) - sy(centre.y)))) + 10
            return <circle key={c.id} cx={sx(centre.x)} cy={sy(centre.y)} r={r} fill={colour(c.id)} className={`is-hull${pick === c.id ? " is-hot" : ""}`} />
          })}
          {real.flatMap((c) => {
            const centre = point(`centre.${c.id}`)
            return centre ? c.members.map((m) => { const p = point(m); return p ? <line key={m} x1={sx(centre.x)} y1={sy(centre.y)} x2={sx(p.x)} y2={sy(p.y)} stroke={colour(c.id)} className="is-spoke" /> : null }) : []
          })}
          {run.points.map((p) => {
            const x = sx(p.x), y = sy(p.y), col = colour(p.cluster)
            const on = hover === p.id || (pick !== null && p.cluster === pick)
            if (p.kind === "idea") {
              const it = ideas.get(p.id)
              const isLone = lone.has(p.id)
              return (
                <g key={p.id} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}>
                  {medoids.has(p.id) && !isLone ? <circle cx={x} cy={y} r="9" fill="none" stroke={col} strokeWidth="1.5" /> : null}
                  <circle cx={x} cy={y} r={on ? 6 : 4.5} fill={isLone ? "var(--is-paper)" : col} stroke={col} strokeWidth="1.6" strokeDasharray={it?.grounded === false ? "2 2" : undefined} />
                </g>
              )
            }
            if (p.kind === "centre") return <g key={p.id} stroke={col} strokeWidth="1.6"><line x1={x - 6} x2={x + 6} y1={y} y2={y} /><line y1={y - 6} y2={y + 6} x1={x} x2={x} /></g>
            if (p.kind === "synth") return <rect key={p.id} x={x - 7} y={y - 7} width="14" height="14" fill={col} stroke="var(--is-ink)" strokeWidth="1.2" transform={`rotate(45 ${x} ${y})`} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} />
            return <polygon key={p.id} points={star(x, y, 10)} fill={col} stroke="var(--is-ink)" strokeWidth="1" onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} />
          })}
          {hoverItem && hoverPoint ? (
            <g transform={`translate(${Math.min(W - 250, Math.max(8, sx(hoverPoint.x) + 12))} ${Math.max(8, sy(hoverPoint.y) - 52)})`} className="is-tip">
              <foreignObject width="240" height="110"><div className="is-tip-body">{hoverItem.text}</div></foreignObject>
            </g>
          ) : null}
        </svg>
        <figcaption>FIG. 1 · ideas by similarity. ○ idea · ◌ lone · ⊙ medoid · + centre · ◆ written card · ★ hidden gem · dashed = quote not found</figcaption>
      </figure>
      <div className="is-clusters">
        {real.map((c) => {
          const m = ideas.get(c.medoid)
          return (
            <article key={c.id} className={`is-cluster${pick === c.id ? " is-on" : ""}`} onClick={() => setPick(pick === c.id ? null : c.id)} style={{ borderLeftColor: colour(c.id) }}>
              <header><b>Cluster {c.id + 1}</b><span>{c.members.length} readers · {c.lenses.length} lens{c.lenses.length === 1 ? "" : "es"}</span></header>
              {c.synth ? (
                <>
                  <p className="is-card"><b>{c.synth.item.name}</b> {c.synth.item.gist}</p>
                  <div className="is-fid" title="Cosine of the written card to the cluster centre, against the nearest real member">
                    <span>card→centre {c.synth.fidelity.toFixed(3)}</span><i style={{ width: `${Math.max(0, c.synth.fidelity) * 100}%` }} />
                    <span>medoid→centre {c.synth.medoidFidelity.toFixed(3)}</span><i className="is-alt" style={{ width: `${Math.max(0, c.synth.medoidFidelity) * 100}%` }} />
                  </div>
                </>
              ) : null}
              <p className="is-medoid"><em>nearest real answer:</em> {m?.text}</p>
              {pick === c.id ? <ul className="is-members">{c.members.map((id) => <li key={id}><span className="is-chip">{ideas.get(id)?.lens}</span> {ideas.get(id)?.text}</li>)}</ul> : null}
            </article>
          )
        })}
        {run.clusters.some((c) => c.lone) ? (
          <article className="is-cluster is-lone">
            <header><b>Lone ideas</b><span>{run.clusters.filter((c) => c.lone).length} matched nobody</span></header>
            <ul className="is-members">{run.clusters.filter((c) => c.lone).map((c) => { const it = ideas.get(c.members[0]!)!; return <li key={it.id}><span className="is-chip">{it.lens}</span> {it.grounded ? "✓ " : "✗ "}{it.text}</li> })}</ul>
          </article>
        ) : null}
      </div>
    </div>
  )
}
