/**
 * components/Operations/OperationFieldPlanPanels.tsx — Timeline / Locations / Plan
 *
 * The three optional "field plan" panels an operation can switch on. They mount
 * the shared itinerary stack against a per-operation backing module, created on
 * the first visit (`lib/operation-itinerary.ts`) — so an operation that never
 * enables them never grows a module:
 *
 *   - **Timeline** — day-by-day grid (travel days, shoot days, sprint days).
 *   - **Locations** — map + place lists for anywhere the operation touches ground.
 *   - **Plan** — long-form plan document.
 */
"use client"

import { useEffect, useMemo } from "react"
import { ItineraryDocumentView } from "@/components/Modules/workspace/itinerary/ItineraryDocumentView"
import { TripActivitiesView } from "@/components/Modules/workspace/itinerary/TripActivitiesView"
import { DocPlanView } from "@/components/Modules/workspace/itinerary/DocPlanView"
import { useModulesStore, type ModuleInstance, type ModuleView } from "@/lib/modules-store"
import {
  ensureOperationItineraryModule,
  operationItineraryViews,
} from "@/lib/operation-itinerary"
import { OPERATION_ATTR } from "@/lib/operation-types"
import type { Task } from "@/lib/types"

function useOperationFieldModule(operation: Task): ModuleInstance | null {
  const modules = useModulesStore((s) => s.modules)
  const linkedId = String(operation.attributes?.[OPERATION_ATTR.itineraryModuleId] ?? "").trim()

  const module = useMemo(() => {
    if (linkedId) {
      const byId = modules.find((m) => m.id === linkedId)
      if (byId) return byId
    }
    return modules.find((m) => m.config?.operationId === operation.id) ?? null
  }, [modules, linkedId, operation.id])

  useEffect(() => {
    if (!module) ensureOperationItineraryModule(operation.id)
  }, [operation.id, module])

  return module
}

function LoadingFieldPlan() {
  return (
    <p className="ops-hint py-8 text-center">Setting up field plan…</p>
  )
}

function stubView(kind: ModuleView["kind"], title: string, config: ModuleView["config"] = {}): ModuleView {
  return { id: `op-${kind}`, title, kind, config }
}

export function OperationTimelinePanel({
  operation,
  onOpenItem,
}: {
  operation: Task
  onOpenItem?: (id: string) => void
}) {
  const module = useOperationFieldModule(operation)
  if (!module) return <LoadingFieldPlan />

  const { timelineView } = operationItineraryViews(module)
  const view = timelineView ?? stubView("itinerary-doc", "Timeline")

  return (
    <div className="ops-deck">
      <div className="ops-deck-head">Timeline</div>
      <div className="ops-field-plan">
        <ItineraryDocumentView view={view} module={module} onOpenItem={onOpenItem} />
      </div>
    </div>
  )
}

export function OperationLocationsPanel({
  operation,
  onOpenItem,
}: {
  operation: Task
  onOpenItem?: (id: string) => void
}) {
  const module = useOperationFieldModule(operation)
  if (!module) return <LoadingFieldPlan />

  const placesId = module.config.placesCategoryId
  const { locationsView } = operationItineraryViews(module)
  const view =
    locationsView ??
    stubView("trip-map", "Locations", {
      categoryId: placesId,
      placesCategoryId: placesId,
    })

  return (
    <div className="ops-deck">
      <div className="ops-deck-head">Locations</div>
      <div className="ops-field-plan">
        <TripActivitiesView view={view} module={module} onOpenItem={onOpenItem} />
      </div>
    </div>
  )
}

export function OperationPlanDocPanel({ operation }: { operation: Task }) {
  const module = useOperationFieldModule(operation)
  if (!module) return <LoadingFieldPlan />

  const { planView } = operationItineraryViews(module)
  const view = planView ?? stubView("doc", "Plan", { docId: module.config.planDocId })

  return (
    <div className="ops-deck">
      <div className="ops-deck-head">Plan</div>
      <div className="ops-field-plan">
        <DocPlanView view={view} planDocId={module.config.planDocId} />
      </div>
    </div>
  )
}
