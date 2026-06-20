"use client"

import { useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import { safeDateFormat } from "@/lib/date-utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar, CheckCircle2 } from "lucide-react"

export interface CompletedTasksDialogProps {
  open: boolean
  onClose: () => void
  onTaskSelect: (taskId: string) => void
}

export function CompletedTasksDialog({ open, onClose, onTaskSelect }: CompletedTasksDialogProps) {
  const allTasks = useTaskStore((state) => state.tasks)
  const categories = useTaskStore((state) => state.categories)

  const completedTasks = useMemo(
    () =>
      allTasks
        .filter((task) => task.completed)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [allTasks],
  )

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col fm98-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Completed Tasks ({completedTasks.length})
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {completedTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No completed tasks yet!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <Card
                  key={task.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    onTaskSelect(task.id)
                    onClose()
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium line-through text-muted-foreground">{task.description}</p>
                        <div className="flex gap-2 mt-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {safeDateFormat(task.createdAt)}
                          </div>
                          {task.actualDuration && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <CheckCircle2 className="h-3 w-3" />
                              {task.actualDuration}m
                            </div>
                          )}
                        </div>
                        {task.categories && task.categories.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {task.categories.slice(0, 3).map((categoryId) => {
                              const category = categories.find((c) => c.id === categoryId)
                              return category ? (
                                <Badge key={categoryId} variant="outline" className="text-xs">
                                  {category.name}
                                </Badge>
                              ) : null
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
