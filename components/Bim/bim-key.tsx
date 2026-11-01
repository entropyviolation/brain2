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

type ConsoleProps = { open: boolean; onOpenChange: (open: boolean) => void }

/**
 * `word` prints a word key instead of the terminal glyph. `phoneBar` is the
 * phone header key beside Menu: a plain button that wears that bar's keycap.
 */
export function BimKey({ word, phoneBar }: { word?: string; phoneBar?: string } = {}) {
  const [open, setOpen] = useState(false)
  const [Console, setConsole] = useState<ComponentType<ConsoleProps> | null>(null)

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
