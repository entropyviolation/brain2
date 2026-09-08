/**
 * components/ItemDetail/SubtaskComposer.tsx — Isolated subtask add field
 *
 * Owns its text so typing does not re-render the item-detail tree.
 */
"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function SubtaskComposer({ onAdd }: { onAdd: (description: string) => void }) {
  const [text, setText] = useState("")
  const submit = () => {
    if (!text.trim()) return
    onAdd(text)
    setText("")
  }
  return (
    <div className="flex gap-2">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter subtask description..."
        className="flex-1 focus-ring"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            submit()
          }
        }}
      />
      <Button onClick={submit} disabled={!text.trim()} className="focus-ring">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
