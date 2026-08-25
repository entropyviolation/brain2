/**
 * Operation itinerary + activities panels — mount the Trip Itinerary views
 * against a per-operation backing module (created on first visit).
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
    <p className="text-sm text-muted-foreground py-8 text-center">Setting up field plan…</p>
  )
}

function stubView(kind: ModuleView["kind"], title: string, config: ModuleView["config"] = {}): ModuleView {
  return { id: `op-${kind}`, title, kind, config }
}

export function OperationItineraryPanel({
  operation,
  onOpenItem,
}: {
  operation: Task
  onOpenItem?: (id: string) => void
}) {
  const module = useOperationFieldModule(operation)
  if (!module) return <LoadingFieldPlan />

  const { itineraryView } = operationItineraryViews(module)
  const view = itineraryView ?? stubView("itinerary-doc", "Itinerary")

  return (
    <div className="operation-field-plan min-h-[28rem]">
      <ItineraryDocumentView view={view} module={module} onOpenItem={onOpenItem} />
    </div>
  )
}

export function OperationActivitiesPanel({
  operation,
  onOpenItem,
}: {
  operation: Task
  onOpenItem?: (id: string) => void
}) {
  const module = useOperationFieldModule(operation)
  if (!module) return <LoadingFieldPlan />

  const placesId = module.config.placesCategoryId
  const { activitiesView } = operationItineraryViews(module)
  const view =
    activitiesView ??
    stubView("trip-map", "Activities", {
      categoryId: placesId,
      placesCategoryId: placesId,
    })

  return (
    <div className="operation-field-plan min-h-[28rem]">
      <TripActivitiesView view={view} module={module} onOpenItem={onOpenItem} />
    </div>
  )
}

export function OperationPlanDocPanel({ operation }: { operation: Task }) {
  const module = useOperationFieldModule(operation)
  if (!module) return <LoadingFieldPlan />

  const { planView } = operationItineraryViews(module)
  const view = planView ?? stubView("doc", "Plan", { docId: module.config.planDocId })

  return (
    <div className="operation-field-plan min-h-[28rem]">
      <DocPlanView view={view} planDocId={module.config.planDocId} />
    </div>
  )
}
