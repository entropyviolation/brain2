/**
 * components/Home/ToDo/phone/phone-overlays.tsx — Dialogs the phone page mounts inside `TodoMobile`.
 */
import JustStartMode from "@/components/Focus/JustStartMode"
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"
import { MissReasonDialog } from "@/components/Reviews/MissReasonDialog"
import { RitualWalkDialog } from "@/components/Reviews/RitualWalkDialog"
import { SessionPlanner } from "../SessionPlanner"
import { TaskCard } from "../task-card/TaskCard"
import { TaskPrereqDialog } from "../ledger/TaskPrereqDialog"
import type { PhonePageModel } from "./use-phone-page"

/** A fragment, so `TodoMobile` gains no wrapper node around these dialogs. */
export function PhoneOverlays({ model }: { model: PhonePageModel }) {
  const {
    clockStop,
    selectedTaskId,
    setSelectedTaskId,
    ritualWalk,
    setRitualWalk,
    reasonAsk,
    setReasonAsk,
    taskClock,
    taskCardHost,
    prereqTaskId,
    setPrereqTaskId,
    sessionOpen,
    setSessionOpen,
    sessionPeriod,
    justStartTaskId,
    setJustStartTaskId,
  } = model
  return (
    <>
      {clockStop.dialog}
      <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      <RitualWalkDialog placement={ritualWalk} onClose={() => setRitualWalk(null)} />
      <MissReasonDialog
        open={reasonAsk !== null}
        subject={reasonAsk?.subject ?? ""}
        onResolve={(reason) => {
          const apply = reasonAsk?.apply
          setReasonAsk(null)
          apply?.(reason)
        }}
      />
      {taskClock.picker}
      <TaskCard host={taskCardHost} />
      <TaskPrereqDialog taskId={prereqTaskId} onClose={() => setPrereqTaskId(null)} />
      {sessionOpen ? (
        <SessionPlanner
          open
          startOn={sessionOpen}
          onClose={() => setSessionOpen(false)}
          periodLabel={sessionPeriod.label}
          periodTasks={sessionPeriod.tasks}
        />
      ) : null}
      {justStartTaskId && <JustStartMode taskId={justStartTaskId} onClose={() => setJustStartTaskId(null)} />}
    </>
  )
}
