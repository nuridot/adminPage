import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { backoffice } from '@/api/backoffice/client'
import { validateMailAttachment } from '@/api/backoffice/mailAttachments'
import { validInsightPeriod } from '@/api/backoffice/insightFilters'
import { InsightsPage } from './InsightsPage'
import { MailPage } from './MailPage'
import type { Row } from '@/api/backoffice/types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/insights/:section" element={<InsightsPage />} />
          <Route path="/admin/mail" element={<MailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

it('scopes only supported endpoints when opening a shared dashboard filter URL', async () => {
  const get = vi.spyOn(backoffice, 'get')
  const client = mount(
    '/admin/insights/overview?from=2026-11-01&to=2026-11-16&orgId=org-test&layoutType=PAGE_LAYOUT_TABLE',
  )
  await waitFor(() => expect(client.isFetching()).toBe(0))
  const period = { from: '2026-11-01', to: '2026-11-16', orgId: 'org-test' }
  expect(get).toHaveBeenCalledWith('/api/admin/insights/revenue', period)
  expect(get).toHaveBeenCalledWith('/api/admin/insights/usage', { ...period, unit: 'month' })
  expect(get).toHaveBeenCalledWith('/api/admin/insights/credit-low', { orgId: 'org-test' })
  expect(get).toHaveBeenCalledWith('/api/admin/insights/ai-quality', {
    ...period,
    layoutType: 'PAGE_LAYOUT_TABLE',
  })
  expect(get).toHaveBeenCalledWith('/api/admin/insights/attempt-success', {
    ...period,
    layoutType: 'PAGE_LAYOUT_TABLE',
  })
  await userEvent.setup().selectOptions(screen.getByLabelText('사용 집계 단위'), 'week')
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith('/api/admin/insights/usage', { ...period, unit: 'week' }),
  )
  client.clear()
})

it('omits organization/layout filters for global datasets and handles unavailable typed processing time', async () => {
  const original = backoffice.get.bind(backoffice)
  const get = vi.spyOn(backoffice, 'get').mockImplementation(async (path, query) => {
    const data = await original<Row>(path, query)
    return path.endsWith('ai-quality') ? { ...data, processingTime: null } : (data as never)
  })
  const client = mount(
    '/admin/insights/datasets?from=2026-10&to=2026-11&orgId=org-test&layoutType=PAGE_LAYOUT_TABLE',
  )
  await waitFor(() => expect(client.isFetching()).toBe(0))
  expect(get).toHaveBeenCalledWith('/api/admin/insights/datasets', {
    from: '2026-10',
    to: '2026-11',
  })
  cleanup()
  client.clear()
  const retention = mount(
    '/admin/insights/retention?from=2026-10&to=2026-11&layoutType=PAGE_LAYOUT_TABLE',
  )
  await screen.findByText(/유형별로는 볼 수 없음/)
  expect(screen.queryByRole('alert')).toBeNull()
  retention.clear()
})

it('requires a new confirmation after uploading/removing an attachment and confirms exactly the displayed IDs', async () => {
  let draft: Row = {
    id: 'draft-test',
    status: 'CONFIRMED',
    subject: '첨부 테스트',
    toAddresses: ['test@example.org'],
    ccAddresses: [],
    bccAddresses: [],
    bodyText: '본문',
    attachments: [{ id: 'attachment-old', fileName: 'existing.pdf', sizeBytes: 100 }],
  }
  vi.spyOn(backoffice, 'get').mockImplementation(async (path) => {
    if (path.endsWith('sync-status')) return { enabled: true } as never
    if (path.endsWith('/drafts')) return [draft] as never
    if (path.endsWith('/draft-test')) return structuredClone(draft) as never
    return { content: [] } as never
  })
  const mutate = vi.spyOn(backoffice, 'mutate').mockImplementation(async (method, path) => {
    if (method === 'DELETE') draft = { ...draft, status: 'DRAFT', attachments: [] }
    else if (path.endsWith('/attachments'))
      draft = {
        ...draft,
        status: 'DRAFT',
        attachments: [{ id: 'attachment-new', fileName: 'new.txt', sizeBytes: 4 }],
      }
    else if (path.endsWith('/confirm')) draft = { ...draft, status: 'CONFIRMED' }
    return draft as never
  })
  const user = userEvent.setup()
  mount('/admin/mail')
  await user.click(screen.getByRole('button', { name: '초안 · 보낸 메일' }))
  await user.click(await screen.findByRole('button', { name: '첨부 테스트' }))
  await user.click(await screen.findByRole('button', { name: 'existing.pdf 삭제' }))
  await user.click(screen.getByRole('button', { name: '확인 후 실행' }))
  await screen.findByText('처리가 완료되었습니다.')
  await user.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: '닫기' })[0])
  expect(screen.queryByRole('button', { name: '발송' })).toBeNull()
  await user.click(screen.getByRole('button', { name: '+ 첨부파일 추가' }))
  await user.upload(
    screen.getByLabelText(/첨부파일 · 파일당/),
    new File(['data'], 'new.txt', { type: 'text/plain' }),
  )
  expect((screen.getByLabelText(/첨부파일 · 파일당/) as HTMLInputElement).files?.length).toBe(1)
  expect(
    (screen.getByRole('button', { name: '입력 내용 확인' }) as HTMLButtonElement).disabled,
  ).toBe(false)
  // jsdom's native required-file validity does not see user-event's synthetic FileList.
  fireEvent.submit(screen.getByRole('button', { name: '입력 내용 확인' }).closest('form')!)
  await user.click(screen.getByRole('button', { name: '확인 후 실행' }))
  await screen.findByText('처리가 완료되었습니다.')
  const upload = mutate.mock.calls.find(
    (call) => call[0] === 'POST' && call[1].endsWith('/attachments'),
  )!
  expect(upload[3]).toBeUndefined() // This API does not support idempotency keys.
  expect((upload[4]!.get('file') as File).name).toBe('new.txt')
  await user.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: '닫기' })[0])
  await user.click(screen.getByRole('button', { name: '발송 전 확인' }))
  expect(within(screen.getByRole('dialog')).getByText(/new.txt/)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: '확인 후 실행' }))
  await screen.findByText('처리가 완료되었습니다.')
  expect(mutate.mock.calls.find((call) => call[1].endsWith('/confirm'))![2]).toEqual({
    toAddresses: ['test@example.org'],
    ccAddresses: [],
    bccAddresses: [],
    subject: '첨부 테스트',
    bodyText: '본문',
    attachmentIds: ['attachment-new'],
  })
})

it('rejects invalid calendar periods and enforces current attachment limits including disguised executables', () => {
  expect(validInsightPeriod('2026-02-30', '2026-03-01')).toBe(false)
  expect(validInsightPeriod('2026-12', '2026-11')).toBe(false)
  expect(validInsightPeriod('2026-10', '2026-11-16')).toBe(true)
  expect(
    validateMailAttachment({ name: 'report.pdf', size: 10 * 1024 ** 2 }, [
      { sizeBytes: 7 * 1024 ** 2 },
    ]),
  ).toBeNull()
  expect(validateMailAttachment({ name: 'report.pdf', size: 10 * 1024 ** 2 + 1 }, [])).toContain(
    '10MB',
  )
  expect(
    validateMailAttachment({ name: 'report.pdf', size: 8 * 1024 ** 2 }, [
      { sizeBytes: 10 * 1024 ** 2 },
    ]),
  ).toContain('17MB')
  expect(
    validateMailAttachment(
      { name: 'report.pdf', size: 1 },
      Array.from({ length: 10 }, () => ({ sizeBytes: 1 })),
    ),
  ).toContain('10개')
  expect(validateMailAttachment({ name: 'safe.EXE. ', size: 1 }, [])).toContain('실행 파일')
  expect(validateMailAttachment({ name: 'empty.pdf', size: 0 }, [])).not.toBeNull()
})
