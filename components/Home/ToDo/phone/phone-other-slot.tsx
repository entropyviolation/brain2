/**
 * components/Home/ToDo/phone/phone-other-slot.tsx — The Other lens range well. The node is the `div`, not a wrapper.
 */
import { completeTask } from "@/lib/services/completion-service"
import { TodoRangeNav, TodoRangeSheet } from "../TodoRangeSheet"

/** Same node the phone page passes as `other`. Completion here calls `completeTask` directly. */
export function phoneOtherSlot(openTask: (todoId: string) => void) {
  return (
    <div className="todo95 todo-ios-wells">
      <TodoRangeNav />
      <TodoRangeSheet onOpenTask={openTask} onComplete={(id) => completeTask(id)} />
    </div>
  )
}
