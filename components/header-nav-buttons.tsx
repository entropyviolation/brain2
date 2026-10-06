/**
 * components/header-nav-buttons.tsx — Mill Back / Forward keys
 *
 * Compact Nav well at the leading edge of the header body (left of Friend).
 * Tracks in-app screens via `useScreenHistory` — not window.history alone.
 */
"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useScreenHistory } from "@/lib/use-screen-history"

export function HeaderNavButtons() {
  const { canBack, canForward, back, forward } = useScreenHistory()

  return (
    <fieldset
      className="b2-shell-group b2-shell-nav"
      data-testid="header-nav"
      data-ui-name="Screen history"
      data-ui-help="Back and Forward through screens you have visited (tabs, Lists folders, item detail)."
      data-ui-docs="components/README.md"
      data-ui-docs-anchor="top-level-files"
    >
      <legend>Nav</legend>
      <div className="b2-shell-keys" role="group" aria-label="Screen history">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="b2-shell-nav-btn"
          aria-label="Back"
          title="Back"
          disabled={!canBack}
          onClick={back}
          data-testid="header-nav-back"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="b2-shell-nav-btn"
          aria-label="Forward"
          title="Forward"
          disabled={!canForward}
          onClick={forward}
          data-testid="header-nav-forward"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </fieldset>
  )
}
