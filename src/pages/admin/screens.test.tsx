import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { InsightsPage } from './InsightsPage'
import { OperationsPage } from './OperationsPage'
import { CreditPage } from './CreditPage'
import { MailPage } from './MailPage'
import { OpsHomePage } from './OpsHomePage'
import { ErrorBoundary } from '@/components/ErrorBoundary'
afterEach(cleanup)

const cases = [
  ['/admin/home', '운영 홈'],
  ['/admin/credit', '크레딧 관리'],
  ['/admin/mail', '공식 메일'],
  ['/admin/contracts', '계약 · 갱신'],
  ['/admin/contracts?tab=expiring', '계약 · 갱신'],
  ['/admin/billing', '청구 · 수금'],
  ['/admin/billing?tab=payments', '청구 · 수금'],
  ['/admin/billing?tab=receivables', '청구 · 수금'],
  ['/admin/documents?tab=tax-invoices', '정산 문서'],
  ['/admin/orders', '크레딧 주문 · 지급'],
  ['/admin/sales', '영업 기회'],
  ['/admin/releases', '버전 · 릴리즈'],
  ['/admin/incidents', '장애 사건'],
  ['/admin/datasets', '데이터셋 현황'],
  ['/admin/security', '보안 · 설정'],
  ['/admin/security?tab=audit', '보안 · 설정'],
  ['/admin/notifications', '운영 알림함'],
  ...Object.entries({
    overview: '종합 현황',
    revenue: '매출 · 계약',
    usage: '사용 · 작업 퍼널',
    quality: 'AI 품질 · 교정',
    retention: '유지 · 작업 시간',
    datasets: '데이터셋 추이',
  }).map(([key, title]) => [`/admin/insights/${key}`, title]),
]
it.each(cases)('%s renders its API example without a runtime error', async (path, title) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ErrorBoundary>
          <Routes>
            <Route path="/admin/home" element={<OpsHomePage />} />
            <Route path="/admin/credit" element={<CreditPage />} />
            <Route path="/admin/mail" element={<MailPage />} />
            <Route path="/admin/insights/:section" element={<InsightsPage />} />
            <Route path="/admin/*" element={<OperationsPage />} />
          </Routes>
        </ErrorBoundary>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(client.isFetching()).toBe(0))
  expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy()
  expect(
    client
      .getQueryCache()
      .getAll()
      .filter((q) => q.state.status === 'error'),
  ).toHaveLength(0)
  expect(screen.queryAllByRole('alert')).toHaveLength(0)
  client.clear()
})
