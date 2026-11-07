/**
 * components/Bim/bim-key.tsx — header key for the BIM Chat console
 *
 * Sits with Capture on the pin bar. The console chunk loads on the first
 * press, like the other header doors.
 */
"use client"

import { useEffect, useState, type ComponentType } from "react"
import { SquareTerminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { backfillFlightsFromChat, confirmFlightsLanded, FLIGHT_BACKFILL_KEY, whenFlightStoresReady } from "@/lib/flight-bimby/backfill"
import { useBimChatStore } from "@/lib/ingest/bim-chat"
import { BIM_CHAT_ADD_EVENT } from "@/lib/doc-selection/doc-selection-bus"

/** One catch-up per page load, however many times this key mounts. */
let flightBackfillStarted = false

type ConsoleProps = { open: boolean; onOpenChange: (open: boolean) => void }

/**
 * `word` prints a word key instead of the terminal glyph. `phoneBar` is the
 * phone header key beside Menu: a plain button that wears that bar's keycap.
 */
export function BimKey({ word, phoneBar }: { word?: string; phoneBar?: string } = {}) {
  const [open, setOpen] = useState(false)
  const [Console, setConsole] = useState<ComponentType<ConsoleProps> | null>(null)

  // Once per device: file flights that were pasted into BIM Chat before the Flight BIMBY could read them.
  useEffect(() => {
    let live = true
    try {
      if (flightBackfillStarted || localStorage.getItem(FLIGHT_BACKFILL_KEY)) return
      flightBackfillStarted = true
    } catch {
      return
    }
    void (async () => {
      await whenFlightStoresReady()
      if (!live) return
      const filed = await backfillFlightsFromChat(useBimChatStore.getState().lines)
      const landed = await confirmFlightsLanded(filed)
      if (!landed) return
      try {
        localStorage.setItem(FLIGHT_BACKFILL_KEY, new Date().toISOString())
      } catch {
        /* the flag is a convenience; ids keep a repeat harmless */
      }
      // Only say so when something was actually added; a repeat that finds it all there stays quiet.
      if (!filed.some((f) => f.status !== "existing")) return
      const text = `Caught up on flights you pasted earlier:\n${filed.map((f) => f.line).join("\n")}`
      useBimChatStore.setState((s) => ({ lines: [...s.lines, { id: `bim-flights-${Date.now().toString(36)}`, at: new Date().toISOString(), who: "bim" as const, text, status: "ok" as const, kind: "tell" as const }] }))
    })()
    return () => {
      live = false
    }
  }, [])

  // Docs selection menu: "Add to BIM chat" opens the console with the text in the compose well.
  useEffect(() => {
    const onAdd = () => {
      // Both header keys are mounted (CSS hides one); only the visible one opens.
      const narrow = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px)").matches
      if (narrow === (phoneBar !== undefined)) setOpen(true)
    }
    window.addEventListener(BIM_CHAT_ADD_EVENT, onAdd)
    return () => window.removeEventListener(BIM_CHAT_ADD_EVENT, onAdd)
  }, [phoneBar])

  useEffect(() => {
    if (!open || Console) return
    let live = true
    void import("@/components/Bim/console/bim-console").then((mod) => {
      if (live) setConsole(() => mod.BimConsole)
    })
    return () => {
      live = false
    }
  }, [open, Console])

  return (
    <>
      {phoneBar ? (
        <button type="button" className={phoneBar} title="BIM Chat" aria-label="BIM Chat" onClick={() => setOpen(true)}>
          <SquareTerminal aria-hidden="true" />
        </button>
      ) : (
      <Button
        variant="outline"
        size="sm"
        className={word ? undefined : "b2-shell-icon"}
        title="BIM Chat"
        aria-label="BIM Chat"
        data-ui-name="BIM Chat"
        onClick={() => setOpen(true)}
      >
        {word ?? <SquareTerminal />}
      </Button>
      )}
      {Console ? <Console open={open} onOpenChange={setOpen} /> : null}
    </>
  )
}
