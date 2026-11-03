/**
 * components/BabyGame/designpanel.tsx — Character design: every look, large, with notes for a redesign
 *
 * Opens from the Friends tab of the Journal. Left: the Center of The World and every friend. Right: the chosen
 * character's front, side and back views at a large scale, a status (fine as is, needs redesign, redesigned) and a note.
 * Notes are saved as you type (`lib/baby-game/design-notes.ts`). A dev tool today; later the same panel is where a
 * generated character is reviewed and sent back for another try.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { RESIDENTS } from "@/lib/baby-game/cast"
import { DESIGN_STATUS_LABEL, designBrief, loadDesignNotes, redoBriefs, redoCount, saveDesignNotes, withNote, type DesignNotes, type DesignStatus } from "@/lib/baby-game/design-notes"
import { paintGrid, playerGrid, spriteGrid, SPRITE_SIZE, type SpriteView } from "@/lib/baby-game/sprites"

const PLAYER = "player"
const VIEWS: SpriteView[] = ["front", "side", "back"]
const STATUSES: DesignStatus[] = ["keep", "redo", "done"]

const NAMES: Record<string, string> = { [PLAYER]: "The Center of The World", ...Object.fromEntries(RESIDENTS.map((r) => [r.id, r.name])) }
const IDS = [PLAYER, ...RESIDENTS.map((r) => r.id)]

function gridOf(id: string, view: SpriteView): string[] {
  return id === PLAYER ? playerGrid(view) : spriteGrid(id, view)
}

function ViewCanvas({ id, view, scale }: { id: string; view: SpriteView; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext("2d")
    if (!ref.current || !ctx) return
    ctx.clearRect(0, 0, ref.current.width, ref.current.height)
    paintGrid(ctx, gridOf(id, view), 0, 0, scale)
  }, [id, view, scale])
  return <canvas ref={ref} width={SPRITE_SIZE * scale} height={SPRITE_SIZE * scale} role="img" aria-label={`${NAMES[id] ?? id}, ${view} view`} className="bg-pixel" />
}

export function DesignPanel({ initial, onBack }: { initial?: string; onBack: () => void }) {
  const [notes, setNotes] = useState<DesignNotes>({})
  const [loaded, setLoaded] = useState(false)
  const [id, setId] = useState(initial && IDS.includes(initial) ? initial : PLAYER)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setNotes(loadDesignNotes())
    setLoaded(true)
  }, [])

  const change = (patch: { text?: string; status?: DesignStatus }) => {
    setNotes((old) => {
      const next = withNote(old, id, patch)
      saveDesignNotes(next)
      return next
    })
  }

  const note = notes[id]
  const redos = useMemo(() => redoCount(notes), [notes])
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked: the text is still in the box to copy by hand
    }
  }

  return (
    <div className="bg-design">
      <ul className="bg-design-list" aria-label="Characters">
        {IDS.map((x) => (
          <li key={x}>
            <button type="button" className={`bg-design-pick${x === id ? " is-on" : ""}`} data-no95="" onClick={() => setId(x)} aria-pressed={x === id}>
              <span>{NAMES[x]}</span>
              {notes[x]?.status === "redo" ? <i className="bg-design-dot is-redo" title={DESIGN_STATUS_LABEL.redo} /> : notes[x]?.status === "done" ? <i className="bg-design-dot is-done" title={DESIGN_STATUS_LABEL.done} /> : null}
            </button>
          </li>
        ))}
      </ul>
      <div className="bg-design-main">
        <h4>{NAMES[id]}</h4>
        <div className="bg-design-views">
          {VIEWS.map((v) => (
            <figure key={v}>
              <ViewCanvas id={id} view={v} scale={6} />
              <figcaption>{v}</figcaption>
            </figure>
          ))}
        </div>
        <div className="bg-design-status" role="group" aria-label="Design status">
          {STATUSES.map((s) => (
            <button key={s} type="button" className={`friend-key bg-key${(note?.status ?? "keep") === s ? " is-on" : ""}`} data-no95="" onClick={() => change({ status: s })} aria-pressed={(note?.status ?? "keep") === s}>
              {DESIGN_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <label className="bg-design-note">
          <span>Notes for the redesign</span>
          <textarea
            value={note?.text ?? ""}
            disabled={!loaded}
            rows={4}
            placeholder="Rounder tail, bigger eyes, keep the white paws…"
            onChange={(e) => change({ text: e.target.value })}
          />
        </label>
        <div className="bg-keys">
          <button type="button" className="friend-key bg-key" data-no95="" onClick={() => void copy(designBrief(id, NAMES[id] ?? id, note))}>
            {copied ? "Copied" : "Copy this brief"}
          </button>
          <button type="button" className="friend-key bg-key" data-no95="" disabled={!redos} onClick={() => void copy(redoBriefs(notes, NAMES))}>
            Copy all redo briefs ({redos})
          </button>
          <a className="friend-key bg-key" data-no95="" href="/lab/baby-gens" target="_blank" rel="noreferrer" title="ComfyUI outputs with their recipes, likes and notes">
            Generation log
          </a>
          <button type="button" className="friend-key bg-key" data-no95="" onClick={onBack}>
            Back to friends
          </button>
        </div>
        <small className="bg-faint">Saved in this browser, apart from the village save.</small>
      </div>
    </div>
  )
}
