/**
 * components/Home/ToDo/desk/todo-desk-overlays.tsx — Dialogs on the desk
 *
 * A fragment, so these stay direct children of `.todo95`, after the dove plate.
 * The unfinished-stop dialog stays the first child of that root, in the desk
 * panel, because it sits ahead of the window.
 */
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"
import JustStartMode from "@/components/Focus/JustStartMode"
import { MissReasonDialog } from "@/components/Reviews/MissReasonDialog"
import { RitualWalkDialog } from "@/components/Reviews/RitualWalkDialog"
import { SessionPlanner } from "../SessionPlanner"
import { TaskCard } from "../TaskCard"
import { TaskPrereqDialog } from "../TaskPrereqDialog"
import type { TodoDesk } from "./use-todo-desk"

export function TodoDeskOverlays({ desk }: { desk: TodoDesk }) {
  return (
    <>
      <TaskDetailPopup taskId={desk.selectedTaskId} open={!!desk.selectedTaskId} onClose={() => desk.setSelectedTaskId(null)} />
      <RitualWalkDialog placement={desk.ritualWalk} onClose={() => desk.setRitualWalk(null)} />
      <MissReasonDialog
        open={desk.reasonAsk !== null}
        subject={desk.reasonAsk?.subject ?? ""}
        onResolve={(reason) => {
          const apply = desk.reasonAsk?.apply
          desk.setReasonAsk(null)
          apply?.(reason)
        }}
      />
      {desk.taskClock.picker}
      <TaskCard host={desk.taskCardHost} />
      <TaskPrereqDialog taskId={desk.prereqTaskId} onClose={() => desk.setPrereqTaskId(null)} />
      {desk.sessionOpen ? (
        <SessionPlanner
          open
          startOn={desk.sessionOpen}
          onClose={() => desk.setSessionOpen(false)}
          periodLabel={desk.sessionPeriod.label}
          periodTasks={desk.sessionPeriod.tasks}
        />
      ) : null}
      {desk.justStartTaskId && (
        <JustStartMode taskId={desk.justStartTaskId} onClose={() => desk.setJustStartTaskId(null)} />
      )}
    </>
  )
}
