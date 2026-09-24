/**
 * components/UiNames/UiNamesHost.tsx — Overlay host for `data-ui-mode`
 *
 * Mounted once at the app root (next to CompletionPopupHost) so Names survives
 * task-detail. The nameplate portals to `document.body` at z-index 310 so it
 * sits above Radix dialogs, Just Start, and From Notes (CSS + inline z-index).
 * Names: CSS outline + portal outline copy + hover nameplate + optional console.info.
 * Clicks are not walled — Tracking paint, drag, and physics keep working.
 *
 * Help / Inspect would later read `data-ui-docs` (+ optional `data-ui-docs-anchor`)
 * and load that living markdown (bundle at build, or a small overlay). Do not grow
 * a second blurb table. The in-app Docs tab is user notes — the wrong door.
 */
"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import { useUiNamesStore, type UiMode } from "@/lib/ui-names-store"
import "./ui-names.css"

const UI_NAME = "data-ui-name"
const UI_HELP = "data-ui-help"
const UI_DOCS = "data-ui-docs"
const UI_DOCS_ANCHOR = "data-ui-docs-anchor"
const HTML_MODE = "data-ui-mode"

type Nameplate = {
  name: string
  help: string | null
  x: number
  y: number
  left: number
  top: number
  width: number
  height: number
}

function closestNamed(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  return target.closest(`[${UI_NAME}]`)
}

function applyHtmlMode(mode: UiMode) {
  const root = document.documentElement
  if (mode === "off") root.removeAttribute(HTML_MODE)
  else root.setAttribute(HTML_MODE, mode)
}

function plateStyle(x: number, y: number): CSSProperties {
  const pad = 14
  const flipX = typeof window !== "undefined" && x > window.innerWidth - 220
  const flipY = typeof window !== "undefined" && y > window.innerHeight - 72
  return {
    left: flipX ? undefined : x + pad,
    right: flipX ? Math.max(8, window.innerWidth - x + pad) : undefined,
    top: flipY ? y - 56 : y + pad,
  }
}

/** Names logs the living README path. Help / Inspect would load that markdown here. */
function handleNamedActivate(el: HTMLElement, mode: UiMode) {
  switch (mode) {
    case "names": {
      const name = el.getAttribute(UI_NAME)
      const docs = el.getAttribute(UI_DOCS)
      const anchor = el.getAttribute(UI_DOCS_ANCHOR)
      const extra =
        docs || anchor
          ? {
              ...(docs ? { docs } : {}),
              ...(anchor ? { anchor } : {}),
            }
          : ""
      console.info("[ui-names]", name, extra)
      return
    }
    default:
      return
  }
}

export function UiNamesHost() {
  const mode = useUiNamesStore((s) => s.mode)
  const [plate, setPlate] = useState<Nameplate | null>(null)

  useEffect(() => {
    applyHtmlMode(mode)
    return () => applyHtmlMode("off")
  }, [mode])

  useEffect(() => {
    if (mode === "off") {
      setPlate(null)
      document.querySelectorAll("[data-ui-current]").forEach((node) => node.removeAttribute("data-ui-current"))
      return
    }

    const markCurrent = (el: HTMLElement | null) => {
      document.querySelectorAll("[data-ui-current]").forEach((node) => node.removeAttribute("data-ui-current"))
      el?.setAttribute("data-ui-current", "")
    }

    const onOver = (event: PointerEvent) => {
      const el = closestNamed(event.target)
      if (!el) {
        setPlate(null)
        markCurrent(null)
        return
      }
      const name = el.getAttribute(UI_NAME)
      if (!name) {
        setPlate(null)
        markCurrent(null)
        return
      }
      markCurrent(el)
      const box = el.getBoundingClientRect()
      setPlate({
        name,
        help: el.getAttribute(UI_HELP),
        x: event.clientX,
        y: event.clientY,
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      })
    }

    const onOut = (event: PointerEvent) => {
      const next = event.relatedTarget
      if (next instanceof Element && closestNamed(next)) return
      setPlate(null)
      markCurrent(null)
    }

    const onClick = (event: MouseEvent) => {
      const el = closestNamed(event.target)
      if (!el) return
      handleNamedActivate(el, mode)
    }

    document.addEventListener("pointerover", onOver)
    document.addEventListener("pointerout", onOut)
    document.addEventListener("click", onClick)
    return () => {
      document.removeEventListener("pointerover", onOver)
      document.removeEventListener("pointerout", onOut)
      document.removeEventListener("click", onClick)
      markCurrent(null)
    }
  }, [mode])

  if (mode !== "names" || !plate) return null
  if (typeof document === "undefined") return null

  return createPortal(
    <div
      className="ui-names-layer"
      data-testid="ui-names-layer"
      style={{ zIndex: 310, pointerEvents: "none" }}
    >
      <div
        className="ui-name-outline"
        aria-hidden
        style={{
          left: plate.left,
          top: plate.top,
          width: plate.width,
          height: plate.height,
        }}
      />
      <div
        className="ui-nameplate"
        data-testid="ui-nameplate"
        role="status"
        style={plateStyle(plate.x, plate.y)}
      >
        <div className="ui-nameplate-name">{plate.name}</div>
        {plate.help ? <div className="ui-nameplate-help">{plate.help}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
