/**
 * components/Analytics/CompletionReviewPlates.tsx — Completion-review readings
 *
 * Plates for the quick review and the later Reflect save: how sure the clock
 * was, whether the work was harder than expected, how it felt (including
 * satisfaction and distraction), the later `reflectNotes`, which goals held
 * the hard or joyful work, and what the review itself earned. Unknown lengths
 * are a count, not a zero added into either minute total.
 */
"use client"

import type { CompletionReviewSummary, GoalTexture } from "@/lib/completion-review"
import { formatReviewPoints } from "@/lib/completion-review"
import { formatDurationMinutes } from "@/lib/estimated-values"
import { FindingBlock, StudioBars, StudioReadout } from "./studio-kit"

function signedGap(gap: number): string {
  const rounded = Math.round(gap * 10) / 10
  if (rounded === 0) return "0"
  return rounded > 0 ? `+${rounded}` : String(rounded)
}

function DifficultyPlate({ summary }: { summary: CompletionReviewSummary }) {
  const pairs = summary.difficultyPairs
  if (pairs.length === 0) {
    return (
      <section className="an-plate" data-testid="review-difficulty">
        <p className="an-canvas-title">Expected and actual difficulty</p>
        <p className="an-canvas-kicker">Did the work feel harder than you thought?</p>
        <p className="an-canvas-hint">No review in this window scored both.</p>
      </section>
    )
  }
  const expected = pairs.reduce((sum, pair) => sum + pair.expected, 0) / pairs.length
  const actual = pairs.reduce((sum, pair) => sum + pair.actual, 0) / pairs.length
  const gap = summary.difficultyGap ?? 0
  const sentence =
    gap >= 0.5
      ? `On ${pairs.length} review${pairs.length === 1 ? "" : "s"}, the work ran harder than expected.`
      : gap <= -0.5
        ? `On ${pairs.length} review${pairs.length === 1 ? "" : "s"}, the work ran easier than expected.`
        : `On ${pairs.length} review${pairs.length === 1 ? "" : "s"}, expected and actual difficulty stayed close.`
  return (
    <section className="an-plate" data-testid="review-difficulty">
      <p className="an-canvas-title">Expected and actual difficulty</p>
      <p className="an-canvas-kicker">Did the work feel harder than you thought? 1–10.</p>
      <FindingBlock
        sentence={sentence}
        n={`n = ${pairs.length} · expected ${expected.toFixed(1)} · actual ${actual.toFixed(1)} · gap ${signedGap(gap)}`}
        caveat="Only reviews that scored both. A missing score is left out, not treated as 5."
      />
      <ul className="an-list">
        {pairs.map((pair) => (
          <li key={pair.taskId} className="an-list-row">
            <span className="truncate">{pair.title}</span>
            <span className="an-n">
              expected {pair.expected} · actual {pair.actual} · {signedGap(pair.actual - pair.expected)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function FeelingsPlate({ summary }: { summary: CompletionReviewSummary }) {
  return (
    <section className="an-plate" data-testid="review-feelings">
      <p className="an-canvas-title">How it felt</p>
      <p className="an-canvas-kicker">
        Enjoyment, resistance, energy, focus, meaning, satisfaction, and distraction — plus the two difficulties. Optional 1–10 scores. A missing score is left out.
      </p>
      {summary.scoreMeans.length === 0 ? (
        <p className="an-canvas-hint">No reflection scores in this window.</p>
      ) : (
        <>
          <div className="an-readouts">
            {summary.scoreMeans.map((score) => (
              <StudioReadout
                key={score.key}
                label={score.label}
                value={score.mean.toFixed(1)}
                note={`n = ${score.n}`}
                tip={`${score.label} averages the reviews that scored it.`}
              />
            ))}
          </div>
          <StudioBars
            rows={summary.scoreMeans.map((score) => ({ name: score.label, value: Math.round(score.mean * 10) / 10 }))}
            max={10}
            unit=""
          />
        </>
      )}
    </section>
  )
}

function ClockPlate({ summary }: { summary: CompletionReviewSummary }) {
  return (
    <section className="an-plate" data-testid="review-clock">
      <p className="an-canvas-title">How sure was the clock</p>
      <p className="an-canvas-kicker">
        Exact minutes are the only ones in the exact total. Estimated minutes are beside that. Unknown is a count — it is not zero. Starts use the same three marks. An unknown start is a count, not a time.
      </p>
      <div className="an-readouts">
        <StudioReadout
          label="Exact"
          value={formatDurationMinutes(summary.exactMinutes)}
          note={`${summary.exactCount} done`}
          tip="Sum of lengths marked exact."
        />
        <StudioReadout
          label="Est."
          value={formatDurationMinutes(summary.estimatedMinutes)}
          note={`${summary.estimatedCount} done · not in the exact total`}
          tip="Approximate lengths. Kept out of exact totals."
        />
        <StudioReadout
          label="Unknown"
          value={summary.unknownCount}
          note="no minutes"
          tip="The person said the length was unknown. Nothing was added to either total."
        />
        <StudioReadout
          label="Unspecified"
          value={summary.unspecifiedCount}
          note="done, no length"
        />
        <StudioReadout label="Painted" value={formatDurationMinutes(summary.paintedMinutes)} note="time logs on these tasks" />
        <StudioReadout label="Starts exact" value={summary.startExact} note="a time they stand behind" />
        <StudioReadout label="Starts est." value={summary.startEstimated} note="approximate" />
        <StudioReadout
          label="Starts unknown"
          value={summary.startUnknown}
          note="no time"
          tip="The person said the start was unknown. Nothing was plotted as a time."
        />
        <StudioReadout label="Starts unspecified" value={summary.startUnspecified} note="done, no start" />
      </div>
    </section>
  )
}

function TextureList({
  title,
  hint,
  rows,
  mode,
}: {
  title: string
  hint: string
  rows: GoalTexture[]
  mode: "hard" | "joy"
}) {
  const ranked = rows
    .filter((row) => (mode === "hard" ? row.difficultyN > 0 : row.enjoymentN > 0))
    .sort((a, b) => {
      const av = mode === "hard" ? a.meanActualDifficulty ?? 0 : a.meanEnjoyment ?? 0
      const bv = mode === "hard" ? b.meanActualDifficulty ?? 0 : b.meanEnjoyment ?? 0
      return bv - av
    })
  if (ranked.length === 0) return null
  return (
    <div>
      <p className="an-canvas-title">{title}</p>
      <p className="an-canvas-kicker">{hint}</p>
      <StudioBars
        rows={ranked.map((row) => ({
          name: row.title,
          value: Math.round(((mode === "hard" ? row.meanActualDifficulty : row.meanEnjoyment) ?? 0) * 10) / 10,
        }))}
        max={10}
        unit=""
      />
      <ul className="an-list">
        {ranked.map((row) => (
            <li key={row.id} className="an-list-row">
            <span className="truncate">{row.title}</span>
            <span className="an-n">
              n = {mode === "hard" ? row.difficultyN : row.enjoymentN}
              {row.exactMinutes > 0 ? ` · exact ${formatDurationMinutes(row.exactMinutes)}` : ""}
              {row.estimatedMinutes > 0 ? ` · est. ${formatDurationMinutes(row.estimatedMinutes)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function GoalTexturePlate({ summary }: { summary: CompletionReviewSummary }) {
  const linked = summary.goals.length + summary.objectives.length
  return (
    <section className="an-plate" data-testid="review-goals">
      <p className="an-canvas-title">Where the hard and joyful work went</p>
      <p className="an-canvas-kicker">
        Done tasks in this window, grouped by the goal or objective they counted toward. Means use only the scores that were given.
      </p>
      {linked === 0 ? (
        <p className="an-canvas-hint">No done task in this window is linked to a goal or an objective.</p>
      ) : (
        <>
          <TextureList
            title="Goals · harder work"
            hint="Mean actual difficulty."
            rows={summary.goals}
            mode="hard"
          />
          <TextureList
            title="Goals · more enjoyment"
            hint="Mean enjoyment."
            rows={summary.goals}
            mode="joy"
          />
          <TextureList
            title="Objectives · harder work"
            hint="Mean actual difficulty."
            rows={summary.objectives}
            mode="hard"
          />
          <TextureList
            title="Objectives · more enjoyment"
            hint="Mean enjoyment."
            rows={summary.objectives}
            mode="joy"
          />
          {summary.goals.some((row) => row.difficultyN === 0 && row.enjoymentN === 0) && (
            <div>
              <p className="an-canvas-title">Linked, not yet scored</p>
              <ul className="an-list">
                {summary.goals
                  .filter((row) => row.difficultyN === 0 && row.enjoymentN === 0)
                  .map((row) => (
                    <li key={row.id} className="an-list-row">
                      <span className="truncate">{row.title}</span>
                      <span className="an-n">{row.n} done</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function NotesPlate({ summary }: { summary: CompletionReviewSummary }) {
  const notes = summary.reflectNotes
  return (
    <section className="an-plate" data-testid="review-notes">
      <p className="an-canvas-title">Later notes</p>
      <p className="an-canvas-kicker">
        Written in Reflect (`reflectNotes`). These are not the quick-review notes, and they do not change the review points.
      </p>
      {notes.length === 0 ? (
        <p className="an-canvas-hint">No later notes in this window.</p>
      ) : (
        notes.map((note) => {
          const when = note.completedAt instanceof Date ? note.completedAt : new Date(note.completedAt)
          const date = Number.isNaN(when.getTime()) ? "" : when.toLocaleDateString()
          return (
            <article key={note.taskId} className="an-review-card">
              <header>
                <span className="truncate">{note.title}</span>
                {date ? (
                  <span className="an-n" style={{ marginLeft: "auto" }}>
                    {date}
                  </span>
                ) : null}
              </header>
              <div className="an-review-body">
                <p>{note.text}</p>
              </div>
            </article>
          )
        })
      )}
    </section>
  )
}

function PointsPlate({ summary }: { summary: CompletionReviewSummary }) {
  return (
    <section className="an-plate" data-testid="review-points">
      <p className="an-canvas-title">What the review earned</p>
      <p className="an-canvas-kicker">
        3 points for agreeing to the quick review, plus 0.1 per word in the notes. A word is a stretch of text between spaces. The same number is on the points ledger as Quick review.
      </p>
      <div className="an-readouts">
        <StudioReadout label="Done" value={summary.doneCount} note="in this window" />
        <StudioReadout label="Reviewed" value={summary.reviewedCount} note={`${summary.agreedCount} agreed to the quick review`} />
        <StudioReadout label="Words" value={summary.wordCount} />
        <StudioReadout label="Review points" value={formatReviewPoints(summary.reviewPoints)} note="3 + 0.1 per word" />
      </div>
    </section>
  )
}

export function CompletionReviewPlates({ summary }: { summary: CompletionReviewSummary }) {
  return (
    <>
      <PointsPlate summary={summary} />
      <ClockPlate summary={summary} />
      <DifficultyPlate summary={summary} />
      <FeelingsPlate summary={summary} />
      <NotesPlate summary={summary} />
      <GoalTexturePlate summary={summary} />
    </>
  )
}
