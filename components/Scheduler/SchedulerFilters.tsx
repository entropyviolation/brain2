/**
 * components/Scheduler/SchedulerFilters.tsx — Available-tasks filters & sort
 *
 * The collapsible "Filters & Sort" controls in the Scheduler's "Always" tab:
 * filter the available list by scheduleable lists and choose a sort key/order.
 */
"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Filter, ChevronDown, ArrowUpDown } from "lucide-react"
import type { List } from "@/lib/types"
import type { SchedulerSortBy, SchedulerSortOrder } from "./scheduler-utils"

export function SchedulerFilters({
  categories,
  scheduleableCategoryIds,
  selectedCategories,
  setSelectedCategories,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
}: {
  categories: List[]
  scheduleableCategoryIds: Set<string>
  selectedCategories: string[]
  setSelectedCategories: (ids: string[]) => void
  sortBy: SchedulerSortBy
  setSortBy: (v: SchedulerSortBy) => void
  sortOrder: SchedulerSortOrder
  setSortOrder: (v: SchedulerSortOrder) => void
}) {
  return (
    <div className="space-y-3">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between focus-ring">
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters & Sort
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Filter by Lists</Label>
            <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="all-categories"
                  checked={selectedCategories.length === 0}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedCategories([])
                  }}
                />
                <Label htmlFor="all-categories" className="text-sm">
                  All lists
                </Label>
              </div>
              {categories
                .filter((category) => scheduleableCategoryIds.has(category.id))
                .map((category) => (
                  <div key={category.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${category.id}`}
                      checked={selectedCategories.includes(category.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedCategories([...selectedCategories, category.id])
                        else setSelectedCategories(selectedCategories.filter((id) => id !== category.id))
                      }}
                    />
                    <Label htmlFor={`category-${category.id}`} className="text-sm flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                      {category.name}
                    </Label>
                  </div>
                ))}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs font-medium">Sort by</Label>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SchedulerSortBy)}>
                <SelectTrigger className="h-8 focus-ring">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="importance">Importance</SelectItem>
                  <SelectItem value="duration">Duration</SelectItem>
                  <SelectItem value="deadline">Deadline</SelectItem>
                  <SelectItem value="reward">Reward</SelectItem>
                  <SelectItem value="category">List</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 focus-ring"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              >
                <ArrowUpDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
