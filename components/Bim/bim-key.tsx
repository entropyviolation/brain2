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

export function BimKey() {
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
      <Button
        variant="outline"
        size="sm"
        className="b2-shell-icon"
        title="BIM Chat"
        aria-label="BIM Chat"
        data-ui-name="BIM Chat"
        onClick={() => setOpen(true)}
      >
        <SquareTerminal />
      </Button>
      {Console ? <Console open={open} onOpenChange={setOpen} /> : null}
    </>
  )
}
