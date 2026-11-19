import type { Basis, Ratio } from './types'

export interface CollectedMetric {
  basis: Basis
  collectedFrom: string | null
}
export interface WorkFunnel extends CollectedMetric {
  openedSessions: number
  ai: {
    attempted: number
    converted: number
    saved: number
    completed: number
    attemptRate: Ratio
    convertRate: Ratio
    saveRate: Ratio
    completeRate: Ratio
  }
  noAi: { sessions: number; saved: number; completed: number; saveRate: Ratio; completeRate: Ratio }
  completedSessions: number
  completionAwaitingSave: number
  inProgressSessions: number
  stalledSessions: number
  inProgressHours: number
  exportedSessions: number
  exportRate: Ratio
  jobLink: { jobs: number | null; linkedJobs: number | null; linkRate: Ratio | null }
}
export type OperationName = 'document_open_result' | 'save_result' | 'export_result'
export interface AppReliability extends CollectedMetric {
  recoveryWindowHours: number
  operations: {
    eventName: OperationName
    success: number
    failure: number
    cancelled: number
    failureRate: Ratio
    initialFailures: number
    recovered: number
    pendingRecovery: number
    recoveryRate: Ratio
  }[]
  errors: { eventName: OperationName; errorCode: string; failures: number }[]
}
export interface RevisionSummary {
  sessions: number
  targets: number
  comparable: number
  edited: number
  baselineMissing: number
  unsupported: number
  notObserved: number
  correctionRatio: Ratio
  netEditRate: Ratio
  observationRate: Ratio
  summaryMissing: number | null
}
export interface RevisionRate extends CollectedMetric {
  aiRevision: {
    representation: 'text'
    allSessions: RevisionSummary
    completedSessions: RevisionSummary
  }
  engineRevision: {
    representation: 'braille'
    allSessions: RevisionSummary
    completedSessions: RevisionSummary
  }
}
export interface ActivityTime extends CollectedMetric {
  coverage: 'complete' | 'partial' | 'unavailable'
  totalActiveMs: number | null
  observedActiveMs: number | null
  completeSessionsTotalActiveMs: number
  sessions: {
    total: number
    complete: number
    partial: number
    unavailable: number
    clockSuspect: number
  }
  completeSessionActiveMs: { sessions: number; p50: number | null; p90: number | null }
  elapsedMs: { sessions: number; p50: number | null; p90: number | null }
}
export interface OrgRetention extends CollectedMetric {
  retentionWeeks: number[]
  weeks: {
    weekStart: string
    finished: boolean
    collected: boolean
    activeOrgs: number | null
    activeOrgsSoFar: number | null
    retention: { weeksAfter: number; targetWeekStart: string; retained: Ratio | null }[]
  }[]
}
