/**
 * GradSearchView — Graduate Program Explorer
 *
 * Port of `/Users/otherworld/gradsearch` (`app/index.html` + `app/app.js` +
 * `app/styles.css`). Markup and CSS live in a shadow root so the explorer
 * keeps its own theme, type, and layout. The engine is the original search /
 * filter / sort / score / compare / verify / favorites / hide flow, reading
 * the bundled catalog (`data.json`, the gradsearch `data.js` store).
 */
"use client"

import { useLayoutEffect, useRef, useState } from "react"
import catalog from "./data.json"
import { mountGradSearch } from "./engine"
import { GRADSEARCH_SHELL } from "./shell"
import { GRADSEARCH_CSS } from "./styles"

const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap"

export function GradSearchView() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [epoch, setEpoch] = useState(0)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" })
    shadow.innerHTML =
      `<link rel="stylesheet" href="${FONT_LINK}" />` +
      `<style>${GRADSEARCH_CSS}</style>${GRADSEARCH_SHELL}`
    const root = shadow.querySelector(".gs-app")
    if (!root) return
    const stop = mountGradSearch(root, catalog, {
      onReload: () => setEpoch((n) => n + 1),
    })

    const fit = () => {
      const available = Math.round(window.innerHeight - host.getBoundingClientRect().top - 10)
      const pane = available >= 360
      root.classList.toggle("gs-flow", !pane)
      if (pane) {
        host.style.height = `${available}px`
        host.style.setProperty("--gs-pane-h", `${available}px`)
      } else {
        host.style.height = ""
        host.style.setProperty("--gs-pane-h", "70vh")
      }
    }
    fit()
    const onResize = () => fit()
    window.addEventListener("resize", onResize)

    return () => {
      window.removeEventListener("resize", onResize)
      stop?.()
      shadow.innerHTML = ""
      host.style.height = ""
    }
  }, [epoch])

  return <div ref={hostRef} className="gradsearch-host" />
}
