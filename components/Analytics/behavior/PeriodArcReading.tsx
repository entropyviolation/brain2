/**
 * components/Analytics/PeriodArcReading.tsx — Longer rituals, read back
 *
 * One view for week, month, season, and year. Grouped by the same headings
 * as the ritual. Inspiration photos resolve through the attachment store.
 */
"use client"

import { useAttachmentSrc } from "@/hooks/use-attachment-src"
import { ARC_GROUPS, arcPrompts } from "@/lib/period-arc"
import { periodLabel } from "@/lib/reviews-store"
import type { FileValue, PeriodReview } from "@/lib/types"

function Photo({ photo }: { photo: FileValue }) {
  const src = useAttachmentSrc(photo.uri)
  if (!src) return null
  return <img src={src} alt={photo.name || "Inspiration"} className="h-28 w-28 object-cover border" />
}

function answer(review: PeriodReview, id: string): string {
  const value = review.arc?.[id as keyof NonNullable<PeriodReview["arc"]>]
  return typeof value === "string" ? value.trim() : ""
}

export function PeriodArcReading({ reviews }: { reviews: PeriodReview[] }) {
  const longer = reviews.filter((review) => review.period !== "day" && review.arc)
  if (!longer.length) return null

  return (
    <section className="space-y-4" data-ui-name="Period reflections">
      <p className="an-canvas-title">Period reflections</p>
      <p className="an-n">Week, month, season, and year — the longer questions, in the words they were written.</p>
      {ARC_GROUPS.map((group) => {
        const blocks = longer.flatMap((review) => {
          const promptsForPeriod = arcPrompts(review.period).filter((prompt) => prompt.group === group)
          const rows = promptsForPeriod.flatMap((prompt) => {
            const text = answer(review, prompt.id)
            const reframe = prompt.reframe ? answer(review, prompt.reframe.id) : ""
            const photos = prompt.photos ? review.arc?.inspiredPhotos ?? [] : []
            if (!text && !reframe && photos.length === 0) return []
            return [{ prompt, text, reframe, photos }]
          })
          if (!rows.length) return []
          return [{ review, rows }]
        })
        if (!blocks.length) return null
        return (
          <div key={group} className="space-y-2">
            <p className="font-semibold text-sm">{group === "Also" ? "Also" : group}</p>
            {blocks.map(({ review, rows }) => (
              <article key={`${group}-${review.id}`} className="an-review-card">
                <header>
                  <span className="capitalize">{review.period === "quarter" ? "Season" : review.period}</span>
                  <span>· {periodLabel(review.period, review.periodKey)}</span>
                </header>
                <div className="an-review-body space-y-2">
                  {rows.map(({ prompt, text, reframe, photos }) => (
                    <div key={prompt.sectionId}>
                      <p className="an-n">{prompt.label}</p>
                      {text && <p className="whitespace-pre-wrap">{text}</p>}
                      {reframe && (
                        <p className="whitespace-pre-wrap">
                          <span className="an-n">Reframe · </span>
                          {reframe}
                        </p>
                      )}
                      {photos.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {photos.map((photo) => (
                            <Photo key={photo.id} photo={photo} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )
      })}
    </section>
  )
}
