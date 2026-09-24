/**
 * components/Scheduler/SchedulerFilters.tsx — Available-tasks filters & sort
 *
 * Collapsible Filters & Sort for the Always inbox: scheduleable lists and
 * sort key/order. Furniture buttons, not Lucide identity.
 */
"use client"

import { useState } from "react"
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
  const [open, setOpen] = useState(false)
  const scheduleable = categories.filter((category) => scheduleableCategoryIds.has(category.id))

  return (
    <div className="sch-filters">
      <button type="button" className="sch-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Filters & Sort
      </button>
      {open && (
        <div className="sch-filters-body">
          <div>
            <div className="sch-label">Filter by Lists</div>
            <label className="sch-check-row">
              <input
                type="checkbox"
                checked={selectedCategories.length === 0}
                onChange={(e) => {
                  if (e.target.checked) setSelectedCategories([])
                }}
              />
              All lists
            </label>
            {scheduleable.map((category) => (
              <label key={category.id} className="sch-check-row">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category.id)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedCategories([...selectedCategories, category.id])
                    else setSelectedCategories(selectedCategories.filter((id) => id !== category.id))
                  }}
                />
                <span className="sch-swatch" style={{ backgroundColor: category.color }} />
                {category.name}
              </label>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
            <label style={{ flex: 1 }}>
              <div className="sch-label">Sort by</div>
              <select
                className="sch-address-field"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SchedulerSortBy)}
              >
                <option value="importance">Importance</option>
                <option value="duration">Duration</option>
                <option value="deadline">Deadline</option>
                <option value="reward">Reward</option>
                <option value="category">List</option>
              </select>
            </label>
            <button
              type="button"
              className="sch-btn sch-btn-icon"
              title={sortOrder === "asc" ? "Ascending" : "Descending"}
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
