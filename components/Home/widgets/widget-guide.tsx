/**
 * components/Home/widgets/widget-guide.tsx — A kind's optional first-run guide
 *
 * A few short cards, shown the first time a copy's detail opens. Skip is
 * always visible. Finishing or skipping marks the copy, so the guide does
 * not return; the gear and the gallery can show it again.
 */
"use client"

import { useState } from "react"
import type { WidgetGuideCard } from "@/lib/widgets/types"

export function WidgetGuide({ cards, onDone }: { cards: WidgetGuideCard[]; onDone: () => void }) {
  const [index, setIndex] = useState(0)
  const card = cards[Math.min(index, cards.length - 1)]
  if (!card) return null
  const last = index >= cards.length - 1
  return (
    <section className="vd-guide" aria-label="Guide" data-testid="widget-guide">
      <p className="vd-guide-step">
        {index + 1} / {cards.length}
      </p>
      <div className="vd-guide-pips" aria-hidden="true">
        {cards.map((entry, at) => (
          <i key={entry.title} className={at === index ? "is-on" : at < index ? "is-done" : ""} />
        ))}
      </div>
      <h4 className="vd-guide-title">{card.title}</h4>
      <p className="vd-guide-body">{card.body}</p>
      <div className="home-widget-actions vd-guide-keys">
        <button type="button" className="home-review-key" onClick={onDone}>
          Skip
        </button>
        {index > 0 ? (
          <button type="button" className="home-review-key" onClick={() => setIndex((at) => at - 1)}>
            Back
          </button>
        ) : null}
        <button
          type="button"
          className="home-review-key is-on"
          onClick={() => (last ? onDone() : setIndex((at) => at + 1))}
        >
          {last ? "Start" : "Next"}
        </button>
      </div>
    </section>
  )
}
