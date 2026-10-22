/**
 * components/Modules/workspace/html/HtmlFilePicker.tsx — "Choose file" for HTML uploads
 *
 * A house button that opens a hidden file input, with the chosen name beside
 * it. The native file input does not take the pixel skin.
 */
"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"

export function HtmlFilePicker({
  id,
  fileName,
  onPick,
}: {
  id?: string
  fileName?: string
  onPick: (file: File | undefined) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-3 min-w-0">
      <input
        ref={input}
        id={id}
        type="file"
        accept=".html,.htm,text/html"
        className="sr-only"
        onChange={(e) => {
          onPick(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
        {fileName ? "Choose another" : "Choose file"}
      </Button>
      <span className="truncate text-sm text-muted-foreground">{fileName ?? "No file chosen"}</span>
    </div>
  )
}
