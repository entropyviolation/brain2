/**
 * components/Analytics/chrome/analytics-views.tsx — One chunk per Data view
 *
 * The studio shell stays small. Opening Habits does not parse the chart
 * library behind Tracking, Sleep, or the Observatory.
 */
"use client"

import { lazy, type ComponentType, type LazyExoticComponent } from "react"
import type { AnalyticsTab } from "./analytics-tabs"

function view(load: () => Promise<{ default: ComponentType }>): LazyExoticComponent<ComponentType> {
  return lazy(load)
}

export const ANALYTICS_VIEWS: Record<AnalyticsTab, LazyExoticComponent<ComponentType>> = {
  habits: view(() => import("../behavior/HabitsView").then((m) => ({ default: m.HabitsView }))),
  points: view(() => import("../behavior/PointsView").then((m) => ({ default: m.PointsView }))),
  velocity: view(() => import("../behavior/VelocityView").then((m) => ({ default: m.VelocityView }))),
  tracking: view(() => import("../time/TrackingAnalytics").then((m) => ({ default: m.TrackingAnalytics }))),
  sleep: view(() => import("../time/SleepAnalytics").then((m) => ({ default: m.SleepAnalytics }))),
  screentime: view(() => import("../time/ScreenTimeView").then((m) => ({ default: m.ScreenTimeView }))),
  circadian: view(() => import("../time/CircadianView").then((m) => ({ default: m.CircadianView }))),
  places: view(() => import("../time/PlacesView").then((m) => ({ default: m.PlacesView }))),
  people: view(() => import("../time/PeopleView").then((m) => ({ default: m.PeopleView }))),
  "mood-field": view(() => import("../time/MoodFieldView").then((m) => ({ default: m.MoodFieldView }))),
  diversity: view(() => import("../time/DiversityView").then((m) => ({ default: m.DiversityView }))),
  transitions: view(() => import("../time/TransitionsView").then((m) => ({ default: m.TransitionsView }))),
  plan: view(() => import("../accuracy/PlanVsReality").then((m) => ({ default: m.PlanVsReality }))),
  calibration: view(() => import("../accuracy/CalibrationView").then((m) => ({ default: m.CalibrationView }))),
  cycle: view(() => import("../accuracy/CycleView").then((m) => ({ default: m.CycleView }))),
  streaks: view(() => import("../behavior/StreaksWidget").then((m) => ({ default: m.StreaksWidget }))),
  reflection: view(() => import("../behavior/ReflectionView").then((m) => ({ default: m.ReflectionView }))),
  "todo-pulse": view(() => import("../behavior/TodoPulseView").then((m) => ({ default: m.TodoPulseView }))),
  reviews: view(() => import("../behavior/ReviewsView").then((m) => ({ default: m.ReviewsView }))),
  seasons: view(() => import("../behavior/SeasonsView").then((m) => ({ default: m.SeasonsView }))),
  metrics: view(() => import("../meta/MetricsTrends").then((m) => ({ default: m.MetricsTrends }))),
  correlation: view(() => import("../meta/CorrelationExplorer").then((m) => ({ default: m.CorrelationExplorer }))),
  spectrum: view(() => import("../meta/SpectrumView").then((m) => ({ default: m.SpectrumView }))),
  "research-report": view(() => import("../meta/ResearchReportView").then((m) => ({ default: m.ResearchReportView }))),
  "context-switch": view(() => import("../time/ContextSwitchHeatmap").then((m) => ({ default: m.ContextSwitchHeatmap }))),
  "text-events": view(() => import("../time/TextPipelineView").then((m) => ({ default: m.TextEventsView }))),
  "text-spans": view(() => import("../time/TextPipelineView").then((m) => ({ default: m.TextSpansView }))),
  log: view(() => import("../time/LogEventsView").then((m) => ({ default: m.LogEventsView }))),
  "cycle-phase": view(() => import("../time/CyclePhaseView").then((m) => ({ default: m.CyclePhaseView }))),
  regret: view(() => import("../accuracy/RegretView").then((m) => ({ default: m.RegretView }))),
  overcommit: view(() => import("../behavior/OvercommitmentView").then((m) => ({ default: m.OvercommitmentView }))),
  observatory: view(() => import("../meta/Observatory").then((m) => ({ default: m.Observatory }))),
  "cross-section": view(() => import("../meta/CrossSection").then((m) => ({ default: m.CrossSection }))),
  goals: view(() => import("../accuracy/GoalsAnalytics").then((m) => ({ default: m.GoalsAnalytics }))),
  operations: view(() => import("../time/OperationsAnalytics").then((m) => ({ default: m.OperationsAnalytics }))),
  "texts-report": view(() => import("../TextsReportView").then((m) => ({ default: m.TextsReportView }))),
  "item-types": view(() => import("../library/ItemTypesLibrary").then((m) => ({ default: m.ItemTypesLibrary }))),
  "lists-areas": view(() => import("../library/ListsAreasView").then((m) => ({ default: m.ListsAreasView }))),
  attributes: view(() => import("../library/AttributesView").then((m) => ({ default: m.AttributesView }))),
  tags: view(() => import("../library/LibraryCuts").then((m) => ({ default: m.TagsView }))),
  stages: view(() => import("../library/LibraryCuts").then((m) => ({ default: m.StagesView }))),
  weight: view(() => import("../library/LibraryCuts").then((m) => ({ default: m.WeightView }))),
  browser: view(() => import("../sources/BrowserHistoryView").then((m) => ({ default: m.BrowserHistoryView }))),
  instagram: view(() => import("../sources/InstagramView").then((m) => ({ default: m.InstagramView }))),
}
