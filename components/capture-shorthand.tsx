/**
 * components/capture-shorthand.tsx — Shared Quick Add / Bulk Add capture help
 */
"use client"

import { Label } from "@/components/ui/label"

export function SendToInboxField({
  checked,
  onCheckedChange,
  id,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  id: string
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border border-primary"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      <div className="grid gap-1 leading-snug">
        <Label htmlFor={id} className="font-normal cursor-pointer">
          Send to Inbox for clarification
        </Label>
        <p className="text-xs text-muted-foreground">
          Uncheck to skip Inbox and file on the target list, or All Items if none is specified.
        </p>
      </div>
    </div>
  )
}

export function CaptureShorthandHelp({ variant }: { variant: "quick" | "bulk" }) {
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer hover:text-foreground">Shorthand &amp; where items go</summary>
      <div className="mt-2 rounded-md border bg-muted/40 px-3 py-2 space-y-2">
        <p className="font-medium text-foreground">Colons = path, then the item</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>
            <code className="text-foreground">just the item</code> — no list; Inbox or All Items
          </li>
          <li>
            <code className="text-foreground">list: item</code> — that list (created if needed)
          </li>
          <li>
            <code className="text-foreground">folder: list: item</code> — folder, then list
          </li>
          <li>
            <code className="text-foreground">folder: folder: list: item</code> — nested folders, then list
          </li>
        </ul>
        <p>
          Example:{" "}
          <code className="text-foreground">
            next actions: eventually: go through and edit old three pages into a memoir or essay
            narrative; mine essays
          </code>
        </p>
        {variant === "bulk" && (
          <>
            <p className="font-medium text-foreground">Bulk headers</p>
            <p>
              A line that <em>ends</em> with <code className="text-foreground">:</code> is a header
              for the following lines: <code className="text-foreground">Groceries:</code> or{" "}
              <code className="text-foreground">Next Actions: Eventually:</code>.
            </p>
          </>
        )}
        <p className="font-medium text-foreground">Item shorthand</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>
            Dates: <code className="text-foreground">today</code>, <code className="text-foreground">tomorrow</code>,{" "}
            <code className="text-foreground">friday</code>, <code className="text-foreground">next week</code>,{" "}
            <code className="text-foreground">in 3 days</code>, <code className="text-foreground">3/15</code>,{" "}
            <code className="text-foreground">Jan 5</code>
          </li>
          <li>
            Times: <code className="text-foreground">3pm</code>, <code className="text-foreground">at 3:30</code>,{" "}
            <code className="text-foreground">noon</code>, <code className="text-foreground">midnight</code>
          </li>
          <li>
            Duration: <code className="text-foreground">30m</code>, <code className="text-foreground">2h</code>,{" "}
            <code className="text-foreground">1.5 hours</code>
          </li>
          <li>
            Priority: <code className="text-foreground">!</code> / <code className="text-foreground">!!</code> /{" "}
            <code className="text-foreground">!!!</code>, <code className="text-foreground">urgent</code>,{" "}
            <code className="text-foreground">asap</code>, <code className="text-foreground">important</code>
          </li>
          <li>
            List hint: <code className="text-foreground">cat:Health</code> or{" "}
            <code className="text-foreground">category:Research</code>
          </li>
        </ul>
      </div>
    </details>
  )
}
