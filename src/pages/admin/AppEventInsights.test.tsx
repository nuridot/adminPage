import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { backoffice } from '@/api/backoffice/client'
import examples from '@/api/backoffice/demo.json'
import type {
  ActivityTime,
  OrgRetention,
  RevisionRate,
  WorkFunnel,
} from '@/api/backoffice/appEvents'
import { insightParams, validAppVersion } from '@/api/backoffice/insightFilters'
import { ActivityPanel, RetentionPanel, RevisionPanel, WorkFunnelPanel } from './AppEventInsights'
import { InsightsPage } from './InsightsPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
const sample = <T,>(metric: string) =>
  structuredClone((examples as Record<string, unknown>)[`/api/admin/insights/${metric}`]) as T

it.each([
  ['usage', ['work-funnel', 'app-reliability']],
  ['quality', ['revision-rate']],
  ['retention', ['activity-time', 'org-retention']],
] as const)(
  'requests %s event metrics with exact version and organization, without layout',
  async (section, metrics) => {
    const get = vi.spyOn(backoffice, 'get')
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter
          initialEntries={[
            `/admin/insights/${section}?from=2026-11-01&to=2026-11-19&orgId=org-test&layoutType=PAGE_LAYOUT_TABLE&appVersion=1.0.5%2Bwin`,
          ]}
        >
          <Routes>
            <Route path="/admin/insights/:section" element={<InsightsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await waitFor(() => expect(client.isFetching()).toBe(0))
    for (const name of metrics)
      expect(get).toHaveBeenCalledWith(`/api/admin/insights/${name}`, {
        from: '2026-11-01',
        to: '2026-11-19',
        orgId: 'org-test',
        appVersion: '1.0.5+win',
      })
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    client.clear()
  },
)

it('does not send appVersion to older server metrics and rejects malformed versions', () => {
  expect(
    insightParams('ai-quality', {
      from: '2026-11',
      to: '2026-11',
      layoutType: 'PAGE_LAYOUT_TABLE',
      appVersion: '1.0.5',
    }),
  ).toEqual({ from: '2026-11', to: '2026-11', layoutType: 'PAGE_LAYOUT_TABLE' })
  for (const invalid of [' 1.0', '_1', '가', 'a'.repeat(33), '1/2'])
    expect(validAppVersion(invalid)).toBe(false)
  for (const valid of ['', '1.0.5+win', 'v1-beta_2', 'a'.repeat(32)])
    expect(validAppVersion(valid)).toBe(true)
})

it('hides uncollected counts while keeping collected zeros visible', () => {
  const data = sample<WorkFunnel>('work-funnel')
  const view = render(<WorkFunnelPanel data={{ ...data, collectedFrom: null }} />)
  expect(screen.getByText('앱 이벤트 수집 기록이 없습니다')).toBeTruthy()
  expect(screen.queryByText('열기 성공 회차')).toBeNull()
  view.rerender(
    <WorkFunnelPanel
      data={{
        ...data,
        openedSessions: 0,
        jobLink: { jobs: null, linkedJobs: null, linkRate: null },
      }}
    />,
  )
  expect(screen.queryByText('앱 이벤트 수집 기록이 없습니다')).toBeNull()
  expect(within(screen.getByText('열기 성공 회차').parentElement!).getByText('0')).toBeTruthy()
  expect(
    within(screen.getByText('서버 작업 연결률').parentElement!).getByText('산출 불가'),
  ).toBeTruthy()
})

it('separates partial observed activity from totals and does not invent unavailable time', () => {
  const data = sample<ActivityTime>('activity-time')
  const view = render(<ActivityPanel data={data} />)
  expect(
    within(screen.getByText('전체 활동 시간').parentElement!).getByText('산출 불가'),
  ).toBeTruthy()
  expect(
    within(screen.getByText('관측된 활동 시간').parentElement!).getByText('2.3분'),
  ).toBeTruthy()
  view.rerender(
    <ActivityPanel
      data={{ ...data, coverage: 'unavailable', totalActiveMs: null, observedActiveMs: null }}
    />,
  )
  expect(screen.getByText('활동 구간 미수집')).toBeTruthy()
  expect(screen.queryByText('관측된 활동 시간')).toBeNull()
  expect(screen.getByText('시작~완료 경과 시간 중앙값 / P90')).toBeTruthy()
})

it('keeps AI and engine denominators separate and allows net edit rate over 100%', async () => {
  const data = sample<RevisionRate>('revision-rate')
  data.aiRevision.allSessions.netEditRate = { numerator: 240, denominator: 160, rate: 1.5 }
  render(<RevisionPanel data={data} />)
  const ai = screen.getByRole('region', { name: 'AI 원문 교정' })
  const engine = screen.getByRole('region', { name: '점역 엔진 점자 교정' })
  expect(within(ai).getByText('150%')).toBeTruthy()
  expect(within(engine).queryByText('150%')).toBeNull()
  await userEvent
    .setup()
    .selectOptions(screen.getByLabelText('교정 집계 대상'), 'completedSessions')
  expect(within(ai).queryByText('150%')).toBeNull()
  expect(within(ai).getByText('13.3%')).toBeTruthy()
  expect(screen.getByText('완료 시 저장본과 일치하는 요약만 집계합니다.')).toBeTruthy()
})

it('distinguishes pending and uncollected retention weeks from measured zero retention', () => {
  const data = sample<OrgRetention>('org-retention')
  data.weeks[1].retention[0].retained = { numerator: 0, denominator: 2, rate: 0 }
  render(<RetentionPanel data={data} />)
  const rows = screen.getAllByRole('row')
  expect(within(rows[1]).getByText('미수집')).toBeTruthy()
  expect(within(rows[1]).queryByText('0%')).toBeNull()
  expect(within(rows[2]).getByText('0%')).toBeTruthy()
  expect(within(rows[3]).getByText('현재까지 1')).toBeTruthy()
  expect(within(rows[3]).queryByText('0%')).toBeNull()
})
