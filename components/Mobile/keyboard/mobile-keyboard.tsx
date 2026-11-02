/**
 * components/Mobile/keyboard/mobile-keyboard.tsx — Keycap keyboard for the phone shell.
 *
 * Focus on a text field hides the system keyboard (`inputmode=none`) and
 * shows this deck. Letters are silver caps. Shift, delete, 123, space,
 * return, and hide are the darker modifier caps. A latched shift is the CRT.
 * The mic cap dictates (`lib/mobile/speech-bridge.ts`); while it listens it
 * stays pushed in with a red LED, and the words land at the caret as they are heard.
 *
 * The deck, not each cap, takes the touch: a tap in a gap goes to the nearest
 * key. Each finger down is counted, so the field keeps focus through quick
 * two-thumb typing. A blur nobody asked for leaves the deck up a moment; a key
 * tap then brings the field back instead of landing on the page behind.
 *
 * In the iPhone app every field is armed (`inputmode=none`) as it lands in the
 * page, and stays armed. A field that focuses itself on open (Quick Add) then
 * never summons the system keyboard, whose open-and-close shoved the whole
 * screen down.
 */
"use client"

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { DismissableLayerBranch } from "@radix-ui/react-dismissable-layer"
import { Mic } from "lucide-react"
import {
  afterLetter,
  autoCap,
  backspace,
  boardForKind,
  cycleShift,
  dictationAnchor,
  insertText,
  keyboardKind,
  letterGlyph,
  nearestKey,
  returnKey,
  revealField,
  runReturn,
  spliceText,
  typingField,
  typingFieldsIn,
  type Board,
  type ShiftMode,
} from "@/components/Mobile/keyboard/keyboard-logic"
import { setDeckOpen } from "@/lib/mobile/keyboard-bridge"
import { isDictationAvailable, startDictation, type Dictation } from "@/lib/mobile/speech-bridge"
import "@/components/Mobile/keyboard/mobile-keyboard.css"

const LETTERS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
]

const NUMBER_PUNCT = ["-", "/", ":", ";", "(", ")", "$", "&", "@", '"']
const NUMBER_MARKS = [".", ",", "?", "!", "'"]
const SYMBOLS = ["[", "]", "{", "}", "#", "%", "^", "*", "+", "="]
const SYMBOL_MARKS = ["_", "\\", "|", "~", "<", ">", "€", "£", "¥", "•"]

const SHIFT_GAP_MS = 450
/** How long a finger still counts as down after it lifts; iOS fires focus changes just after. */
const LIFT_MS = 80
/** How long the deck stays up after a blur nobody asked for. */
const GRACE_MS = 350
const REPEAT_WAIT_MS = 380
const REPEAT_MS = 45

/** Each rendered cap's action. The deck looks it up by the cap it resolves a touch to. */
const keyPresses = new WeakMap<Element, { press: () => void; repeat: boolean }>()

type Touch = { key: HTMLElement | null; timers: number[] }

export function MobileKeyboard() {
  const [field, setField] = useState<HTMLElement | null>(null)
  const [board, setBoard] = useState<Board>("letters")
  const [shift, setShift] = useState<ShiftMode>("off")
  const fieldRef = useRef<HTMLElement | null>(null)
  const shiftRef = useRef<ShiftMode>("off")
  const touches = useRef(new Map<number, Touch>())
  const grace = useRef(0)
  const closing = useRef(false)
  const refocusing = useRef(false)
  const lastShift = useRef(0)
  const deckRef = useRef<HTMLDivElement>(null)
  const [canDictate, setCanDictate] = useState(false)
  const [listening, setListening] = useState(false)
  const dictation = useRef<Dictation | null>(null)

  const holding = () => touches.current.size > 0
  const releaseAll = () => {
    for (const touch of touches.current.values()) {
      stopRepeat(touch)
      touch.key?.classList.remove("is-down")
    }
    touches.current.clear()
  }
  const clearGrace = () => {
    window.clearTimeout(grace.current)
    grace.current = 0
  }

  useEffect(() => {
    setCanDictate(isDictationAvailable())
  }, [])

  // Leaving the field (or hiding the deck) ends dictation.
  useEffect(() => {
    setDeckOpen(field != null)
    if (field) return
    releaseAll()
    clearGrace()
    const live = dictation.current
    dictation.current = null
    if (live) void live.stop().catch(() => undefined)
  }, [field])

  useEffect(() => {
    fieldRef.current = field
  }, [field])
  useEffect(() => {
    shiftRef.current = shift
  }, [shift])

  useEffect(() => {
    if (!field) return
    setShift("off")
    setBoard(boardForKind(keyboardKind(field, field.dataset.mKbSavedMode || "")))
  }, [field])

  useEffect(() => {
    const onPointer = (event: Event) => {
      const el = typingField(event.target)
      if (el) arm(el)
    }
    const onFocusIn = (event: FocusEvent) => {
      const el = typingField(event.target)
      if (!el) return
      clearGrace()
      const ready = el.dataset.mKbArmed === "1" && el.getAttribute("inputmode") === "none"
      arm(el)
      setField(el)
      // A tap arms inputmode before focus, so iOS never opens its keyboard.
      // A script focus can still summon it. Blur and focus once, after this
      // event, so the mode sticks. Desktop has no system keyboard to drop.
      if (!ready && !refocusing.current && iosWebKit()) {
        queueMicrotask(() => {
          if (document.activeElement !== el) return
          refocusing.current = true
          el.blur()
          el.focus()
          refocusing.current = false
        })
      }
    }
    const onFocusOut = (event: FocusEvent) => {
      if (refocusing.current) return
      const previous = event.target instanceof HTMLElement ? event.target : null
      if (!closing.current && holding() && fieldRef.current) {
        const keep = fieldRef.current
        refocusing.current = true
        arm(keep)
        keep.focus()
        refocusing.current = false
        return
      }
      const asked = closing.current
      closing.current = false
      window.setTimeout(() => {
        // The iPhone app keeps fields armed; a browser gets its own keyboard back.
        if (previous && document.activeElement !== previous && !iosWebKit()) disarm(previous)
        if (holding() || refocusing.current) return
        if (typingField(document.activeElement)) return
        if (asked || !fieldRef.current?.isConnected) {
          setField(null)
          return
        }
        clearGrace()
        grace.current = window.setTimeout(() => {
          grace.current = 0
          if (!typingField(document.activeElement)) setField(null)
        }, GRACE_MS)
      }, 0)
    }
    // Arm fields as they arrive, so a script focus never opens the system keyboard.
    let watcher: MutationObserver | null = null
    if (iosWebKit()) {
      for (const el of typingFieldsIn(document.body)) arm(el)
      watcher = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof Element) for (const el of typingFieldsIn(node)) arm(el)
          }
        }
      })
      watcher.observe(document.body, { childList: true, subtree: true })
    }
    document.addEventListener("pointerdown", onPointer, true)
    document.addEventListener("touchstart", onPointer, true)
    document.addEventListener("focusin", onFocusIn)
    document.addEventListener("focusout", onFocusOut)
    return () => {
      watcher?.disconnect()
      document.removeEventListener("pointerdown", onPointer, true)
      document.removeEventListener("touchstart", onPointer, true)
      document.removeEventListener("focusin", onFocusIn)
      document.removeEventListener("focusout", onFocusOut)
    }
  }, [])

  useEffect(() => {
    const deck = deckRef.current
    if (!field || !deck) return
    const height = deck.getBoundingClientRect().height
    document.documentElement.style.setProperty("--m-keyboard-h", `${height}px`)
    document.documentElement.classList.add("m-keyboard-open")
    revealField(field, height)
    return () => {
      document.documentElement.classList.remove("m-keyboard-open")
      document.documentElement.style.removeProperty("--m-keyboard-h")
    }
  }, [field, board])

  // iOS ignores preventDefault on pointerdown: the tap still moves focus (the
  // field blurs, the deck collapses) and a click lands on whatever is behind
  // the deck, especially after hide or a board swap. Cancelling touchstart and
  // mousedown stops both; pointer events still reach the keys.
  useEffect(() => {
    const deck = deckRef.current
    if (!field || !deck) return
    const stop = (event: Event) => {
      if (event.cancelable) event.preventDefault()
    }
    const swallow = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
    }
    deck.addEventListener("touchstart", stop, { passive: false })
    deck.addEventListener("mousedown", stop)
    deck.addEventListener("click", swallow)
    return () => {
      deck.removeEventListener("touchstart", stop)
      deck.removeEventListener("mousedown", stop)
      deck.removeEventListener("click", swallow)
    }
  }, [field])

  if (!field || typeof document === "undefined") return null

  const kind = keyboardKind(field, field.dataset.mKbSavedMode || "")
  const ret = returnKey(field)
  const cap = shift !== "off" || autoCap(field)
  const typeGlyph = (glyph: string) => {
    const el = fieldRef.current
    if (!el) return
    insertText(el, glyph)
  }
  const typeLetter = (letter: string) => {
    const el = fieldRef.current
    if (!el) return
    insertText(el, letterGlyph(letter, shiftRef.current, autoCap(el)))
    setShift((mode) => afterLetter(mode))
  }
  const onShift = () => {
    const now = Date.now()
    const quick = now - lastShift.current < SHIFT_GAP_MS
    lastShift.current = now
    setShift((mode) => cycleShift(mode, quick))
  }
  /** A key tap in the grace moment brings the field back before it types. */
  const revive = () => {
    if (!grace.current) return
    clearGrace()
    const keep = fieldRef.current
    if (!keep?.isConnected || document.activeElement === keep) return
    refocusing.current = true
    arm(keep)
    keep.focus({ preventScroll: true })
    refocusing.current = false
  }
  const onDeckDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const deckEl = deckRef.current
    if (!deckEl) return
    // A primary pointer means no other finger is down; drop any lift that never came.
    if (event.isPrimary) releaseAll()
    const touch: Touch = { key: keyAt(deckEl, event.target, event.clientX, event.clientY), timers: [] }
    touches.current.set(event.pointerId, touch)
    revive()
    const key = touch.key
    const handle = key ? keyPresses.get(key) : undefined
    if (!key || !handle) return
    key.classList.add("is-down")
    handle.press()
    if (!handle.repeat) return
    touch.timers.push(
      window.setTimeout(() => {
        touch.timers.push(window.setInterval(() => keyPresses.get(key)?.press(), REPEAT_MS))
      }, REPEAT_WAIT_MS),
    )
  }
  const onDeckUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const id = event.pointerId
    const touch = touches.current.get(id)
    if (!touch) return
    stopRepeat(touch)
    touch.key?.classList.remove("is-down")
    window.setTimeout(() => {
      if (touches.current.get(id) === touch) touches.current.delete(id)
    }, LIFT_MS)
  }
  const finish = () => {
    closing.current = true
    releaseAll()
  }
  const onReturn = () => {
    const el = fieldRef.current
    if (!el) return
    const action = returnKey(el).action
    if (action !== "newline") finish()
    runReturn(el, action)
  }
  const onMic = async () => {
    if (listening || dictation.current) {
      const live = dictation.current
      dictation.current = null
      setListening(false)
      await live?.stop().catch(() => undefined)
      return
    }
    const el = fieldRef.current
    if (!el) return
    const live = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
    const { start, lead } = dictationAnchor(el)
    let written = 0
    const write = (words: string) => {
      const target = fieldRef.current
      if (!target || target !== el) return
      const text = words ? lead + words : ""
      spliceText(target, start, written, text)
      written = text.length
    }
    setListening(true)
    try {
      const session = await startDictation(
        (words) => {
          if (live) write(words)
        },
        () => {
          dictation.current = null
          setListening(false)
        },
      )
      // A contenteditable cannot be rewritten in place; it gets the final words once.
      dictation.current = live
        ? session
        : {
            stop: async () => {
              const words = await session.stop()
              if (words && fieldRef.current === el) insertText(el, lead + words)
              return words
            },
          }
    } catch {
      setListening(false)
    }
  }
  const onHide = () => {
    finish()
    fieldRef.current?.blur()
  }

  const deck = (
    <DismissableLayerBranch
      ref={deckRef}
      className="m-keyboard"
      role="group"
      aria-label="Keyboard"
      style={{ pointerEvents: "auto" }}
      onPointerDown={onDeckDown}
      onPointerUp={onDeckUp}
      onPointerCancel={onDeckUp}
    >
      {board === "pad" ? (
        <Pad
          decimal={kind === "decimal"}
          returnLabel={ret.label}
          onGlyph={typeGlyph}
          onDelete={() => fieldRef.current && backspace(fieldRef.current)}
          onLetters={() => setBoard("letters")}
          onReturn={onReturn}
          onHide={onHide}
        />
      ) : board === "letters" ? (
        <LetterBoard
          cap={cap}
          shift={shift}
          kind={kind}
          returnLabel={ret.label}
          onLetter={typeLetter}
          onGlyph={typeGlyph}
          onShift={onShift}
          onDelete={() => fieldRef.current && backspace(fieldRef.current)}
          onNumbers={() => setBoard("numbers")}
          onMic={canDictate ? () => void onMic() : undefined}
          listening={listening}
          onReturn={onReturn}
          onHide={onHide}
        />
      ) : (
        <SymbolBoard
          symbols={board === "symbols"}
          returnLabel={ret.label}
          onGlyph={typeGlyph}
          onDelete={() => fieldRef.current && backspace(fieldRef.current)}
          onLetters={() => setBoard("letters")}
          onToggle={() => setBoard(board === "symbols" ? "numbers" : "symbols")}
          onReturn={onReturn}
          onHide={onHide}
        />
      )}
    </DismissableLayerBranch>
  )

  return createPortal(deck, document.body)
}

function iosWebKit(): boolean {
  return typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/** The cap under the touch, else the nearest cap: the deck has no dead gaps. */
function keyAt(deck: HTMLElement, target: EventTarget | null, x: number, y: number): HTMLElement | null {
  const hit = target instanceof Element ? target.closest<HTMLElement>("button.m-kb-key") : null
  if (hit && deck.contains(hit)) return hit
  const keys = [...deck.querySelectorAll<HTMLElement>("button.m-kb-key")]
  return keys[nearestKey(keys.map((key) => key.getBoundingClientRect()), x, y)] ?? null
}

function stopRepeat(touch: Touch) {
  for (const id of touch.timers) window.clearTimeout(id)
  touch.timers = []
}

function arm(el: HTMLElement) {
  if (el.dataset.mKbArmed !== "1") {
    el.dataset.mKbSavedMode = el.getAttribute("inputmode") ?? ""
    el.dataset.mKbArmed = "1"
  }
  if (el.getAttribute("inputmode") !== "none") el.setAttribute("inputmode", "none")
}

function disarm(el: HTMLElement) {
  if (el.dataset.mKbArmed !== "1") return
  const saved = el.dataset.mKbSavedMode ?? ""
  if (saved) el.setAttribute("inputmode", saved)
  else el.removeAttribute("inputmode")
  delete el.dataset.mKbArmed
  delete el.dataset.mKbSavedMode
}

function Key({
  label,
  name,
  className,
  pressed,
  repeat,
  onPress,
}: {
  label: ReactNode
  name: string
  className?: string
  pressed?: boolean
  repeat?: boolean
  onPress: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  // The deck presses this cap; keep its latest action on the element.
  useLayoutEffect(() => {
    if (ref.current) keyPresses.set(ref.current, { press: onPress, repeat: !!repeat })
  })
  return (
    <button
      ref={ref}
      type="button"
      data-no95
      tabIndex={-1}
      className={className ? `m-kb-key ${className}` : "m-kb-key"}
      aria-label={name}
      aria-pressed={pressed}
    >
      {label}
    </button>
  )
}

function LetterBoard({
  cap,
  shift,
  kind,
  returnLabel,
  onLetter,
  onGlyph,
  onShift,
  onDelete,
  onNumbers,
  onMic,
  listening,
  onReturn,
  onHide,
}: {
  cap: boolean
  shift: ShiftMode
  kind: string
  returnLabel: string
  onLetter: (letter: string) => void
  onGlyph: (glyph: string) => void
  onShift: () => void
  onDelete: () => void
  onNumbers: () => void
  onMic?: () => void
  listening: boolean
  onReturn: () => void
  onHide: () => void
}) {
  return (
    <>
      {LETTERS.slice(0, 2).map((row, index) => (
        <div key={row.join()} className={index === 1 ? "m-kb-row m-kb-row-inset" : "m-kb-row"}>
          {row.map((letter) => (
            <Key key={letter} label={letterGlyph(letter, cap ? "once" : "off", false)} name={letter} onPress={() => onLetter(letter)} />
          ))}
        </div>
      ))}
      <div className="m-kb-row">
        <Key
          label={shift === "lock" ? "caps" : "shift"}
          name={shift === "lock" ? "caps" : "shift"}
          className={shift === "off" ? "is-mod" : "is-mod is-latched"}
          pressed={shift !== "off"}
          onPress={onShift}
        />
        {LETTERS[2].map((letter) => (
          <Key key={letter} label={letterGlyph(letter, cap ? "once" : "off", false)} name={letter} onPress={() => onLetter(letter)} />
        ))}
        <Key label="delete" name="delete" className="is-mod" repeat onPress={onDelete} />
      </div>
      <div className="m-kb-row">
        <Key label="123" name="numbers" className="is-mod" onPress={onNumbers} />
        {onMic ? (
          <Key
            label={listening ? <span className="m-kb-led" aria-hidden="true" /> : <Mic aria-hidden="true" />}
            name={listening ? "stop dictation" : "dictate"}
            className={listening ? "is-mod is-mic is-live" : "is-mod is-mic"}
            pressed={listening}
            onPress={onMic}
          />
        ) : null}
        {kind === "email" ? <Key label="@" name="at" onPress={() => onGlyph("@")} /> : null}
        {kind === "url" ? <Key label="/" name="slash" onPress={() => onGlyph("/")} /> : null}
        <Key label="space" name="space" className="is-space" onPress={() => onGlyph(" ")} />
        {kind === "url" ? <Key label=".com" name=".com" className="is-mod" onPress={() => onGlyph(".com")} /> : null}
        <Key label="hide" name="hide keyboard" className="is-mod" onPress={onHide} />
        <Key label={returnLabel} name={returnLabel} className="is-mod is-return" onPress={onReturn} />
      </div>
    </>
  )
}

function SymbolBoard({
  symbols,
  returnLabel,
  onGlyph,
  onDelete,
  onLetters,
  onToggle,
  onReturn,
  onHide,
}: {
  symbols: boolean
  returnLabel: string
  onGlyph: (glyph: string) => void
  onDelete: () => void
  onLetters: () => void
  onToggle: () => void
  onReturn: () => void
  onHide: () => void
}) {
  const top = symbols ? SYMBOLS : ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]
  const mid = symbols ? SYMBOL_MARKS : NUMBER_PUNCT
  const low = symbols ? NUMBER_MARKS : NUMBER_MARKS
  return (
    <>
      <div className="m-kb-row">
        {top.map((glyph) => (
          <Key key={glyph} label={glyph} name={glyph} onPress={() => onGlyph(glyph)} />
        ))}
      </div>
      <div className="m-kb-row">
        {mid.map((glyph) => (
          <Key key={glyph} label={glyph} name={glyph} onPress={() => onGlyph(glyph)} />
        ))}
      </div>
      <div className="m-kb-row">
        <Key label={symbols ? "123" : "#+="} name={symbols ? "numbers" : "symbols"} className="is-mod" onPress={onToggle} />
        {low.map((glyph) => (
          <Key key={glyph} label={glyph} name={glyph} onPress={() => onGlyph(glyph)} />
        ))}
        <Key label="delete" name="delete" className="is-mod" repeat onPress={onDelete} />
      </div>
      <div className="m-kb-row">
        <Key label="ABC" name="letters" className="is-mod" onPress={onLetters} />
        <Key label="space" name="space" className="is-space" onPress={() => onGlyph(" ")} />
        <Key label="hide" name="hide keyboard" className="is-mod" onPress={onHide} />
        <Key label={returnLabel} name={returnLabel} className="is-mod is-return" onPress={onReturn} />
      </div>
    </>
  )
}

function Pad({
  decimal,
  returnLabel,
  onGlyph,
  onDelete,
  onLetters,
  onReturn,
  onHide,
}: {
  decimal: boolean
  returnLabel: string
  onGlyph: (glyph: string) => void
  onDelete: () => void
  onLetters: () => void
  onReturn: () => void
  onHide: () => void
}) {
  const rows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
  ]
  return (
    <>
      {rows.map((row) => (
        <div key={row.join()} className="m-kb-row">
          {row.map((glyph) => (
            <Key key={glyph} label={glyph} name={glyph} onPress={() => onGlyph(glyph)} />
          ))}
        </div>
      ))}
      <div className="m-kb-row">
        <Key label={decimal ? "." : "+"} name={decimal ? "." : "+"} onPress={() => onGlyph(decimal ? "." : "+")} />
        <Key label="0" name="0" onPress={() => onGlyph("0")} />
        <Key label="delete" name="delete" className="is-mod" repeat onPress={onDelete} />
      </div>
      <div className="m-kb-row">
        <Key label="ABC" name="letters" className="is-mod" onPress={onLetters} />
        <Key label="hide" name="hide keyboard" className="is-mod" onPress={onHide} />
        <Key label={returnLabel} name={returnLabel} className="is-mod is-return" onPress={onReturn} />
      </div>
    </>
  )
}
