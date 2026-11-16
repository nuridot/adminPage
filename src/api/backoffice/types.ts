export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type Row = { [key: string]: Json }
export interface Ratio {
  numerator: number
  denominator: number
  rate: number | null
}
export interface Basis {
  generatedAt: string
  from: string
  to: string
  timezone: string
  filters?: InsightScope
}
export interface InsightScope {
  orgId: string | null
  orgName: string | null
  layoutType: string | null
}
export interface Revenue {
  basis: Basis
  current: {
    asOf: string
    mrrKrw: number
    activeContracts: number
    activeContractOrgs: number
    expiringWithinDays: number
    expiringContracts: number
  }
  months: {
    month: string
    snapshotDate: string
    mrrKrw: number
    activeContracts: number
    activeContractOrgs: number
    creditOrderPaidKrw: number
    creditOrderPaidCount: number
    paymentsReceivedKrw: number
    refundsKrw: number
    netReceivedKrw: number
  }[]
}
export interface Usage {
  basis: Basis
  unit: string
  buckets: {
    bucketStart: string
    conversionJobs: number
    textJobs: number
    conversionActiveAccounts: number
    conversionActiveOrgs: number
  }[]
  rolling: {
    last7Days: { conversionActiveAccounts: number; conversionActiveOrgs: number }
    last30Days: { conversionActiveAccounts: number; conversionActiveOrgs: number }
  }
}
export interface AttemptGroup {
  layoutType?: string | null
  fileKind?: string
  attemptSuccessRate: Ratio
  pageSuccessRate: Ratio
  aiBlockedAttempts: number
}
export interface Attempts {
  basis: Basis
  total: AttemptGroup
  byLayout: AttemptGroup[]
  byFileKind: AttemptGroup[]
  unknownLayoutByFileKind: AttemptGroup[]
  failures: {
    outcome: string
    errorKind: string | null
    category: string
    attempts: number
    share: Ratio
  }[]
  excluded: { allAttempts: number; notSentToAi: number; backpressure: number; shutdown: number }
}
export interface Quality {
  basis: Basis
  layoutTypes: {
    layoutType: string | null
    pages: number
    completed: number
    needsReview: number
    blocked: number
    completedRate: Ratio
    needsReviewRate: Ratio
    blockedRate: Ratio
  }[]
  textCorrection: {
    scope: string
    byType: { elementType: string; correctionRate: Ratio }[]
    total: { correctionRate: Ratio }
  }
  processingTime: {
    jobs: number
    p50Sec: number | null
    p90Sec: number | null
    avgSec: number | null
    maxSec: number | null
    perPageP50Sec: number | null
    buckets: { fromMinutes: number; toMinutes: number | null; jobs: number }[]
  } | null
}
export interface CollectionCohort {
  billingMonth: string | null
  invoices: number
  billedKrw: number
  collectedKrw: number
  outstandingKrw: number
  collectionRate: Ratio
}
export interface Collections {
  basis: Basis
  asOf: string
  cohorts: CollectionCohort[]
  total: CollectionCohort
  aging: {
    firstMaxDays: number
    secondMaxDays: number
    outstandingKrw: number
    buckets: { bucket: string; invoices: number; outstandingKrw: number }[]
  }
}
export interface OrderFunnel {
  basis: Basis
  ordered: { orders: number; amountKrw: number; credits: number }
  paid: { orders: number; amountKrw: number; credits: number }
  granted: { orders: number; amountKrw: number; credits: number }
  paidRate: Ratio
  grantedRate: Ratio
  paidNotGranted: number
}
export interface Datasets {
  basis: Basis
  units: {
    unit: string
    months: {
      month: string
      cumulative: number
      delta: number
      byDataset: { datasetName: string; cumulative: number; delta: number }[]
    }[]
  }[]
}
export interface LowCredit {
  filters?: InsightScope
  generatedAt: string
  timezone: string
  threshold: number
  organizationsChecked: number
  exhaustedOrganizations: number
  organizations: {
    organizationId: string
    name: string
    contractType: string
    allocated: number
    remaining: number
    exhausted: boolean
  }[]
}
export interface OpsHome {
  asOf: string
  generatedAt: string
  cards: {
    contractExpiring: { contractCount: number; organizationCount: number; withinDays: number }
    overdueReceivables: {
      invoiceCount: number
      organizationCount: number
      outstandingAmount: number
    }
    lowBalance: { organizationCount: number; thresholdCredits: number }
    mailAwaitingReply: {
      threadCount: number
      overdueThreadCount: number
      replyDueHours: number
      lastSyncedAt: string | null
      syncErrorAt: string | null
    }
    openIncidents: { count: number; sev1Count: number }
  }
  items: {
    category: string
    organizationId: string | null
    organizationName: string | null
    targetId: string
    label: string
    status: string
    date: string | null
    days: number | null
    value: number | null
    unit: string | null
    severity: string | null
    link: string
  }[]
  recentActivities: {
    occurredAt: string
    actorLoginId: string
    action: string
    targetType: string
    targetId: string
    success: boolean
  }[]
}
