// Page-only step composer for the full-screen item detail. Not for ItemDetailPopup, the To do drawer, or the task card.
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { parseSteps } from "@/lib/molecular"
import { Split } from "lucide-react"

export function SplitStepsComposer({ onSplit }: { onSplit: (text: string) => void }) {
  const [text, setText] = useState("")
  return (
    <>
      <Textarea
        id="split-steps"
        rows={4}
        placeholder={"1. Open the file\n2. Find the section\n3. Write the first sentence"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button
        onClick={() => {
          onSplit(text)
          setText("")
        }}
        disabled={!parseSteps(text).length}
      >
        <Split className="h-4 w-4 mr-2" />
        Add steps
      </Button>
    </>
  )
}
