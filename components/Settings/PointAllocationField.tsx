/**
 * components/Settings/PointAllocationField.tsx — Automatic point allocation
 *
 * A short bay and a button. The catalog itself is `PointsRulesDialog`:
 * every global points rule, with the explanation of when it fires.
 * Habit rows write the Habits → Settings fields. Ritual points and the
 * goal-focus multiplier write the fields they already had.
 */
"use client"

import { useState } from "react"
import { Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import { PointsRulesDialog } from "@/components/Settings/PointsRulesDialog"

export function PointAllocationField() {
  const [open, setOpen] = useState(false)
  const [container, setContainer] = useState<HTMLElement | null>(null)

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4" data-ui-name="Automatic point allocation">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4" />
        <h3 className="font-semibold">Automatic point allocation</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Every global point rule is in one list: when it fires, how the number is used, and whether saving it
        rewrites points you already earned. Habit bonuses are in that list and still in Habits → Settings. Both
        edit the same numbers.
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={(event) => {
              const host = event.currentTarget.closest(".set95-dialog")
              setContainer(host instanceof HTMLElement ? host : null)
            }}
          >
            <Trophy className="mr-2 h-4 w-4" />
            Points rules
          </Button>
        </DialogTrigger>
        <PointsRulesDialog container={container} />
      </Dialog>
    </div>
  )
}
