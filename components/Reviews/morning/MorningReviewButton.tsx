/**
 * components/Reviews/morning/MorningReviewButton.tsx — Morning entry button.
 *
 * The error boundary wraps this button only. A dialog opened from Rituals or
 * a To Do row stays outside it. The first paint is always "Morning".
 */
"use client"

import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react"
import { Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { localDayKey, morningReviewPhase, useReviewsStore } from "@/lib/reviews-store"
import { MorningReviewDialog } from "./MorningReviewDialog"

class MorningReviewErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[MorningReview]", error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return (
        <Button
          variant="outline"
          size="sm"
          data-morning-review-entry
          title="Morning review hit a snag — click to try again"
          onClick={() => this.setState({ failed: false })}
        >
          <Sun className="h-4 w-4 mr-2" />
          Morning
        </Button>
      )
    }
    return this.props.children
  }
}

export function MorningReview({ variant = "outline" }: { variant?: "outline" | "default" }) {
  return (
    <MorningReviewErrorBoundary>
      <MorningReviewButton variant={variant} />
    </MorningReviewErrorBoundary>
  )
}

function MorningReviewButton({ variant = "outline" }: { variant?: "outline" | "default" }) {
  const [open, setOpen] = useState(false)
  // Persist rehydrates from localStorage on the client only — gate the ✓ so the
  // first client paint matches the server ("Morning") and avoid a hydration crash.
  const [shownPhase, setShownPhase] = useState<"none" | "partial" | "done">("none")
  const today = localDayKey(new Date())
  const phase = useReviewsStore((s) => morningReviewPhase(s.getReview("day", today)?.morning))

  useEffect(() => {
    setShownPhase(phase)
  }, [phase])

  const label = shownPhase === "done" ? "Morning ✓" : shownPhase === "partial" ? "Morning …" : "Morning"

  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)} data-morning-review-entry>
        <Sun className="h-4 w-4 mr-2" />
        {label}
      </Button>
      <MorningReviewDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export default MorningReview
