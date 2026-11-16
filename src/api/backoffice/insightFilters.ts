export const layoutTypes = [
  'PAGE_LAYOUT_TEXT',
  'PAGE_LAYOUT_FORMULA',
  'PAGE_LAYOUT_TABLE',
  'PAGE_LAYOUT_VISUAL',
  'PAGE_LAYOUT_UNSPECIFIED',
] as const

export interface InsightFilters {
  from: string
  to: string
  orgId?: string
  layoutType?: string
}

export function insightParams(metric: string, filters: InsightFilters) {
  const params: Record<string, string> = {}
  if (metric !== 'credit-low') {
    params.from = filters.from
    params.to = filters.to
  }
  if (metric !== 'datasets' && filters.orgId) params.orgId = filters.orgId
  if (['ai-quality', 'attempt-success'].includes(metric) && filters.layoutType)
    params.layoutType = filters.layoutType
  return params
}

export function periodBoundary(value: string, end = false): Date | null {
  if (!/^20\d{2}-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = day
    ? new Date(Date.UTC(year, month - 1, day))
    : new Date(Date.UTC(year, end ? month : month - 1, end ? 0 : 1))
  if (day && date.toISOString().slice(0, 10) !== value) return null
  return date
}

export function validInsightPeriod(from: string, to: string) {
  const start = periodBoundary(from),
    end = periodBoundary(to, true)
  if (!start || !end) return false
  const days = (end.valueOf() - start.valueOf()) / 86400000
  return days >= 0 && days < 400
}
