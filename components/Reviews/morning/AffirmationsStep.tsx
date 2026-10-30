/**
 * components/Reviews/morning/AffirmationsStep.tsx — Five affirmation plaques.
 *
 * Speak them, Shuffle, and Edit the list stay buttons here. The spoken dialog
 * is a sibling of the shell, not this step.
 */
import { ListChecks, Mic, Shuffle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { affirmationKey } from "@/lib/affirmation-lenses"
import { AFFIRMATIONS_LIST_NAME } from "@/lib/affirmations"

export function AffirmationsStep({
  shownAffirmations,
  saidToday,
  dayKey,
  recite,
  undoRecite,
  onSpeak,
  onShuffle,
  onEditList,
}: {
  shownAffirmations: string[]
  saidToday: Map<string, number>
  dayKey: string
  recite: (line: string, dayKey: string, source: "ritual") => void
  undoRecite: (line: string, dayKey: string) => void
  onSpeak: () => void
  onShuffle: () => void
  onEditList: () => void
}) {
  return (
    <>
      <p className="mr-lede">
        Five lines drawn from your Lists → {AFFIRMATIONS_LIST_NAME} list. Shuffle for a new five; the five
        you keep are saved for today.
      </p>
      <ol className="mr-affirm-list" key={shownAffirmations.join("|")}>
        {shownAffirmations.map((line, i) => {
          const said = saidToday.get(affirmationKey(line)) ?? 0
          return (
            <li key={i}>
              <span className="mr-affirm-line">{line}</span>
              <button
                type="button"
                className={said ? "mr-affirm-said is-on" : "mr-affirm-said"}
                aria-label={said ? `Said ${said} today; log once more` : "Log that I said it"}
                title={said ? `Said ${said}× today. Click to log again, Alt-click to undo.` : "Said it: log one recitation"}
                onClick={(event) =>
                  event.altKey ? undoRecite(line, dayKey) : recite(line, dayKey, "ritual")
                }
              >
                {said ? `✓${said > 1 ? said : ""}` : "✓"}
              </button>
            </li>
          )
        })}
      </ol>
      <div className="mr-affirm-tools">
        <Button type="button" className="hpp-key-go gap-1.5 h-8" size="sm" onClick={onSpeak}>
          <Mic className="h-3.5 w-3.5" />
          Speak them
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8" onClick={onShuffle}>
          <Shuffle className="h-3.5 w-3.5" />
          Shuffle
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8" onClick={onEditList}>
          <ListChecks className="h-3.5 w-3.5" />
          Edit the list
        </Button>
      </div>
    </>
  )
}
