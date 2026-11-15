import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { isMockApi } from '@/api'
import { backoffice } from '@/api/backoffice/client'
import type { OpsHome } from '@/api/backoffice/types'
import { Query } from '@/components/ui'
import { Metric, money, number, PageHeading, Panel, timestamp } from '@/components/backoffice'

export function opsTarget(link: string) {
  if (link.startsWith('/contracts/'))
    return `/admin/contracts/${encodeURIComponent(link.split('/')[2])}`
  if (link.startsWith('/billing/invoices/'))
    return `/admin/billing/invoices/${encodeURIComponent(link.split('/')[3])}`
  if (link.startsWith('/credit/orgs/'))
    return `/admin/credit?organizationId=${encodeURIComponent(link.split('/')[3])}`
  if (link.startsWith('/incidents/'))
    return `/admin/incidents/${encodeURIComponent(link.split('/')[2])}`
  if (link.startsWith('/secrets/'))
    return `/admin/security/secrets/${encodeURIComponent(link.split('/')[2])}`
  if (link.startsWith('/official-mail/threads/'))
    return `/admin/mail/${encodeURIComponent(link.split('/')[3])}`
  return '/admin/notifications'
}
const categories: Record<string, string> = {
  CONTRACT_EXPIRING: '계약 만료',
  RECEIVABLE_OVERDUE: '납기 초과',
  LOW_BALANCE: '크레딧 부족',
  INCIDENT: '장애 사건',
}
export function OpsHomePage() {
  const q = useQuery({
    queryKey: ['backoffice', 'home'],
    queryFn: () => backoffice.get<OpsHome>('/api/admin/ops/home'),
  })
  return (
    <>
      <PageHeading
        title="운영 홈"
        description="오늘 확인할 대상과 최근 처리 이력을 모았습니다."
        actions={
          <>
            <Link className="btn" to="/admin/insights/overview">
              인사이트 보기 ↗
            </Link>
            <button
              className="btn btn--primary"
              onClick={() => void q.refetch()}
              disabled={q.isFetching}
            >
              새로고침
            </button>
          </>
        }
      />
      {isMockApi && <p className="bo-demo">예시 데이터 · 실제 기관이나 운영 실적이 아닙니다.</p>}
      <Query state={q}>
        {(d) => (
          <>
            <p className="bo-muted">
              기준일 {d.asOf} · 갱신 {timestamp(d.generatedAt)}
            </p>
            <div className="bo-metrics five">
              <Link to="/admin/contracts?tab=expiring">
                <Metric
                  label={`${d.cards.contractExpiring.withinDays}일 내 계약 만료`}
                  value={`${number(d.cards.contractExpiring.organizationCount)}개 기관`}
                  note={`${number(d.cards.contractExpiring.contractCount)}건 · 계약 보기 →`}
                />
              </Link>
              <Link to="/admin/billing?tab=receivables">
                <Metric
                  label="납기 초과 미수"
                  value={`${number(d.cards.overdueReceivables.invoiceCount)}건`}
                  note={`${money(d.cards.overdueReceivables.outstandingAmount)} · 청구 보기 →`}
                  tone="attention"
                />
              </Link>
              <Link to="/admin/credit?low=true">
                <Metric
                  label="크레딧 부족"
                  value={`${number(d.cards.lowBalance.organizationCount)}개 기관`}
                  note={`가용 ${number(d.cards.lowBalance.thresholdCredits)} 미만 →`}
                />
              </Link>
              <Link to="/admin/mail?status=OPEN">
                <Metric
                  label="메일 응답 대기"
                  value={`${number(d.cards.mailAwaitingReply.threadCount)}개`}
                  note={`${d.cards.mailAwaitingReply.replyDueHours}시간 초과 ${d.cards.mailAwaitingReply.overdueThreadCount}건 →`}
                />
              </Link>
              <Link to="/admin/incidents">
                <Metric
                  label="미해결 장애"
                  value={`${number(d.cards.openIncidents.count)}건`}
                  note={`SEV1 ${number(d.cards.openIncidents.sev1Count)}건 →`}
                  tone={d.cards.openIncidents.sev1Count ? 'attention' : ''}
                />
              </Link>
            </div>
            <div className="bo-grid home">
              <Panel title="상태별 확인 대상" note="대상을 선택하면 해당 업무 상세로 이동합니다.">
                <div className="bo-table-wrap">
                  <table className="bo-table">
                    <thead>
                      <tr>
                        <th>분류</th>
                        <th>기관 · 대상</th>
                        <th>현재 상태</th>
                        <th>이동</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.items.map((item, i) => (
                        <tr key={`${item.category}-${item.targetId}-${i}`}>
                          <td>
                            <span
                              className={`bo-badge ${item.severity === 'SEV1' || item.category === 'RECEIVABLE_OVERDUE' ? 'warning' : ''}`}
                            >
                              {categories[item.category] ?? item.category}
                            </span>
                          </td>
                          <td>
                            {item.organizationName ?? item.label}
                            {item.organizationName && <small>{item.label}</small>}
                          </td>
                          <td>
                            {item.category === 'CONTRACT_EXPIRING'
                              ? `${item.days}일 후 만료`
                              : item.category === 'RECEIVABLE_OVERDUE'
                                ? `${item.days}일 초과 · ${money(item.value)}`
                                : item.category === 'LOW_BALANCE'
                                  ? `${number(item.value)} 크레딧`
                                  : `${item.severity ?? ''} · ${item.status}`}
                          </td>
                          <td>
                            <Link className="bo-text-link" to={opsTarget(item.link)}>
                              상세 →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!d.items.length && <p className="bo-empty">현재 확인할 대상이 없습니다.</p>}
                </div>
              </Panel>
              <Panel title="최근 운영 이력">
                <ol className="bo-timeline">
                  {d.recentActivities.map((a, i) => (
                    <li key={i}>
                      <time>{timestamp(a.occurredAt)}</time>
                      <strong>{a.action.replace(/_/g, ' ')}</strong>
                      <small>
                        {a.actorLoginId} · {a.success ? '완료' : '실패'}
                      </small>
                    </li>
                  ))}
                </ol>
                {!d.recentActivities.length && (
                  <p className="bo-empty">아직 처리 이력이 없습니다.</p>
                )}
                <Link className="bo-text-link" to="/admin/security?tab=audit">
                  감사 이력 전체 보기 →
                </Link>
              </Panel>
            </div>
            <Panel title="공식 메일 연결">
              <p className={d.cards.mailAwaitingReply.syncErrorAt ? 'error-box' : 'bo-muted'}>
                마지막 동기화 {timestamp(d.cards.mailAwaitingReply.lastSyncedAt)}
                {d.cards.mailAwaitingReply.syncErrorAt &&
                  ` · 오류 발생 ${timestamp(d.cards.mailAwaitingReply.syncErrorAt)}`}
              </p>
            </Panel>
          </>
        )}
      </Query>
    </>
  )
}
