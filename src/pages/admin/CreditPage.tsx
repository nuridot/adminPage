import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { backoffice } from '@/api/backoffice/client'
import type { Json, Row } from '@/api/backoffice/types'
import { action } from '@/api/backoffice/actions'
import {
  ActionDialog,
  asRow,
  Details,
  rowsOf,
  textOf,
  valueLabels,
  type Action,
} from '@/components/Workflow'
import { Metric, number, PageHeading, Panel, timestamp } from '@/components/backoffice'
import { Query, Pagination } from '@/components/ui'

export function CreditPage() {
  const [search] = useSearchParams()
  const [query, setQuery] = useState('')
  const [low, setLow] = useState(search.get('low') === 'true')
  const [ownerType, setOwnerType] = useState('')
  const [tab, setTab] = useState('wallets')
  const [selected, setSelected] = useState<Row | null>(null)
  const [page, setPage] = useState(0)
  const [command, setCommand] = useState<Action | null>(null)
  const wallets = useQuery({
    queryKey: ['backoffice', 'wallets', ownerType],
    queryFn: () => backoffice.get<Json>('/api/admin/credit/wallets', { ownerType }),
  })
  const walletId = selected?.walletId == null ? '' : String(selected.walletId)
  const userId = selected?.ownerType === 'USER' ? String(selected.userId ?? '') : ''
  const plans = useQuery({
    queryKey: ['backoffice', 'credit-plans'],
    queryFn: () => backoffice.get<Json>('/api/admin/credit/plans'),
    enabled: !!userId,
  })
  const activePlans = rowsOf(plans.data).filter((p) => p.active === true)
  const subscription = useQuery({
    queryKey: ['backoffice', 'subscription', userId],
    queryFn: async () =>
      (await backoffice.get<Row | undefined>(
        `/api/admin/credit/users/${encodeURIComponent(userId)}/subscription`,
      )) ?? null,
    enabled: !!userId,
  })
  const ledger = useQuery({
    queryKey: ['backoffice', 'ledger', walletId, page],
    queryFn: () =>
      backoffice.get<Row>(`/api/admin/credit/wallets/${encodeURIComponent(walletId)}/ledger`, {
        page,
        size: 20,
      }),
    enabled: !!walletId,
  })
  const reconciliation = useQuery({
    queryKey: ['backoffice', 'reconciliation'],
    queryFn: () => backoffice.get<Row>('/api/admin/credit/reconciliation'),
    enabled: tab === 'reconciliation',
  })
  const filtered = rowsOf(wallets.data).filter(
    (w) =>
      (!low || w.lowBalance === true) &&
      (!search.get('organizationId') || w.organizationId === search.get('organizationId')) &&
      `${w.organizationName ?? ''} ${w.loginId ?? ''}`.toLowerCase().includes(query.toLowerCase()),
  )
  const selectWallet = (w: Row) => {
    setSelected(w)
    setPage(0)
  }
  return (
    <>
      <PageHeading
        title="크레딧 관리"
        description="계약분, 추가분, 예약, 가용량을 분리해 확인하고 원장과 연결해 처리합니다."
        actions={
          <div className="bo-actions">
            <Link to="/admin/orders" className="btn btn--primary">
              주문 · 입금 · 지급 →
            </Link>
            <Link to="/admin/billing" className="btn">
              청구 · 수금 →
            </Link>
          </div>
        }
      />
      <p className="bo-callout">
        원장은 장부·대사용 기록이며 사용 제한은 서비스 잔여 기준입니다. 잔여가 적으면 여러 작업도 한
        쪽씩 순서대로 변환해 느려질 수 있습니다. 결과를 받은 뒤 차감하므로 마지막 한 쪽에서 음수가
        될 수 있고, 잔여가 0 이하이면 다음 쪽부터 크레딧 부족으로 제한됩니다.
      </p>
      <div className="bo-tabs">
        <button className={tab === 'wallets' ? 'active' : ''} onClick={() => setTab('wallets')}>
          잔액 · 원장
        </button>
        <button
          className={tab === 'reconciliation' ? 'active' : ''}
          onClick={() => setTab('reconciliation')}
        >
          대사
        </button>
      </div>
      {tab === 'wallets' ? (
        <>
          <div className="bo-filters">
            <label>
              기관 · 계정 검색
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름으로 검색"
              />
            </label>
            <label>
              소유자
              <select
                value={ownerType}
                onChange={(e) => {
                  setOwnerType(e.target.value)
                  setSelected(null)
                }}
              >
                <option value="">전체</option>
                <option value="ORG">기관</option>
                <option value="USER">개인</option>
              </select>
            </label>
            <label>
              <input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} />
              부족 경고만
            </label>
            <button className="btn" onClick={() => void wallets.refetch()}>
              잔액 갱신
            </button>
          </div>
          <Query state={wallets}>
            {() => (
              <Panel title={`지갑 ${filtered.length}개`}>
                <div className="bo-table-wrap">
                  <table className="bo-table">
                    <thead>
                      <tr>
                        <th>기관 · 계정</th>
                        <th>계약분</th>
                        <th>추가분</th>
                        <th>예약</th>
                        <th>가용</th>
                        <th>관문 잔여</th>
                        <th>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((w) => (
                        <tr key={String(w.walletId)}>
                          <td>
                            <button
                              className="bo-text-link"
                              style={{ border: 0, background: 'none' }}
                              onClick={() => selectWallet(w)}
                            >
                              {textOf(w.organizationName ?? w.loginId)}
                            </button>
                          </td>
                          {[
                            'contractBalance',
                            'extraBalance',
                            'reserved',
                            'available',
                            'legacyRemaining',
                          ].map((k) => (
                            <td key={k}>{number(w[k] as number | null)}</td>
                          ))}
                          <td>
                            <span className={`bo-badge ${w.lowBalance ? 'warning' : ''}`}>
                              {w.lowBalance ? '부족' : '정상'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filtered.length && <p className="bo-empty">조건에 맞는 지갑이 없습니다.</p>}
                </div>
              </Panel>
            )}
          </Query>
          {selected && (
            <>
              <Panel
                title={`${textOf(selected.organizationName ?? selected.loginId)} · 지급 · 조정`}
                actions={
                  <div className="bo-actions">
                    <button
                      className="btn"
                      onClick={() =>
                        setCommand(
                          action(
                            '크레딧 수동 지급',
                            'POST',
                            '/api/admin/credit/wallets/{walletId}/grants',
                            { walletId },
                            {
                              required: ['amount', 'reason'],
                              idempotent: true,
                              fields: [
                                {
                                  key: 'amount',
                                  label: '지급 크레딧',
                                  type: 'number',
                                  step: 1,
                                  min: 1,
                                  required: true,
                                },
                                {
                                  key: 'reason',
                                  label: '지급 사유',
                                  type: 'textarea',
                                  required: true,
                                  maxLength: 300,
                                },
                                ...(selected.ownerType === 'USER'
                                  ? [
                                      {
                                        key: 'validUntil',
                                        label: '유효 종료일',
                                        type: 'date' as const,
                                      },
                                    ]
                                  : []),
                              ],
                              hint: `대상: ${textOf(selected.organizationName ?? selected.loginId)}. 주문 입금에 대한 지급이면 주문 지급 기능을 사용하세요.`,
                            },
                          ),
                        )
                      }
                    >
                      수동 지급
                    </button>
                    <button
                      className="btn"
                      onClick={() =>
                        setCommand(
                          action(
                            '크레딧 조정',
                            'POST',
                            '/api/admin/credit/wallets/{walletId}/adjustments',
                            { walletId },
                            {
                              required: ['amount', 'reason'],
                              idempotent: true,
                              fields: [
                                {
                                  key: 'amount',
                                  label: '조정 크레딧',
                                  type: 'number',
                                  step: 1,
                                  nonzero: true,
                                },
                                {
                                  key: 'reason',
                                  label: '조정 사유',
                                  type: 'textarea',
                                  maxLength: 300,
                                },
                              ],
                              hint: `대상: ${textOf(selected.organizationName ?? selected.loginId)}. 양수는 증가, 음수는 감소입니다.`,
                            },
                          ),
                        )
                      }
                    >
                      잔액 조정
                    </button>
                  </div>
                }
              >
                <div className="bo-metrics">
                  {[
                    ['계약분', 'contractBalance'],
                    ['추가분', 'extraBalance'],
                    ['미확정 예약', 'reserved'],
                    ['가용량', 'available'],
                  ].map(([label, key]) => (
                    <Metric key={key} label={label} value={number(selected[key] as number)} />
                  ))}
                </div>
                <p className="bo-muted">
                  가용량 = 유효 계약분 + 유효 추가분 − 예약 · 지급 결과에서 거래 번호와 이후 잔액을
                  확인합니다.
                </p>
              </Panel>
              <Query state={ledger}>
                {(l) => (
                  <Panel title="원장 거래 이력">
                    <div className="bo-table-wrap">
                      <table className="bo-table">
                        <thead>
                          <tr>
                            <th>시각</th>
                            <th>거래</th>
                            <th>잔액 변화</th>
                            <th>이전 → 이후</th>
                            <th>예약 이후</th>
                            <th>처리자 · 사유</th>
                            <th>연결 작업</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rowsOf(l).map((entry) => (
                            <tr key={String(entry.entryId)}>
                              <td>{timestamp(entry.createdAt as string)}</td>
                              <td>
                                {valueLabels[String(entry.entryType)] ?? textOf(entry.entryType)}
                                <small>
                                  #{textOf(entry.entryId)} · {textOf(entry.source)}
                                </small>
                              </td>
                              <td>{number(entry.balanceDelta as number)}</td>
                              <td>
                                {number(entry.balanceBefore as number | null)} →{' '}
                                {number(entry.balanceAfter as number | null)}
                              </td>
                              <td>{number(entry.reservedAfter as number)}</td>
                              <td>
                                {textOf(entry.actor)}
                                <small>{textOf(entry.reason)}</small>
                              </td>
                              <td>
                                {entry.jobId ? (
                                  <Link
                                    className="bo-text-link"
                                    to={`/admin/jobs/${encodeURIComponent(String(entry.jobId))}`}
                                  >
                                    작업 {textOf(entry.pageNo)}쪽 →
                                  </Link>
                                ) : (
                                  textOf(entry.sourceRef)
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!rowsOf(l).length && <p className="bo-empty">거래 내역이 없습니다.</p>}
                    </div>
                    <Pagination
                      currentPage={page + 1}
                      totalPages={Math.ceil(Number(l.totalElements ?? 0) / 20)}
                      onPageChange={(p) => setPage(p - 1)}
                    />
                  </Panel>
                )}
              </Query>
            </>
          )}
        </>
      ) : (
        <Query state={reconciliation}>
          {(r) => (
            <>
              <div className="bo-metrics">
                <Metric label="차감 쪽" value={number(r.deductedPages as number)} />
                <Metric label="확정 쪽" value={number(r.capturedPages as number)} />
                <Metric label="대사 보충" value={number(r.backfilledPages as number)} />
                <Metric label="열린 예약" value={number(r.heldReservations as number)} />
              </div>
              <Panel
                title="원장 대사 결과"
                actions={
                  <button className="btn" onClick={() => void reconciliation.refetch()}>
                    다시 확인
                  </button>
                }
                note={`기간 ${timestamp(r.from as string)} ~ ${timestamp(r.to as string)} · 기관 잔액과 묶음은 현재 기준`}
              >
                {['pageMismatches', 'balanceMismatches', 'lotMismatches'].map((k, i) => (
                  <div key={k}>
                    <h3>{['쪽별 차감·확정', '기관 잔액', '묶음 거래 합'][i]}</h3>
                    {rowsOf(r[k]).length ? (
                      rowsOf(r[k]).map((v, n) => <Details key={n} value={asRow(v)} />)
                    ) : (
                      <p className="bo-muted">불일치 없음</p>
                    )}
                  </div>
                ))}
              </Panel>
            </>
          )}
        </Query>
      )}
      {tab === 'wallets' && userId && (
        <Query state={subscription}>
          {(s) => (
            <Panel
              title="개인 회원 구독"
              note="결제 연동 없음 · 기존 구독은 기본적으로 다음 지급일부터 변경됩니다."
            >
              {s ? <Details value={s} /> : <p>등록된 구독이 없습니다.</p>}
              <button
                className="btn"
                onClick={() =>
                  setCommand(
                    action(
                      s ? '다음 지급 요금제 변경' : '개인 구독 등록',
                      'PUT',
                      '/api/admin/credit/users/{userId}/subscription',
                      { userId },
                      {
                        required: ['planCode'],
                        fields: [
                          {
                            key: 'planCode',
                            label: '요금제',
                            type: 'select',
                            options: activePlans.map((p) => String(p.code)),
                            optionLabels: Object.fromEntries(
                              activePlans.map((p) => [
                                String(p.code),
                                String(p.name) + ' · 월 ' + String(p.monthlyCredit) + ' 크레딧',
                              ]),
                            ),
                          },
                          ...(!s
                            ? [{ key: 'startsOn', label: '첫 지급 기준일', type: 'date' as const }]
                            : []),
                        ],
                        hint: s
                          ? '다음 지급일부터 변경됩니다. 서버의 즉시 차액 지급 정책이 활성화된 경우 업그레이드 차액이 바로 지급될 수 있습니다.'
                          : '오늘 이전 또는 오늘을 기준일로 정하면 첫 주기 크레딧이 즉시 지급됩니다.',
                      },
                    ),
                  )
                }
              >
                구독 설정
              </button>
            </Panel>
          )}
        </Query>
      )}
      {command && (
        <ActionDialog
          key={command.path + command.label}
          action={command}
          onClose={() => {
            setCommand(null)
            void wallets.refetch().then((r) => {
              if (selected)
                setSelected(rowsOf(r.data).find((w) => w.walletId === selected.walletId) ?? null)
            })
          }}
        />
      )}
    </>
  )
}
