/**
 * components/Home/ToDo/AddDoneDialog.tsx — Log unplanned completed work
 *
 * Adds a task that is already done (retroactive capture) for the focused period.
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { CheckCircle2, Plus } from "lucide-react"

export function AddDoneDialog({ onAdd, label = "Log done" }: { onAdd: (description: string) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState("")

  const submit = () => {
    if (!description.trim()) return
    onAdd(description.trim())
    setDescription("")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Log completed work
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Record something you finished that wasn&apos;t on the plan. Points are awarded automatically.
        </p>
        <div className="space-y-4">
          <div>
            <Label htmlFor="done-description">What did you do?</Label>
            <Input
              id="done-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Fixed the leaky faucet"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <Button onClick={submit} className="w-full" disabled={!description.trim()}>
            Add to done list
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
