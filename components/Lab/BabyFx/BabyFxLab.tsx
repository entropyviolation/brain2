"use client"

/**
 * BabyFxLab — plays one pixel effect draft at a time on a loop.
 * See `components/Lab/BabyFx/README.md` and `docs/BABY_GAME_REDESIGN.md`.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { EFFECTS, FX_H, FX_W } from "@/components/BabyGame/fx"

const SPEEDS = [1, 0.5, 0.25]

export function BabyFxLab() {
  const [fxId, setFxId] = useState(EFFECTS[0].id)
  const [draft, setDraft] = useState("A")
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)
  const [recording, setRecording] = useState(false)
  const [reduced, setReduced] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const clock = useRef({ t: 0, last: 0 })

  const fx = EFFECTS.find((e) => e.id === fxId) ?? EFFECTS[0]
  const letters = Object.keys(fx.drafts)
  const current = fx.drafts[draft] ?? fx.drafts[letters[0]]

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  useEffect(() => {
    const c = canvasRef.current
    const ctx = c?.getContext("2d")
    if (!c || !ctx) return
    ctx.imageSmoothingEnabled = false
    let raf = 0
    clock.current.last = performance.now()
    const tick = (now: number) => {
      const dt = (now - clock.current.last) / 1000
      clock.current.last = now
      if (!paused && !reduced) clock.current.t = (clock.current.t + dt * speed) % fx.loop
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, FX_W, FX_H)
      current.draw(ctx, clock.current.t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [current, fx.loop, paused, reduced, speed])

  const pick = useCallback((id: string) => {
    setFxId(id)
    setDraft("A")
    clock.current.t = 0
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase()
      if (letters.includes(k)) setDraft(k)
      else if (e.key === " ") {
        e.preventDefault()
        setPaused((p) => !p)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [letters])

  /** Record exactly one loop at the chosen speed as a WebM and download it. */
  const record = () => {
    const c = canvasRef.current
    if (!c || recording || typeof MediaRecorder === "undefined") return
    const rec = new MediaRecorder(c.captureStream(60), { mimeType: "video/webm" })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = () => {
      const a = document.createElement("a")
      a.href = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }))
      a.download = `baby-fx-${fx.id}-${draft}.webm`
      a.click()
      URL.revokeObjectURL(a.href)
      setRecording(false)
    }
    clock.current.t = 0
    setRecording(true)
    rec.start()
    window.setTimeout(() => rec.stop(), (fx.loop / speed) * 1000)
  }

  const btn = (on: boolean) =>
    `rounded border px-3 py-1 text-sm ${on ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900" : "border-neutral-300 dark:border-neutral-600"}`

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-semibold">Baby game effects lab</h1>
      <div className="flex flex-wrap gap-2">
        {EFFECTS.map((e) => (
          <button key={e.id} type="button" className={btn(e.id === fx.id)} onClick={() => pick(e.id)}>
            {e.label}
          </button>
        ))}
      </div>
      <div
        className="inline-block border border-neutral-400"
        style={{ width: FX_W * 3, maxWidth: "100%", aspectRatio: `${FX_W} / ${FX_H}` }}
      >
        <canvas
          ref={canvasRef}
          width={FX_W}
          height={FX_H}
          style={{ width: "100%", height: "100%", imageRendering: "pixelated", display: "block" }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {letters.map((l) => (
          <button key={l} type="button" className={btn(l === draft)} onClick={() => setDraft(l)}>
            {l}
          </button>
        ))}
        <span className="mx-2 text-neutral-400">|</span>
        {SPEEDS.map((s) => (
          <button key={s} type="button" className={btn(s === speed)} onClick={() => setSpeed(s)}>
            {s}×
          </button>
        ))}
        <button type="button" className={btn(paused)} onClick={() => setPaused((p) => !p)}>
          {paused ? "Play" : "Pause"}
        </button>
        <button type="button" className={btn(recording)} onClick={record} disabled={recording}>
          {recording ? "Recording…" : "Record loop"}
        </button>
      </div>
      <p className="text-sm">
        <b>{draft}</b>: {current.note}
      </p>
      <p className="text-sm text-neutral-500">
        For: {fx.use} Loop {fx.loop}s. Keys A to {letters[letters.length - 1]} pick a draft, Space pauses.
        {reduced ? " Reduced motion is on, so playback is held on frame 0." : ""}
      </p>
    </div>
  )
}
