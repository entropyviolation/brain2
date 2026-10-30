/**
 * components/Mobile/keyboard/mobile-keyboard.tsx — Keycap keyboard for the phone shell.
 *
 * Focus on a text field hides the system keyboard (`inputmode=none`) and
 * shows this deck. Letters are silver caps. Shift, delete, 123, space,
 * return, and hide are the darker modifier caps. A latched shift is the CRT.
 */
"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { createPortal } from "react-dom"
import { DismissableLayerBranch } from "@radix-ui/react-dismissable-layer"
import {
  afterLetter,
  autoCap,
  backspace,
  boardForKind,
  cycleShift,
  insertText,
  keyboardKind,
  letterGlyph,
  returnKey,
  revealField,
  runReturn,
  typingField,
  type Board,
  type ShiftMode,
} from "@/components/Mobile/keyboard/keyboard-logic"
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

export function MobileKeyboard() {
  const [field, setField] = useState<HTMLElement | null>(null)
  const [board, setBoard] = useState<Board>("letters")
  const [shift, setShift] = useState<ShiftMode>("off")
  const fieldRef = useRef<HTMLElement | null>(null)
  const shiftRef = useRef<ShiftMode>("off")
  const holding = useRef(false)
  const closing = useRef(false)
  const refocusing = useRef(false)
  const lastShift = useRef(0)
  const deckRef = useRef<HTMLDivElement>(null)

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
      if (!closing.current && holding.current && fieldRef.current) {
        const keep = fieldRef.current
        refocusing.current = true
        arm(keep)
        keep.focus()
        refocusing.current = false
        return
      }
      closing.current = false
      window.setTimeout(() => {
        if (previous && document.activeElement !== previous) disarm(previous)
        if (holding.current || refocusing.current) return
        if (!typingField(document.activeElement)) setField(null)
      }, 0)
    }
    document.addEventListener("pointerdown", onPointer, true)
    document.addEventListener("touchstart", onPointer, true)
    document.addEventListener("focusin", onFocusIn)
    document.addEventListener("focusout", onFocusOut)
    return () => {
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
  const releaseHold = () => {
    window.setTimeout(() => {
      holding.current = false
    }, 80)
  }
  const finish = () => {
    closing.current = true
    holding.current = false
  }
  const onReturn = () => {
    const el = fieldRef.current
    if (!el) return
    const action = returnKey(el).action
    if (action !== "newline") finish()
    runReturn(el, action)
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
      onPointerDownCapture={(event) => {
        event.preventDefault()
        holding.current = true
      }}
      onPointerUp={releaseHold}
      onPointerCancel={releaseHold}
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
  label: string
  name: string
  className?: string
  pressed?: boolean
  repeat?: boolean
  onPress: () => void
}) {
  const timers = useRef<number[]>([])
  const clear = () => {
    for (const id of timers.current) window.clearInterval(id)
    timers.current = []
  }
  useEffect(() => clear, [])
  const down = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onPress()
    if (!repeat) return
    const wait = window.setTimeout(() => {
      const tick = window.setInterval(onPress, 45)
      timers.current.push(tick)
    }, 380)
    timers.current.push(wait)
  }
  return (
    <button
      type="button"
      data-no95
      tabIndex={-1}
      className={className ? `m-kb-key ${className}` : "m-kb-key"}
      aria-label={name}
      aria-pressed={pressed}
      onPointerDown={down}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
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
