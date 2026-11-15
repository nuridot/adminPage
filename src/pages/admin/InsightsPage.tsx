import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { backoffice } from '@/api/backoffice/client'
import { isMockApi } from '@/api'
import type {
  Attempts,
  Collections,
  Datasets,
  LowCredit,
  OrderFunnel,
  Quality,
  Revenue,
  Usage,
} from '@/api/backoffice/types'
import { Query } from '@/components/ui'
import {
  Bars,
  layoutLabel,
  Metric,
  money,
  number,
  PageHeading,
  Panel,
  percent,
  Rate,
  Source,
  timestamp,
  Trend,
  Uncollected,
} from '@/components/backoffice'

const titles: Record<string, string> = {
  overview: '종합 현황',
  revenue: '매출 · 계약',
  usage: '사용 · 작업 퍼널',
  quality: 'AI 품질 · 교정',
  retention: '유지 · 작업 시간',
  datasets: '데이터셋 추이',
}
const kstMonth = () =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
const dayEnd = (month: string) =>
  `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()}`
interface SalesFunnel {
  from: string
  to: string
  total: number
  inProgress: number
  won: number
  lost: number
  onHold: number
  stages: {
    name: string
    reached: number
    previousReached: number | null
    conversionRate: number | null
    dwell: {
      medianDays: number | null
      p90Days: number | null
      inProgressCount: number
      inProgressMedianDays: number | null
    }
  }[]
}

export function InsightsPage() {
  const { section = 'overview' } = useParams()
  const [search, setSearch] = useSearchParams()
  const now = kstMonth()
  const defaultFrom = new Date(`${now}-01T00:00:00Z`)
  defaultFrom.setUTCMonth(defaultFrom.getUTCMonth() - 2)
  const [from, setFrom] = useState(search.get('from') ?? defaultFrom.toISOString().slice(0, 7))
  const [to, setTo] = useState(search.get('to') ?? now)
  const valid =
    /^20\d{2}-(0[1-9]|1[0-2])$/.test(from) &&
    /^20\d{2}-(0[1-9]|1[0-2])$/.test(to) &&
    from <= to &&
    to <= now &&
    (+new Date(dayEnd(to)) - +new Date(`${from}-01`)) / 86400000 < 400
  const months = { from, to },
    days = { from: `${from}-01`, to: dayEnd(to) }
  const relevant = (...s: string[]) => valid && s.includes(section)
  const revenue = useQuery({
    queryKey: ['backoffice', 'revenue', months],
    queryFn: () => backoffice.get<Revenue>('/api/admin/insights/revenue', months),
    enabled: relevant('overview', 'revenue'),
  })
  const usage = useQuery({
    queryKey: ['backoffice', 'usage', days],
    queryFn: () => backoffice.get<Usage>('/api/admin/insights/usage', { ...days, unit: 'month' }),
    enabled: relevant('overview', 'usage'),
  })
  const quality = useQuery({
    queryKey: ['backoffice', 'quality', days],
    queryFn: () => backoffice.get<Quality>('/api/admin/insights/ai-quality', days),
    enabled: relevant('overview', 'quality', 'retention'),
  })
  const attempts = useQuery({
    queryKey: ['backoffice', 'attempts', days],
    queryFn: () => backoffice.get<Attempts>('/api/admin/insights/attempt-success', days),
    enabled: relevant('overview', 'quality'),
  })
  const low = useQuery({
    queryKey: ['backoffice', 'low'],
    queryFn: () => backoffice.get<LowCredit>('/api/admin/insights/credit-low'),
    enabled: relevant('overview'),
  })
  const collections = useQuery({
    queryKey: ['backoffice', 'collections', months],
    queryFn: () => backoffice.get<Collections>('/api/admin/insights/collections', months),
    enabled: relevant('revenue'),
  })
  const orders = useQuery({
    queryKey: ['backoffice', 'order-funnel', days],
    queryFn: () => backoffice.get<OrderFunnel>('/api/admin/insights/order-funnel', days),
    enabled: relevant('revenue'),
  })
  const sales = useQuery({
    queryKey: ['backoffice', 'sales-funnel', days],
    queryFn: () => backoffice.get<SalesFunnel>('/api/admin/sales/funnel', days),
    enabled: relevant('revenue'),
  })
  const datasets = useQuery({
    queryKey: ['backoffice', 'dataset-trends', months],
    queryFn: () => backoffice.get<Datasets>('/api/admin/insights/datasets', months),
    enabled: relevant('datasets'),
  })
  const filterLink = (s: string) => `/admin/insights/${s}?${new URLSearchParams(months)}`
  return (
    <>
      <PageHeading
        eyebrow="SEMOJUM / INSIGHTS"
        title={titles[section] ?? '종합 현황'}
        description="매출의 흐름, 기관의 사용, 제품의 품질을 한눈에 확인하세요."
        actions={<span className="bo-badge">조회 전용</span>}
      />
      <div className="bo-filters">
        <label>
          시작 월
          <input
            type="month"
            value={from}
            max={to}
            onChange={(e) => {
              setFrom(e.target.value)
              setSearch({ from: e.target.value, to }, { replace: true })
            }}
          />
        </label>
        <span>—</span>
        <label>
          종료 월
          <input
            type="month"
            value={to}
            min={from}
            max={now}
            onChange={(e) => {
              setTo(e.target.value)
              setSearch({ from, to: e.target.value }, { replace: true })
            }}
          />
        </label>
        <span className="bo-badge">전체 기관 · KST</span>
        <span className="bo-muted">각 카드의 집계 기준을 확인하세요.</span>
      </div>
      {!valid ? (
        <p role="alert" className="error-box">
          시작·종료 월을 확인해 주세요. 오늘까지 최대 400일 범위로 조회할 수 있습니다.
        </p>
      ) : (
        <>
          {isMockApi && (
            <p className="bo-demo">
              예시 데이터 · 실제 운영 수치가 아닙니다. 예시 기간은 카드에 표시되며 필터에 따라
              바뀌지 않습니다.
            </p>
          )}
          <div className={section === 'overview' ? 'bo-dashboard-grid' : 'bo-form'}>
            {(section === 'overview' || section === 'revenue') && (
              <Query state={revenue}>
                {(r) => (
                  <>
                    <div className="bo-metrics">
                      <Metric
                        label="현재 월정액 MRR"
                        value={money(r.current.mrrKrw)}
                        note={`${r.current.asOf} · 공급가 · 유효 계약 월정액 합`}
                      />
                      <Metric
                        label="유효 계약 기관"
                        value={`${number(r.current.activeContractOrgs)}개`}
                        note={`계약 ${number(r.current.activeContracts)}건 · 현재 기준`}
                      />
                      <Metric
                        label={`${r.current.expiringWithinDays}일 내 만료`}
                        value={`${number(r.current.expiringContracts)}건`}
                        note="유효 계약 기준"
                      />
                      <Metric
                        label="마지막 조회 월 · 추가 크레딧 입금"
                        value={
                          r.months.length
                            ? money(r.months[r.months.length - 1].creditOrderPaidKrw)
                            : '—'
                        }
                        note="부가세 포함 · 청구 입금과 합산하지 않음"
                      />
                    </div>
                    <Panel
                      title="매출 · 계약 건강도"
                      actions={
                        <Link className="bo-text-link" to={filterLink('revenue')}>
                          매출 상세 →
                        </Link>
                      }
                      note={
                        <Source
                          label="계약 이력 · 월말 스냅샷 (이번 달은 오늘) · 공급가"
                          basis={r.basis}
                        />
                      }
                    >
                      <Trend
                        label="월정액 MRR"
                        unit="원"
                        rows={r.months.map((m) => ({ label: m.month, value: m.mrrKrw }))}
                      />
                      {section === 'revenue' && (
                        <div className="bo-table-wrap">
                          <table className="bo-table">
                            <thead>
                              <tr>
                                <th>월 / 기준일</th>
                                <th>MRR</th>
                                <th>전월 대비</th>
                                <th>추가 주문 입금</th>
                                <th>청구 입금</th>
                                <th>환불</th>
                                <th>순입금</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.months.map((m, i) => (
                                <tr key={m.month}>
                                  <td>
                                    {m.month}
                                    <small>{m.snapshotDate}</small>
                                  </td>
                                  <td>{money(m.mrrKrw)}</td>
                                  <td>
                                    {i && r.months[i - 1].mrrKrw
                                      ? percent(
                                          (m.mrrKrw - r.months[i - 1].mrrKrw) /
                                            r.months[i - 1].mrrKrw,
                                        )
                                      : '—'}
                                  </td>
                                  <td>{money(m.creditOrderPaidKrw)}</td>
                                  <td>{money(m.paymentsReceivedKrw)}</td>
                                  <td>{money(m.refundsKrw)}</td>
                                  <td>{money(m.netReceivedKrw)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Panel>
                  </>
                )}
              </Query>
            )}
            {(section === 'overview' || section === 'usage') && (
              <Query state={usage}>
                {(u) => (
                  <Panel
                    title="제품 활성화 · 변환 기준"
                    note={
                      <Source
                        label="변환을 시작한 고유 계정·기관 (앱 접속 기준과 다름)"
                        basis={u.basis}
                      />
                    }
                    actions={
                      <Link className="bo-text-link" to={filterLink('usage')}>
                        사용 상세 →
                      </Link>
                    }
                  >
                    <div className="bo-metrics">
                      <Metric
                        label="최근 7일 활성 기관"
                        value={`${number(u.rolling.last7Days.conversionActiveOrgs)}개`}
                        note="현재 기준 · 변환 시작"
                      />
                      <Metric
                        label="최근 30일 활성 기관"
                        value={`${number(u.rolling.last30Days.conversionActiveOrgs)}개`}
                        note="현재 기준 · 고유 기관"
                      />
                      <Metric
                        label="최근 7일 활성 계정"
                        value={`${number(u.rolling.last7Days.conversionActiveAccounts)}명`}
                      />
                      <Metric
                        label="최근 30일 활성 계정"
                        value={`${number(u.rolling.last30Days.conversionActiveAccounts)}명`}
                      />
                    </div>
                    {section === 'usage' && (
                      <>
                        <Trend
                          label="변환 작업"
                          unit="건"
                          rows={u.buckets.map((b) => ({
                            label: b.bucketStart.slice(0, 7),
                            value: b.conversionJobs,
                          }))}
                        />
                        <Bars
                          rows={u.buckets.map((b) => ({
                            label: b.bucketStart,
                            value: b.textJobs,
                            detail: `글 작업 (AI 미사용) · 변환 활성 기관 ${number(b.conversionActiveOrgs)}개`,
                          }))}
                        />
                      </>
                    )}
                  </Panel>
                )}
              </Query>
            )}
            {section === 'overview' && (
              <Query state={low}>
                {(l) => (
                  <Panel
                    title="크레딧 부족 기관"
                    note={`현재 기준 · 관문 잔여 ${number(l.threshold)} 미만 · ${number(l.organizationsChecked)}개 기관 확인 · ${timestamp(l.generatedAt)}`}
                  >
                    <div className="bo-table-wrap">
                      <table className="bo-table">
                        <thead>
                          <tr>
                            <th>기관</th>
                            <th>계약 유형</th>
                            <th>관문 잔여</th>
                            <th>상태</th>
                          </tr>
                        </thead>
                        <tbody>
                          {l.organizations.map((o) => (
                            <tr key={o.organizationId}>
                              <td>{o.name}</td>
                              <td>{o.contractType}</td>
                              <td>{number(o.remaining)}</td>
                              <td>
                                <span className="bo-badge warning">
                                  {o.exhausted ? '소진' : '부족'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!l.organizations.length && (
                        <p className="bo-empty">부족한 기관이 없습니다.</p>
                      )}
                    </div>
                  </Panel>
                )}
              </Query>
            )}
            {(section === 'overview' || section === 'quality') && (
              <div className="bo-grid">
                <Query state={attempts}>
                  {(a) => (
                    <Panel
                      title="유형별 AI 시도 성공률"
                      note={
                        <Source
                          label="AI에 보낸 시도 · 재시도 포함 · 백프레셔/종료 제외"
                          basis={a.basis}
                        />
                      }
                      actions={
                        <Link className="bo-text-link" to={filterLink('quality')}>
                          품질 상세 →
                        </Link>
                      }
                    >
                      <Bars
                        percentScale
                        rows={a.byLayout.map((g) => ({
                          label: layoutLabel(g.layoutType),
                          value: g.attemptSuccessRate.rate,
                          detail: `${number(g.attemptSuccessRate.numerator)} / ${number(g.attemptSuccessRate.denominator)}회 · 쪽 기준 ${percent(g.pageSuccessRate.rate)} (${number(g.pageSuccessRate.numerator)}/${number(g.pageSuccessRate.denominator)})`,
                        }))}
                      />
                    </Panel>
                  )}
                </Query>
                <Query state={quality}>
                  {(q) => (
                    <Panel
                      title="글 요소 교정률"
                      note={
                        <Source
                          label="AI 정확도가 아닌 수정 빈도 · 비교 가능한 글 요소"
                          basis={q.basis}
                        />
                      }
                    >
                      <div className="bo-correction">
                        <div
                          className="bo-ring"
                          style={{
                            background: `conic-gradient(#169e91 ${(q.textCorrection.total.correctionRate.rate ?? 0) * 360}deg, #edf1f7 0)`,
                          }}
                        >
                          <span>{percent(q.textCorrection.total.correctionRate.rate)}</span>
                        </div>
                        <Rate value={q.textCorrection.total.correctionRate} />
                      </div>
                      <p className="bo-muted">{q.textCorrection.scope}</p>
                      <p className="bo-muted">
                        비교 관측률·순 편집량은 미수집입니다. 개인 평가에 사용하지 않습니다.
                      </p>
                    </Panel>
                  )}
                </Query>
              </div>
            )}
            {section === 'quality' && (
              <>
                <Query state={attempts}>
                  {(a) => (
                    <div className="bo-grid">
                      <Panel title="파일 종류별 성공률">
                        <Bars
                          percentScale
                          rows={a.byFileKind.map((g) => ({
                            label: g.fileKind ?? '유형 모름',
                            value: g.attemptSuccessRate.rate,
                            detail: `${g.attemptSuccessRate.numerator} / ${g.attemptSuccessRate.denominator}회`,
                          }))}
                        />
                      </Panel>
                      <Panel title="유형을 알 수 없는 시도">
                        <Bars
                          rows={a.unknownLayoutByFileKind.map((g) => ({
                            label: g.fileKind ?? '미분류',
                            value: g.attemptSuccessRate.denominator,
                            detail: `성공 ${g.attemptSuccessRate.numerator}회`,
                          }))}
                        />
                        <p className="bo-muted">
                          전체 {number(a.excluded.allAttempts)}회 · 미전송{' '}
                          {number(a.excluded.notSentToAi)} · 백프레셔{' '}
                          {number(a.excluded.backpressure)} · 배포 종료{' '}
                          {number(a.excluded.shutdown)}
                        </p>
                      </Panel>
                      <Panel title="실패 원인">
                        <Bars
                          rows={a.failures.map((f) => ({
                            label: `${f.category} · ${f.errorKind ?? f.outcome}`,
                            value: f.attempts,
                            detail: `${f.outcome} · 전체 분모 ${f.share.denominator}회 중 ${percent(f.share.rate)}`,
                          }))}
                        />
                      </Panel>
                    </div>
                  )}
                </Query>
                <Query state={quality}>
                  {(q) => (
                    <Panel title="쪽 결과 상태 분포 · 시도 성공률과 별도">
                      <div className="bo-table-wrap">
                        <table className="bo-table">
                          <thead>
                            <tr>
                              <th>유형</th>
                              <th>전체 쪽</th>
                              <th>완료</th>
                              <th>검토 필요</th>
                              <th>차단</th>
                            </tr>
                          </thead>
                          <tbody>
                            {q.layoutTypes.map((t, i) => (
                              <tr key={i}>
                                <td>{layoutLabel(t.layoutType)}</td>
                                <td>{number(t.pages)}</td>
                                <td>
                                  <Rate value={t.completedRate} />
                                </td>
                                <td>
                                  <Rate value={t.needsReviewRate} />
                                </td>
                                <td>
                                  <Rate value={t.blockedRate} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="bo-muted">
                        끝내 결과를 받지 못한 시도는 이 분포에 포함되지 않습니다.
                      </p>
                    </Panel>
                  )}
                </Query>
              </>
            )}
            {section === 'revenue' && (
              <>
                <Query state={collections}>
                  {(c) => (
                    <>
                      <Panel
                        title="수금 · 미수"
                        note={
                          <Source
                            label="같은 청구 월의 유효 청구와 배분된 입금 · 부가세 포함"
                            basis={c.basis}
                          />
                        }
                      >
                        <div className="bo-metrics">
                          <Metric label="청구" value={money(c.total.billedKrw)} />
                          <Metric label="수금" value={money(c.total.collectedKrw)} />
                          <Metric label="미수" value={money(c.total.outstandingKrw)} />
                          <Metric label="수금률" value={<Rate value={c.total.collectionRate} />} />
                        </div>
                        <Bars
                          rows={c.cohorts.map((m) => ({
                            label: m.billingMonth ?? '',
                            value: m.outstandingKrw,
                            detail: `청구 ${money(m.billedKrw)} · 수금 ${money(m.collectedKrw)} · ${percent(m.collectionRate.rate)}`,
                          }))}
                          unit="원"
                        />
                      </Panel>
                      <Panel
                        title="미수 연령"
                        note={`${c.asOf} 기준 전체 미수 · 위 조회 기간과 무관`}
                      >
                        <Bars
                          unit="원"
                          rows={c.aging.buckets.map((b) => ({
                            label:
                              b.bucket === 'NOT_DUE'
                                ? '납기 전'
                                : b.bucket === 'FIRST'
                                  ? `1~${c.aging.firstMaxDays}일`
                                  : b.bucket === 'SECOND'
                                    ? `${c.aging.firstMaxDays + 1}~${c.aging.secondMaxDays}일`
                                    : `${c.aging.secondMaxDays + 1}일 이상`,
                            value: b.outstandingKrw,
                            detail: `${number(b.invoices)}건`,
                          }))}
                        />
                      </Panel>
                    </>
                  )}
                </Query>
                <div className="bo-grid">
                  <Query state={sales}>
                    {(s) => (
                      <Panel
                        title="기관 영업 퍼널"
                        note={`${s.from} ~ ${s.to} 생성 코호트 · 진행 중 ${s.inProgress}건 · 단계 건너뛰기도 도달로 포함`}
                      >
                        <Bars
                          rows={s.stages.map((t) => ({
                            label: t.name,
                            value: t.reached,
                            detail: `직전 단계 ${number(t.previousReached)}건 대비 ${percent(t.conversionRate)} · 체류 중앙값 ${number(t.dwell.medianDays)}일 / P90 ${number(t.dwell.p90Days)}일`,
                          }))}
                        />
                      </Panel>
                    )}
                  </Query>
                  <Query state={orders}>
                    {(o) => (
                      <Panel
                        title="추가 크레딧 구매 퍼널"
                        note={<Source label="같은 주문의 도달 상태" basis={o.basis} />}
                      >
                        <Bars
                          rows={[
                            { label: '주문', value: o.ordered.orders },
                            {
                              label: '입금 확인',
                              value: o.paid.orders,
                              detail: <Rate value={o.paidRate} />,
                            },
                            {
                              label: '지급 확정',
                              value: o.granted.orders,
                              detail: <Rate value={o.grantedRate} />,
                            },
                          ]}
                        />
                        <p className="bo-callout">입금 후 미지급 {number(o.paidNotGranted)}건</p>
                      </Panel>
                    )}
                  </Query>
                </div>
              </>
            )}
            {section === 'usage' && (
              <Uncollected title="작업 퍼널 · 실패 후 복구">
                문서 열기 → 변환 → 저장 → 완료를 같은 작업 회차로 연결하는 집계가 아직 제공되지
                않습니다. 변환 작업 수를 퍼널 도달 수로 대신하지 않습니다.
              </Uncollected>
            )}
            {section === 'retention' && (
              <>
                <Uncollected title="기관 유지율 · 완료 회차 활동 시간">
                  기관 활동 코호트와 포커스·유휴 구간 수집이 필요합니다. 아래는 서버의 변환 처리
                  시간이며 점역사의 활동 시간이 아닙니다.
                </Uncollected>
                <Query state={quality}>
                  {(q) => (
                    <Panel
                      title="변환 처리 시간 · 대기 포함"
                      note={
                        <Source
                          label="완료한 변환 작업만 · 재개 시 방치 시간 포함 가능"
                          basis={q.basis}
                        />
                      }
                    >
                      <div className="bo-metrics">
                        <Metric label="중앙값" value={`${number(q.processingTime.p50Sec)}초`} />
                        <Metric label="P90" value={`${number(q.processingTime.p90Sec)}초`} />
                        <Metric
                          label="완료 작업 표본"
                          value={`${number(q.processingTime.jobs)}건`}
                        />
                      </div>
                      <Bars
                        rows={q.processingTime.buckets.map((b) => ({
                          label:
                            b.toMinutes == null
                              ? `${b.fromMinutes}분 이상`
                              : `${b.fromMinutes}~${b.toMinutes}분`,
                          value: b.jobs,
                        }))}
                        unit="건"
                      />
                    </Panel>
                  )}
                </Query>
              </>
            )}
            {section === 'datasets' && (
              <Query state={datasets}>
                {(d) =>
                  d.units.length ? (
                    d.units.map((u) => (
                      <Panel
                        key={u.unit}
                        title={`데이터셋 확보 추이 · ${u.unit}`}
                        note={
                          <Source
                            label="수동 기록 · 최신 유효 누적값 · 단위 간 합산 없음"
                            basis={d.basis}
                          />
                        }
                      >
                        <Trend
                          label="누적 보유량"
                          unit={u.unit}
                          rows={u.months.map((m) => ({ label: m.month, value: m.cumulative }))}
                        />
                        <Bars
                          rows={u.months.map((m) => ({
                            label: m.month,
                            value: m.delta,
                            detail: m.byDataset
                              .map((b) => `${b.datasetName} ${number(b.cumulative)}${u.unit}`)
                              .join(' · '),
                          }))}
                          unit={u.unit}
                        />
                      </Panel>
                    ))
                  ) : (
                    <Uncollected title="등록된 데이터셋 수량이 없습니다">
                      백오피스의 데이터셋 현황에서 기준일·수량·단위를 기록하면 추이가 표시됩니다.
                    </Uncollected>
                  )
                }
              </Query>
            )}
          </div>
        </>
      )}
    </>
  )
}
