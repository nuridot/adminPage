import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ActionDialog, dateTimeInput, prepareBody } from './Workflow'
import { action } from '@/api/backoffice/actions'
import { backoffice } from '@/api/backoffice/client'
import { contractTransitions, operationMessage, validateOperation } from '@/api/backoffice/rules'
import { Rate } from './backoffice'

afterEach(cleanup)
describe('business operation safeguards', () => {
  it('preserves nested contract terms and strips fields outside the request schema', () => {
    const command = action('계약', 'POST', '/api/admin/contracts', {}, { required: ['startDate'] })
    const result = prepareBody(command.fields!, {
      organizationId: 'org',
      status: 'ACTIVE',
      terms: { startDate: '2026-11-01', endDate: '2026-12-01', amountKrw: 0 },
    })
    expect(result).toEqual({
      organizationId: 'org',
      terms: { startDate: '2026-11-01', endDate: '2026-12-01', amountKrw: 0 },
    })
    expect(
      command.fields?.find((f) => f.key === 'terms')?.fields?.find((f) => f.key === 'startDate')
        ?.required,
    ).toBe(true)
  })
  it('serializes KST date/time once and keeps explicit unlink nulls and false values', () => {
    expect(dateTimeInput('2026-11-01T00:00:00Z')).toBe('2026-11-01T09:00')
    expect(
      prepareBody(
        [
          { key: 'publishAt', label: '시각', type: 'datetime-local' },
          { key: 'org', label: '기관', nullable: true },
          { key: 'shared', label: '공유', type: 'checkbox' },
        ],
        { publishAt: '2026-11-01T09:00', org: '', shared: false },
      ),
    ).toEqual({ publishAt: '2026-11-01T09:00:00+09:00', org: null, shared: false })
    expect(
      prepareBody([{ key: 'publishAt', label: '시각', type: 'datetime-local' }], {
        publishAt: '2026-11-01T00:00:00Z',
      }).publishAt,
    ).toBe('2026-11-01T00:00:00Z')
  })
  it('cannot skip from a contract draft directly to active', () => {
    expect(contractTransitions.DRAFT).not.toContain('ACTIVE')
    expect(contractTransitions.SIGNATURE_REQUESTED).toContain('SIGNED_RECEIVED')
    expect(contractTransitions.TERMINATED).toEqual([])
  })
  it('requires a termination reason and date and prevents incomplete credit or release commands', () => {
    expect(validateOperation('/api/admin/secrets', { reference: 'plain-secret-value' })).toContain(
      '비밀 원문 대신',
    )
    expect(validateOperation('/api/admin/secrets', { reference: '/service/prod/key' })).toBeNull()
    expect(validateOperation('/api/admin/contracts/id/status', { status: 'TERMINATED' })).toContain(
      '해지 사유',
    )
    expect(validateOperation('/api/admin/credit/wallets/id/grants', { amount: 1.5 })).toContain(
      '정수',
    )
    expect(
      validateOperation('/api/admin/releases', { targetScope: 'ORGS', targetOrgIds: [] }),
    ).toContain('대상 기관')
    expect(
      validateOperation('/api/admin/datasets/records', {
        cumulativeQuantity: 5,
        correctionReason: '감소 정정',
      }),
    ).toBeNull()
  })
  it('does not call mail acceptance delivery success', () => {
    expect(operationMessage({ status: 'SEND_FAILED' })).toContain('발송하지 못')
    expect(operationMessage({ status: 'SEND_UNCERTAIN' })).toContain('아직 확인되지')
    expect(operationMessage({ status: 'PROVIDER_ACCEPTED' })).toContain('도착 여부는 확인되지')
  })
  it('uses a stable request key on an uncertain idempotent retry', async () => {
    const mutate = vi
      .spyOn(backoffice, 'mutate')
      .mockRejectedValueOnce(new TypeError('연결 중단'))
      .mockResolvedValueOnce({ entryId: 1 })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ActionDialog
          action={action(
            '지급',
            'POST',
            '/api/admin/credit/wallets/{walletId}/grants',
            { walletId: 'wallet' },
            { idempotent: true, reviewOnly: true, initial: { amount: 10, reason: '시험' } },
          )}
          onClose={() => {}}
        />
      </QueryClientProvider>,
    )
    await user.click(screen.getByRole('button', { name: '확인 후 실행' }))
    await screen.findByText(/처리 결과를 확인하지 못/)
    await user.click(screen.getByRole('button', { name: '같은 요청 재확인' }))
    await screen.findByText('처리가 완료되었습니다.')
    expect(mutate.mock.calls[0].slice(0, 4)).toEqual(mutate.mock.calls[1].slice(0, 4))
    expect(mutate.mock.calls[0][3]).toBeTruthy()
  })
  it('disables retry after an uncertain non-idempotent operation', async () => {
    vi.spyOn(backoffice, 'mutate').mockRejectedValue(new TypeError('연결 중단'))
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ActionDialog
          action={{ label: '청구 발행', path: '/api/admin/billing/invoices', reviewOnly: true }}
          onClose={() => {}}
        />
      </QueryClientProvider>,
    )
    await user.click(screen.getByRole('button', { name: '확인 후 실행' }))
    await screen.findByText(/처리 결과를 확인하지 못/)
    expect(
      (screen.getByRole('button', { name: '같은 요청 재확인' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
  it('shows zero denominators as unavailable with the underlying counts', () => {
    render(<Rate value={{ rate: null, numerator: 0, denominator: 0 }} />)
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.getByText(/0 \/ 0 · 분모 없음/)).toBeTruthy()
  })
})
