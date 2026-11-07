/**
 * SpeedReadView — rapid serial visual presentation for any PDF.
 *
 * Choose a PDF, pick a page from the rail, press space. One word (or a short
 * phrase) flashes at a fixed pivot column at the set speed. Everything here is
 * read in the browser. Every PDF opened here is also posted once to the
 * library on the Mac (`lib/speed-read-library.ts` → `scripts/speed-read-api.mjs`),
 * so the iPhone app lists and opens the same files. Reading settings persist in
 * localStorage.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BookOpen, Minus, Pause, Play, Plus, RefreshCw, RotateCcw, SkipBack, SkipForward, Upload, X } from "lucide-react"
import {
  chunkAt,
  chunkDelayMs,
  formatClock,
  joinPdfItems,
  RSVP_MAX_WPM,
  RSVP_MIN_WPM,
  secondsRemaining,
  splitPivot,
  tokenizeWords,
} from "@/lib/rsvp"
import { speedReadFaces, SPEED_READ_FONTS } from "@/lib/fonts/speed-read-faces"
import {
  fetchSpeedReadPdf,
  formatPdfSize,
  listSpeedReadLibrary,
  removeFromSpeedReadLibrary,
  uploadToSpeedReadLibrary,
  type SpeedReadEntry,
} from "@/lib/speed-read-library"
import "./speedread.css"

interface PdfPage {
  getTextContent: () => Promise<{ items: Array<{ str?: string; hasEOL?: boolean }> }>
  getViewport: (o: { scale: number }) => { width: number; height: number }
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => {
    promise: Promise<void>
    cancel: () => void
  }
}
interface PdfDoc {
  numPages: number
  getPage: (n: number) => Promise<PdfPage>
  getMetadata: () => Promise<unknown>
  destroy: () => Promise<void>
}

type Theme = "paper" | "night"

interface Settings {
  wpm: number
  fontId: string
  size: number
  chunk: number
  pauses: boolean
  carry: boolean
  theme: Theme
}

const DEFAULTS: Settings = { wpm: 350, fontId: "fraunces", size: 84, chunk: 1, pauses: true, carry: true, theme: "paper" }
const STORE_KEY = "brain2-speed-read"
const SPEED_STEPS = [200, 300, 450, 600, 800, 1000]

function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (!raw) return DEFAULTS
    const s = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
    s.wpm = Math.min(RSVP_MAX_WPM, Math.max(RSVP_MIN_WPM, Number(s.wpm) || DEFAULTS.wpm))
    s.chunk = Math.min(3, Math.max(1, Math.round(Number(s.chunk) || 1)))
    if (!SPEED_READ_FONTS.some((f) => f.id === s.fontId)) s.fontId = DEFAULTS.fontId
    return s
  } catch {
    return DEFAULTS
  }
}

/** pdf.js moves the buffer into its worker, so pass a copy when the bytes are needed again. */
async function openPdf(data: ArrayBuffer): Promise<PdfDoc> {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const task = pdfjs.getDocument({ data: new Uint8Array(data) })
  return (await task.promise) as unknown as PdfDoc
}

/** One page, drawn small. Renders when scrolled near, and stops if it leaves first. */
function Thumb({ doc, n }: { doc: PdfDoc; n: number }) {
  const host = useRef<HTMLSpanElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el || typeof IntersectionObserver === "undefined") {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          setSeen(true)
          io.disconnect()
        }
      },
      { rootMargin: "200px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!seen) return
    let cancelled = false
    let task: { promise: Promise<void>; cancel: () => void } | null = null
    void (async () => {
      try {
        const page = await doc.getPage(n)
        const base = page.getViewport({ scale: 1 })
        const scale = (96 * (window.devicePixelRatio || 1)) / base.width
        const vp = page.getViewport({ scale })
        const c = canvas.current
        const ctx = c?.getContext("2d")
        if (cancelled || !c || !ctx) return
        c.width = Math.floor(vp.width)
        c.height = Math.floor(vp.height)
        task = page.render({ canvasContext: ctx, viewport: vp })
        await task.promise
      } catch {
        /* a cancelled render is expected */
      }
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [seen, doc, n])

  return (
    <span ref={host} className="sr-thumb-paper">
      <canvas ref={canvas} />
    </span>
  )
}

export function SpeedReadView() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [hydrated, setHydrated] = useState(false)
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [words, setWords] = useState<string[]>([])
  const [wordsPage, setWordsPage] = useState(0)
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [dragging, setDragging] = useState(false)
  /** Pages read to their last word since this PDF was opened. */
  const [pagesRead, setPagesRead] = useState<number[]>([])
  const [library, setLibrary] = useState<SpeedReadEntry[]>([])
  const [libState, setLibState] = useState<"idle" | "loading" | "ok" | "error">("idle")
  const [libNote, setLibNote] = useState("")
  /** The library line for the open PDF: saving, saved, or why not. */
  const [saveNote, setSaveNote] = useState("")

  const textCache = useRef(new Map<number, string>())
  const rootRef = useRef<HTMLDivElement>(null)
  const pageBtns = useRef(new Map<number, HTMLButtonElement>())

  useEffect(() => {
    setSettings(loadSettings())
    setHydrated(true)
  }, [])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch }
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(next))
      } catch {
        /* storage can be blocked; the settings just do not persist */
      }
      return next
    })
  }, [])

  const font = SPEED_READ_FONTS.find((f) => f.id === settings.fontId) ?? SPEED_READ_FONTS[0]

  const refreshLibrary = useCallback(async () => {
    setLibState("loading")
    try {
      setLibrary(await listSpeedReadLibrary())
      setLibState("ok")
      setLibNote("")
    } catch (e) {
      setLibState("error")
      setLibNote(e instanceof Error ? e.message : "The Mac did not answer.")
    }
  }, [])

  useEffect(() => {
    if (hydrated) void refreshLibrary()
  }, [hydrated, refreshLibrary])

  const showDoc = useCallback((next: PdfDoc, name: string) => {
    setDoc((prev) => {
      void prev?.destroy().catch(() => undefined)
      return next
    })
    textCache.current = new Map()
    setPagesRead([])
    setFileName(name)
    setPage(1)
    setWords([])
    setWordsPage(0)
    setIdx(0)
  }, [])

  const loadFile = useCallback(
    async (file: File) => {
      setError("")
      setLoading(true)
      setPlaying(false)
      try {
        if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) throw new Error("That is not a PDF.")
        const data = await file.arrayBuffer()
        showDoc(await openPdf(data.slice(0)), file.name.replace(/\.pdf$/i, ""))
        setSaveNote("Saving to the library…")
        uploadToSpeedReadLibrary(file.name, data)
          .then(() => {
            setSaveNote("In the library. The iPhone app can open it.")
            void refreshLibrary()
          })
          .catch((e) => setSaveNote(`Not saved to the library: ${e instanceof Error ? e.message : "the Mac did not answer."}`))
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not open that PDF.")
      } finally {
        setLoading(false)
      }
    },
    [showDoc, refreshLibrary],
  )

  const openEntry = useCallback(
    async (entry: SpeedReadEntry) => {
      setError("")
      setLoading(true)
      setPlaying(false)
      try {
        showDoc(await openPdf(await fetchSpeedReadPdf(entry.id)), entry.name)
        setSaveNote("From the library.")
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not open that PDF.")
      } finally {
        setLoading(false)
      }
    },
    [showDoc],
  )

  const removeEntry = useCallback(
    async (entry: SpeedReadEntry) => {
      if (!window.confirm(`Remove “${entry.name}” from the library? This deletes the stored copy on the Mac.`)) return
      try {
        await removeFromSpeedReadLibrary(entry.id)
        setLibrary((l) => l.filter((x) => x.id !== entry.id))
      } catch (e) {
        setLibNote(e instanceof Error ? e.message : "Could not remove it.")
      }
    },
    [],
  )

  const closeDoc = useCallback(() => {
    setPlaying(false)
    setDoc((prev) => {
      void prev?.destroy().catch(() => undefined)
      return null
    })
    setSaveNote("")
    void refreshLibrary()
  }, [refreshLibrary])

  // Read the chosen page's text layer (cached).
  useEffect(() => {
    if (!doc) return
    let cancelled = false
    void (async () => {
      let text = textCache.current.get(page)
      if (text === undefined) {
        try {
          const content = await (await doc.getPage(page)).getTextContent()
          text = joinPdfItems(content.items.map((i) => ({ str: i.str ?? "", hasEOL: i.hasEOL })))
        } catch {
          text = ""
        }
        textCache.current.set(page, text)
      }
      if (cancelled) return
      setWords(tokenizeWords(text))
      setWordsPage(page)
      setIdx(0)
    })()
    return () => {
      cancelled = true
    }
  }, [doc, page])

  useEffect(() => {
    pageBtns.current.get(page)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })
  }, [page])

  const ready = !!doc && wordsPage === page
  const chunk = useMemo(
    () => (words.length ? chunkAt(words, Math.min(idx, words.length - 1), settings.chunk) : null),
    [words, idx, settings.chunk],
  )

  const goPage = useCallback(
    (n: number) => {
      if (!doc) return
      setPage(Math.min(doc.numPages, Math.max(1, Math.round(n) || 1)))
    },
    [doc],
  )

  // The metronome: one timeout per flash.
  useEffect(() => {
    if (!playing || !ready || !chunk) return
    const wait = chunkDelayMs(words, chunk, settings.wpm, settings.pauses)
    const t = window.setTimeout(() => {
      const next = chunk.start + chunk.count
      if (next < words.length) {
        setIdx(next)
      } else {
        setPagesRead((p) => (p.includes(page) ? p : [...p, page]))
        if (settings.carry && doc && page < doc.numPages) setPage(page + 1)
        else setPlaying(false)
      }
    }, wait)
    return () => window.clearTimeout(t)
  }, [playing, ready, chunk, words, settings.wpm, settings.pauses, settings.carry, doc, page])

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!words.length) return
      setIdx((i) => {
        if (dir === 1) return Math.min(words.length - 1, i + settings.chunk)
        return Math.max(0, i - settings.chunk)
      })
    },
    [words.length, settings.chunk],
  )

  const sentenceBack = useCallback(() => {
    setIdx((i) => {
      let j = Math.max(0, i - 1)
      while (j > 0 && !/[.!?…]["'”’)\]]*$/.test(words[j - 1])) j -= 1
      return j
    })
  }, [words])

  const toggle = useCallback(() => {
    if (!ready || !words.length) return
    setPlaying((p) => {
      if (!p && idx >= words.length - 1) setIdx(0)
      return !p
    })
  }, [ready, words.length, idx])

  const nudgeWpm = useCallback(
    (d: number) => update({ wpm: Math.min(RSVP_MAX_WPM, Math.max(RSVP_MIN_WPM, settings.wpm + d)) }),
    [settings.wpm, update],
  )

  const onKey = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement
    if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA") return
    if (e.key === " " && t.tagName !== "BUTTON") {
      e.preventDefault()
      toggle()
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      step(1)
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      e.shiftKey ? sentenceBack() : step(-1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      nudgeWpm(25)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      nudgeWpm(-25)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) void loadFile(f)
  }

  const shown = chunk ? splitPivot(chunk.text) : null
  const total = words.length
  const done = chunk ? Math.min(total, chunk.start + chunk.count) : 0
  const left = secondsRemaining(words, chunk?.start ?? 0, settings.wpm, settings.pauses)

  const context = useMemo(() => {
    if (!chunk) return null
    const from = Math.max(0, chunk.start - 14)
    const to = Math.min(words.length, chunk.start + chunk.count + 22)
    return { from, to }
  }, [chunk, words.length])

  const rootClass = `sr sr-${settings.theme} ${speedReadFaces}`
  const rootStyle = { "--sr-font": font.family, "--sr-size": `${settings.size}px` } as React.CSSProperties

  if (!hydrated) return <div className={rootClass} style={rootStyle} />

  if (!doc) {
    return (
      <div className={`${rootClass} sr-home`} style={rootStyle} onKeyDown={onKey}>
        <label
          className={`sr-drop${dragging ? " sr-drop-on" : ""}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="sr-file"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void loadFile(f)
              e.target.value = ""
            }}
          />
          <span className="sr-drop-mark" aria-hidden>
            <span className="sr-drop-l">spe</span>
            <span className="sr-drop-p">e</span>
            <span className="sr-drop-r">d</span>
          </span>
          <span className="sr-drop-title">{loading ? "Opening…" : "Drop a PDF to read"}</span>
          <span className="sr-drop-sub">
            Pick any page, then one word at a time at your speed. Each PDF is kept in the library on the Mac, so the iPhone app can open it too.
          </span>
          <span className="sr-btn sr-btn-primary">
            <Upload size={15} /> Choose PDF
          </span>
          {error && <span className="sr-error">{error}</span>}
        </label>
        <section className="sr-library" aria-label="Library">
          <div className="sr-library-head">
            <span className="sr-label">Library · {library.length}</span>
            <button data-no95 type="button" className="sr-btn sr-btn-small" onClick={() => void refreshLibrary()} aria-label="Reload library" disabled={libState === "loading"}>
              <RefreshCw size={14} />
            </button>
          </div>
          {libState === "error" && <p className="sr-error">{libNote}</p>}
          {libState === "ok" && library.length === 0 && <p className="sr-library-empty">No PDFs yet. Open one and it lands here.</p>}
          {libState === "loading" && library.length === 0 && <p className="sr-library-empty">Asking the Mac…</p>}
          <ul className="sr-library-list">
            {library.map((entry) => (
              <li key={entry.id} className="sr-library-row">
                <button data-no95 type="button" className="sr-library-open" onClick={() => void openEntry(entry)} disabled={loading}>
                  <BookOpen size={16} aria-hidden />
                  <span className="sr-library-name">{entry.name}</span>
                  <span className="sr-library-meta">
                    {formatPdfSize(entry.bytes)} · {new Date(entry.addedAt).toLocaleDateString()}
                  </span>
                </button>
                <button data-no95 type="button" className="sr-btn sr-btn-small" onClick={() => void removeEntry(entry)} aria-label={`Remove ${entry.name}`}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  return (
    <div className={rootClass} style={rootStyle} onKeyDown={onKey} tabIndex={-1} ref={rootRef}>
      <aside className="sr-rail" aria-label="Pages">
        <div className="sr-rail-head">
          <span className="sr-doc" title={fileName}>
            {fileName}
          </span>
          <button data-no95 type="button" className="sr-btn sr-btn-small" onClick={closeDoc} title="Back to the library">
            Library
          </button>
          <label className="sr-btn sr-btn-small">
            Change
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="sr-file"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void loadFile(f)
                e.target.value = ""
              }}
            />
          </label>
        </div>
        {saveNote && <p className="sr-savenote">{saveNote}</p>}
        <div className="sr-pagejump">
          <span>Page</span>
          <input
            type="number"
            min={1}
            max={doc.numPages}
            value={page}
            onChange={(e) => goPage(Number(e.target.value))}
            aria-label="Page number"
          />
          <span>of {doc.numPages}</span>
        </div>
        <div className="sr-thumbs">
          {Array.from({ length: doc.numPages }, (_, i) => i + 1).map((n) => (
            <button data-no95
              key={n}
              type="button"
              ref={(el) => {
                if (el) pageBtns.current.set(n, el)
                else pageBtns.current.delete(n)
              }}
              className={`sr-thumb${n === page ? " sr-thumb-on" : ""}`}
              onClick={() => {
                setPlaying(false)
                goPage(n)
              }}
              aria-label={`Page ${n}`}
              aria-current={n === page}
            >
              <Thumb doc={doc} n={n} />
              <span className="sr-thumb-n">{n}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="sr-main">
        <div className="sr-stage" onClick={toggle} role="button" tabIndex={0} aria-label={playing ? "Pause" : "Play"}>
          <span className="sr-reticle sr-reticle-top" aria-hidden />
          <span className="sr-reticle sr-reticle-bottom" aria-hidden />
          <div className="sr-word" aria-live="off">
            {!ready ? (
              <span className="sr-hint">Reading page {page}…</span>
            ) : shown ? (
              <>
                <span className="sr-b">{shown.before}</span>
                <span className="sr-p">{shown.pivot}</span>
                <span className="sr-a">{shown.after}</span>
              </>
            ) : (
              <span className="sr-hint">This page has no text layer. A scanned image needs OCR first.</span>
            )}
          </div>
          <div className="sr-stage-foot">
            <span>
              p. {page} · {done}/{total} words
            </span>
            <span className="sr-session" title="Pages read to the end since this PDF was opened">
              Session: {pagesRead.length} {pagesRead.length === 1 ? "page" : "pages"} read
            </span>
            <span>{ready && total ? `${formatClock(left)} left on page` : ""}</span>
          </div>
        </div>

        <input
          className="sr-scrub"
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={Math.min(idx, Math.max(0, total - 1))}
          disabled={!ready || !total}
          onChange={(e) => setIdx(Number(e.target.value))}
          aria-label="Position in page"
          style={{ "--sr-fill": `${total > 1 ? (idx / (total - 1)) * 100 : 0}%` } as React.CSSProperties}
        />

        <div className="sr-transport">
          <button data-no95 type="button" className="sr-btn" onClick={() => setIdx(0)} title="Restart page" disabled={!ready}>
            <RotateCcw size={16} />
          </button>
          <button data-no95 type="button" className="sr-btn" onClick={sentenceBack} title="Back a sentence (Shift+←)" disabled={!ready}>
            <SkipBack size={16} />
          </button>
          <button data-no95 type="button" className="sr-btn sr-btn-play" onClick={toggle} disabled={!ready || !total}>
            {playing ? <Pause size={20} /> : <Play size={20} />}
            <span>{playing ? "Pause" : "Read"}</span>
          </button>
          <button data-no95 type="button" className="sr-btn" onClick={() => step(1)} title="Next word (→)" disabled={!ready}>
            <SkipForward size={16} />
          </button>
          <div className="sr-wpm">
            <button data-no95 type="button" className="sr-btn sr-btn-small" onClick={() => nudgeWpm(-25)} aria-label="Slower">
              <Minus size={14} />
            </button>
            <output className="sr-lcd">
              {settings.wpm}
              <i>wpm</i>
            </output>
            <button data-no95 type="button" className="sr-btn sr-btn-small" onClick={() => nudgeWpm(25)} aria-label="Faster">
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="sr-speed">
          <input
            type="range"
            min={RSVP_MIN_WPM}
            max={RSVP_MAX_WPM}
            step={25}
            value={settings.wpm}
            onChange={(e) => update({ wpm: Number(e.target.value) })}
            aria-label="Words per minute"
            style={{ "--sr-fill": `${((settings.wpm - RSVP_MIN_WPM) / (RSVP_MAX_WPM - RSVP_MIN_WPM)) * 100}%` } as React.CSSProperties}
          />
          <div className="sr-presets">
            {SPEED_STEPS.map((w) => (
              <button data-no95
                key={w}
                type="button"
                className={`sr-chip${settings.wpm === w ? " sr-chip-on" : ""}`}
                onClick={() => update({ wpm: w })}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div className="sr-tray">
          <div className="sr-field sr-field-wide">
            <span className="sr-label">Typeface</span>
            <div className="sr-fonts" role="radiogroup" aria-label="Typeface">
              {SPEED_READ_FONTS.map((f) => (
                <button data-no95
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={f.id === settings.fontId}
                  className={`sr-font${f.id === settings.fontId ? " sr-font-on" : ""}`}
                  onClick={() => update({ fontId: f.id })}
                  title={f.note}
                >
                  <span className="sr-font-aa" style={{ fontFamily: f.family }}>
                    Ag
                  </span>
                  <span className="sr-font-name">{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sr-field">
            <span className="sr-label">Size · {settings.size}px</span>
            <input
              type="range"
              min={40}
              max={160}
              step={2}
              value={settings.size}
              onChange={(e) => update({ size: Number(e.target.value) })}
              aria-label="Text size"
              style={{ "--sr-fill": `${((settings.size - 40) / 120) * 100}%` } as React.CSSProperties}
            />
          </div>

          <div className="sr-field">
            <span className="sr-label">Words per flash</span>
            <div className="sr-seg" role="radiogroup" aria-label="Words per flash">
              {[1, 2, 3].map((n) => (
                <button data-no95
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={settings.chunk === n}
                  className={`sr-chip${settings.chunk === n ? " sr-chip-on" : ""}`}
                  onClick={() => update({ chunk: n })}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="sr-field">
            <span className="sr-label">Surface</span>
            <div className="sr-seg" role="radiogroup" aria-label="Surface">
              {(["paper", "night"] as const).map((t) => (
                <button data-no95
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={settings.theme === t}
                  className={`sr-chip${settings.theme === t ? " sr-chip-on" : ""}`}
                  onClick={() => update({ theme: t })}
                >
                  {t === "paper" ? "Paper" : "Night"}
                </button>
              ))}
            </div>
          </div>

          <label className="sr-check">
            <input type="checkbox" checked={settings.pauses} onChange={(e) => update({ pauses: e.target.checked })} />
            Pause on punctuation and long words
          </label>
          <label className="sr-check">
            <input type="checkbox" checked={settings.carry} onChange={(e) => update({ carry: e.target.checked })} />
            Continue onto the next page
          </label>
        </div>

        {ready && context && (
          <p className="sr-context" aria-label="Page text">
            {words.slice(context.from, context.to).map((w, k) => {
              const i = context.from + k
              const on = chunk && i >= chunk.start && i < chunk.start + chunk.count
              return (
                <span
                  key={i}
                  className={on ? "sr-cw sr-cw-on" : "sr-cw"}
                  onClick={() => {
                    setPlaying(false)
                    setIdx(i)
                  }}
                >
                  {w}{" "}
                </span>
              )
            })}
          </p>
        )}
        <p className="sr-keys">Space play · ← → word · Shift+← sentence · ↑ ↓ speed</p>
      </section>
    </div>
  )
}
