"use client"

import type React from "react"
import type { TaskCategory, Task } from "@/lib/types"
import type { GridEntry, SmartId } from "@/components/Lists/types"
import { FolderGlyph, iconFor, orbFor } from "@/components/Lists/lib/icon-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Trash,
  Calendar,
  Check,
  Settings,
  Plus,
  GripVertical,
  AlertTriangle,
  Star,
  Eye,
} from "lucide-react"
import { safeDateFormat } from "@/lib/date-utils"

export interface FolderViewCardsProps {
  entries: GridEntry[]
  categories: TaskCategory[]
  selectMode: boolean
  selectedCategories: string[]
  addingTaskToTarget: string | null
  newTaskDescription: string
  getSmartTasks: (id: SmartId) => Task[]
  getTasksForCategory: (id: string) => Task[]
  getCategoryCompletionRate: (id: string) => number
  itemLabelFor: (id?: string, category?: TaskCategory) => string
  handleDragOver: (e: React.DragEvent) => void
  handleDropOnEntry: (e: React.DragEvent, entry: GridEntry) => void
  handleCategoryDragStart: (e: React.DragEvent, id: string) => void
  handleTaskDragStart: (e: React.DragEvent, task: Task) => void
  clearDrag: () => void
  openEntry: (entry: GridEntry) => void
  setSelectedCategories: React.Dispatch<React.SetStateAction<string[]>>
  setSelectedTaskId: (id: string) => void
  setAddingTaskToTarget: (id: string | null) => void
  setEditingCategory: (category: TaskCategory) => void
  deleteCategory: (id: string) => void
  setNewTaskDescription: (value: string) => void
  handleAddTaskToCategory: (categoryId: string) => void
  handleCompleteTask: (taskId: string) => void
}

export function FolderViewCards({
  entries,
  categories,
  selectMode,
  selectedCategories,
  addingTaskToTarget,
  newTaskDescription,
  getSmartTasks,
  getTasksForCategory,
  getCategoryCompletionRate,
  itemLabelFor,
  handleDragOver,
  handleDropOnEntry,
  handleCategoryDragStart,
  handleTaskDragStart,
  clearDrag,
  openEntry,
  setSelectedCategories,
  setSelectedTaskId,
  setAddingTaskToTarget,
  setEditingCategory,
  deleteCategory,
  setNewTaskDescription,
  handleAddTaskToCategory,
  handleCompleteTask,
}: FolderViewCardsProps) {
  return (
    <div className="fm-sunken fm-cards">
      <div
        className="fm-cards-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 20, alignItems: "start" }}
      >
        {entries
          .filter((e) => e.kind === "habits")
          .map((entry) => (
            <Card key={entry.id} className="cursor-pointer card-hover" onClick={() => openEntry(entry)}>
              <CardHeader className="pb-3 flex flex-row items-center gap-3">
                <img src={orbFor(entry.id)} alt="" className="w-8 h-8 object-contain" />
                <div>
                  <CardTitle className="text-lg">{entry.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">Daily habit tracking</p>
                </div>
              </CardHeader>
            </Card>
          ))}
        {entries
          .filter((e) => e.kind === "smart")
          .map((entry) => {
            const smartTasks = getSmartTasks(entry.id as SmartId)
            return (
              <Card key={entry.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <img src={orbFor(entry.id)} alt="" className="w-7 h-7 object-contain" />
                      <div>
                        <CardTitle className="text-lg">{entry.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{smartTasks.length} due</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEntry(entry)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2 max-h-64 overflow-y-auto">
                  {smartTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nothing scheduled for this period.</p>
                  ) : (
                    smartTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <p className="text-sm font-medium truncate">{task.description}</p>
                        {task.estimatedDuration != null && (
                          <span className="text-xs text-muted-foreground">{task.estimatedDuration}m</span>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )
          })}
        {entries
          .filter((e) => e.kind === "folder")
          .map((entry) => (
            <Card
              key={entry.id}
              className="cursor-pointer card-hover"
              onClick={() => openEntry(entry)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropOnEntry(e, entry)}
            >
              <CardHeader className="pb-3 flex flex-row items-center gap-3">
                <FolderGlyph size={32} color={entry.color} />
                <div>
                  <CardTitle className="text-lg">{entry.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{entry.count} lists</p>
                </div>
              </CardHeader>
            </Card>
          ))}
        {entries
          .filter((e) => e.kind === "list")
          .map((entry) => {
            const category = categories.find((c) => c.id === entry.id)
            if (!category) return null
            const categoryTasks = getTasksForCategory(category.id)
            const completionRate = getCategoryCompletionRate(category.id)
            const isSelected = selectedCategories.includes(category.id)
            const itemLabel = itemLabelFor(category.id, category)
            return (
              <Card
                key={category.id}
                className={`overflow-hidden ${selectMode && isSelected ? "ring-2 ring-primary" : ""}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnEntry(e, entry)}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 flex-1">
                      {selectMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            setSelectedCategories((prev) =>
                              isSelected ? prev.filter((id) => id !== category.id) : [...prev, category.id],
                            )
                          }
                          className="mr-1"
                        />
                      )}
                      <img src={iconFor(category.id, category.icon)} alt="" className="w-7 h-7 object-contain" />
                      <div>
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                        {category.description && (
                          <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAddingTaskToTarget(category.id)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="List Settings"
                        onClick={() => setEditingCategory(category)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteCategory(category.id)}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <Badge variant="secondary">{categoryTasks.length} active {itemLabel.toLowerCase()}s</Badge>
                    <Badge variant="outline">{completionRate}% complete</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {addingTaskToTarget === category.id && (
                    <div className="mb-4 p-3 border rounded-md bg-muted/50">
                      <div className="space-y-2">
                        <Textarea
                          placeholder={`Enter ${itemLabel.toLowerCase()} description...`}
                          value={newTaskDescription}
                          onChange={(e) => setNewTaskDescription(e.target.value)}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleAddTaskToCategory(category.id)}>
                            Add {itemLabel}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setAddingTaskToTarget(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {categoryTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No active {itemLabel.toLowerCase()}s in this list</p>
                    ) : (
                      categoryTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer group transition-all duration-200 task-item"
                          draggable
                          onDragStart={(e) => handleTaskDragStart(e, task)}
                          onDragEnd={clearDrag}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">{task.description}</p>
                              </div>
                              <div className="flex gap-3 mt-1">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>Urgency {task.urgency}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Star className="h-3 w-3" />
                                  <span>Importance {task.importance}</span>
                                </div>
                                {task.scheduledDate && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {safeDateFormat(task.scheduledDate)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 focus-ring"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedTaskId(task.id)
                              }}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-green-600 hover:text-green-700 focus-ring"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCompleteTask(task.id)
                              }}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">This location is empty.</p>
        )}
      </div>
    </div>
  )
}
