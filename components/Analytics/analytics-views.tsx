/**
 * components/Analytics/analytics-views.tsx — One chunk per Analytics view
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
  habits: view(() => import("./HabitsView").then((m) => ({ default: m.HabitsView }))),
  points: view(() => import("./PointsView").then((m) => ({ default: m.PointsView }))),
  velocity: view(() => import("./VelocityView").then((m) => ({ default: m.VelocityView }))),
  tracking: view(() => import("./TrackingAnalytics").then((m) => ({ default: m.TrackingAnalytics }))),
  sleep: view(() => import("./SleepAnalytics").then((m) => ({ default: m.SleepAnalytics }))),
  screentime: view(() => import("./ScreenTimeView").then((m) => ({ default: m.ScreenTimeView }))),
  circadian: view(() => import("./CircadianView").then((m) => ({ default: m.CircadianView }))),
  places: view(() => import("./PlacesView").then((m) => ({ default: m.PlacesView }))),
  "mood-field": view(() => import("./MoodFieldView").then((m) => ({ default: m.MoodFieldView }))),
  diversity: view(() => import("./DiversityView").then((m) => ({ default: m.DiversityView }))),
  transitions: view(() => import("./TransitionsView").then((m) => ({ default: m.TransitionsView }))),
  plan: view(() => import("./PlanVsReality").then((m) => ({ default: m.PlanVsReality }))),
  calibration: view(() => import("./CalibrationView").then((m) => ({ default: m.CalibrationView }))),
  cycle: view(() => import("./CycleView").then((m) => ({ default: m.CycleView }))),
  streaks: view(() => import("./StreaksWidget").then((m) => ({ default: m.StreaksWidget }))),
  reflection: view(() => import("./ReflectionView").then((m) => ({ default: m.ReflectionView }))),
  "todo-pulse": view(() => import("./TodoPulseView").then((m) => ({ default: m.TodoPulseView }))),
  reviews: view(() => import("./ReviewsView").then((m) => ({ default: m.ReviewsView }))),
  seasons: view(() => import("./SeasonsView").then((m) => ({ default: m.SeasonsView }))),
  metrics: view(() => import("./MetricsTrends").then((m) => ({ default: m.MetricsTrends }))),
  correlation: view(() => import("./CorrelationExplorer").then((m) => ({ default: m.CorrelationExplorer }))),
  spectrum: view(() => import("./SpectrumView").then((m) => ({ default: m.SpectrumView }))),
  "research-report": view(() => import("./ResearchReportView").then((m) => ({ default: m.ResearchReportView }))),
  "context-switch": view(() => import("./ContextSwitchHeatmap").then((m) => ({ default: m.ContextSwitchHeatmap }))),
  "text-events": view(() => import("./TextPipelineView").then((m) => ({ default: m.TextEventsView }))),
  "text-spans": view(() => import("./TextPipelineView").then((m) => ({ default: m.TextSpansView }))),
  log: view(() => import("./LogEventsView").then((m) => ({ default: m.LogEventsView }))),
  "cycle-phase": view(() => import("./CyclePhaseView").then((m) => ({ default: m.CyclePhaseView }))),
  regret: view(() => import("./RegretView").then((m) => ({ default: m.RegretView }))),
  overcommit: view(() => import("./OvercommitmentView").then((m) => ({ default: m.OvercommitmentView }))),
  observatory: view(() => import("./Observatory").then((m) => ({ default: m.Observatory }))),
  "cross-section": view(() => import("./CrossSection").then((m) => ({ default: m.CrossSection }))),
  goals: view(() => import("./GoalsAnalytics").then((m) => ({ default: m.GoalsAnalytics }))),
  operations: view(() => import("./OperationsAnalytics").then((m) => ({ default: m.OperationsAnalytics }))),
  "item-types": view(() => import("./ItemTypesLibrary").then((m) => ({ default: m.ItemTypesLibrary }))),
  "lists-areas": view(() => import("./ListsAreasView").then((m) => ({ default: m.ListsAreasView }))),
  attributes: view(() => import("./AttributesView").then((m) => ({ default: m.AttributesView }))),
  tags: view(() => import("./LibraryCuts").then((m) => ({ default: m.TagsView }))),
  stages: view(() => import("./LibraryCuts").then((m) => ({ default: m.StagesView }))),
  weight: view(() => import("./LibraryCuts").then((m) => ({ default: m.WeightView }))),
}
