import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { backoffice } from '@/api/backoffice/client'
import { insightParams, type InsightFilters } from '@/api/backoffice/insightFilters'
import type {
  ActivityTime,
  AppReliability,
  CollectedMetric,
  OrgRetention,
  RevisionRate,
  RevisionSummary,
  WorkFunnel,
} from '@/api/backoffice/appEvents'
import {
  Bars,
  Metric,
  Panel,
  Rate,
  Source,
  Uncollected,
  number,
  timestamp,
} from '@/components/backoffice'
import { Query } from '@/components/ui'

const operationLabel = {
  document_open_result: '문서 열기',
  save_result: '저장',
  export_result: '내보내기',
}
const duration = (ms: number | null) => (ms == null ? '—' : `${number(ms / 60000)}분`)

function EventPanel({
  title,
  data,
  note,
  children,
}: {
  title: string
  data: CollectedMetric
  note: string
  children: () => ReactNode
}) {
  return (
    <Panel
      title={title}
      note={
        <>
          <Source basis={data.basis} label={note} /> · 앱 버전{' '}
          {data.basis.filters?.appVersion ?? '전체'}
          {data.collectedFrom && <> · 수집 시작 {timestamp(data.collectedFrom)}</>}
        </>
      }
    >
      {data.collectedFrom === null ? (
        <Uncollected title="앱 이벤트 수집 기록이 없습니다">
          선택한 기관·앱 버전의 수집 기록이 없어 수치를 표시하지 않습니다.
        </Uncollected>
      ) : (
        children()
      )}
    </Panel>
  )
}

export function WorkFunnelPanel({ data }: { data: WorkFunnel }) {
  return (
    <EventPanel
      title="작업 퍼널"
      data={data}
      note="열기 성공 회차 코호트 · 단계 전환율은 직전 단계 대비"
    >
      {() => (
        <>
          <div className="bo-metrics">
            <Metric label="열기 성공 회차" value={number(data.openedSessions)} />
            <Metric label="완료 회차" value={number(data.completedSessions)} />
            <Metric
              label="진행 중"
              value={number(data.inProgressSessions)}
              note={`${data.inProgressHours}시간 이내 활동`}
            />
            <Metric label="정체 회차" value={number(data.stalledSessions)} />
          </div>
          <div className="bo-grid">
            <div>
              <h3>AI 사용</h3>
              <Bars
                rows={[
                  {
                    label: '변환 시도',
                    value: data.ai.attempted,
                    detail: <Rate value={data.ai.attemptRate} />,
                  },
                  {
                    label: '변환 성공',
                    value: data.ai.converted,
                    detail: <Rate value={data.ai.convertRate} />,
                  },
                  {
                    label: '저장 성공',
                    value: data.ai.saved,
                    detail: <Rate value={data.ai.saveRate} />,
                  },
                  {
                    label: '명시적 완료',
                    value: data.ai.completed,
                    detail: <Rate value={data.ai.completeRate} />,
                  },
                ]}
                unit="회차"
              />
            </div>
            <div>
              <h3>AI 미사용</h3>
              <Bars
                rows={[
                  { label: '작업 회차', value: data.noAi.sessions },
                  {
                    label: '저장 성공',
                    value: data.noAi.saved,
                    detail: <Rate value={data.noAi.saveRate} />,
                  },
                  {
                    label: '명시적 완료',
                    value: data.noAi.completed,
                    detail: <Rate value={data.noAi.completeRate} />,
                  },
                ]}
                unit="회차"
              />
            </div>
          </div>
          <div className="bo-metrics">
            <Metric
              label="내보내기 회차"
              value={number(data.exportedSessions)}
              note={<Rate value={data.exportRate} />}
            />
            <Metric label="완료 후 저장 확인 대기" value={number(data.completionAwaitingSave)} />
            <Metric
              label="서버 작업 연결률"
              value={data.jobLink.linkRate ? <Rate value={data.jobLink.linkRate} /> : '산출 불가'}
              note={
                data.jobLink.linkRate
                  ? '생성 작업 중 회차와 연결된 작업'
                  : '버전 필터 또는 연결 수집 이전 기간'
              }
            />
          </div>
        </>
      )}
    </EventPanel>
  )
}

export function ReliabilityPanel({ data }: { data: AppReliability }) {
  return (
    <EventPanel
      title="앱 실패 · 복구"
      data={data}
      note={`실패율에서 취소 제외 · 최초 실패 후 ${data.recoveryWindowHours}시간 내 성공을 복구로 집계`}
    >
      {() => (
        <>
          <div className="bo-table-wrap">
            <table className="bo-table">
              <thead>
                <tr>
                  <th>작업</th>
                  <th>성공</th>
                  <th>실패</th>
                  <th>취소</th>
                  <th>실패율</th>
                  <th>최초 실패</th>
                  <th>복구</th>
                  <th>관찰 중</th>
                  <th>복구율</th>
                </tr>
              </thead>
              <tbody>
                {data.operations.map((o) => (
                  <tr key={o.eventName}>
                    <th scope="row">{operationLabel[o.eventName]}</th>
                    <td>{number(o.success)}</td>
                    <td>{number(o.failure)}</td>
                    <td>{number(o.cancelled)}</td>
                    <td>
                      <Rate value={o.failureRate} />
                    </td>
                    <td>{number(o.initialFailures)}</td>
                    <td>{number(o.recovered)}</td>
                    <td>{number(o.pendingRecovery)}</td>
                    <td>
                      <Rate value={o.recoveryRate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="bo-muted">
            복구 관찰 시간이 끝나지 않은 미복구 건은 복구율 분모에서 제외합니다.
          </p>
          {data.errors.length > 0 && (
            <Bars
              rows={data.errors.map((e) => ({
                label: `${operationLabel[e.eventName]} · ${e.errorCode}`,
                value: e.failures,
              }))}
              unit="건"
            />
          )}
        </>
      )}
    </EventPanel>
  )
}

function RevisionStats({ label, data }: { label: string; data: RevisionSummary }) {
  return (
    <section aria-label={label}>
      <h3>{label}</h3>
      <div className="bo-metrics">
        <Metric
          label="교정 비율"
          value={<Rate value={data.correctionRatio} />}
          note="편집된 비교 대상 / 비교 가능 대상"
        />
        <Metric
          label="순 편집률"
          value={<Rate value={data.netEditRate} />}
          note="편집 거리 합 / 기준본 길이 합 · 100% 초과 가능"
        />
        <Metric label="비교 관측률" value={<Rate value={data.observationRate} />} />
      </div>
      <p className="bo-muted">
        회차 {number(data.sessions)} · 대상 {number(data.targets)} · 비교 가능{' '}
        {number(data.comparable)} · 교정 {number(data.edited)} · 기준본 없음{' '}
        {number(data.baselineMissing)} · 비교 미지원 {number(data.unsupported)} · 미관측{' '}
        {number(data.notObserved)}
        {data.summaryMissing != null && (
          <> · 서버 성공 대상 중 요약 미수신 {number(data.summaryMissing)}</>
        )}
      </p>
    </section>
  )
}

export function RevisionPanel({ data }: { data: RevisionRate }) {
  const [scope, setScope] = useState<'allSessions' | 'completedSessions'>('allSessions')
  return (
    <EventPanel
      title="AI · 점역 엔진 교정"
      data={data}
      note="회차·대상·기준본별 최신 요약 · 개인 평가에 사용하지 않음"
    >
      {() => (
        <>
          <label>
            교정 집계 대상{' '}
            <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
              <option value="allSessions">전체 회차</option>
              <option value="completedSessions">완료 회차</option>
            </select>
          </label>
          {scope === 'completedSessions' && (
            <p className="bo-muted">완료 시 저장본과 일치하는 요약만 집계합니다.</p>
          )}
          <RevisionStats label="AI 원문 교정" data={data.aiRevision[scope]} />
          <RevisionStats label="점역 엔진 점자 교정" data={data.engineRevision[scope]} />
        </>
      )}
    </EventPanel>
  )
}

export function ActivityPanel({ data }: { data: ActivityTime }) {
  return (
    <EventPanel
      title="완료 회차 활동 시간"
      data={data}
      note="활동 구간의 합집합 · 같은 사용자의 겹친 구간은 한 번만 집계"
    >
      {() => (
        <>
          {data.coverage === 'unavailable' ? (
            <Uncollected title="활동 구간 미수집">활동 시간을 계산할 수 없습니다.</Uncollected>
          ) : (
            <>
              {data.coverage === 'partial' && (
                <p className="bo-callout">
                  일부 구간만 관측되어 전체 활동 시간은 산출할 수 없습니다.
                </p>
              )}
              <div className="bo-metrics">
                <Metric
                  label="전체 활동 시간"
                  value={data.coverage === 'complete' ? duration(data.totalActiveMs) : '산출 불가'}
                />
                {data.coverage === 'partial' && (
                  <Metric
                    label="관측된 활동 시간"
                    value={duration(data.observedActiveMs)}
                    note="누락 구간을 포함하지 않은 합계"
                  />
                )}
                <Metric
                  label="구간이 완전한 회차의 활동 합계"
                  value={duration(data.completeSessionsTotalActiveMs)}
                />
                <Metric
                  label="활동 시간 중앙값 / P90"
                  value={`${duration(data.completeSessionActiveMs.p50)} / ${duration(data.completeSessionActiveMs.p90)}`}
                  note={`구간이 완전한 ${number(data.completeSessionActiveMs.sessions)}회차`}
                />
              </div>
            </>
          )}
          <p className="bo-muted">
            전체 {number(data.sessions.total)}회차 · 완전 수집 {number(data.sessions.complete)} ·
            부분 수집 {number(data.sessions.partial)} · 미수집 {number(data.sessions.unavailable)} ·
            시계 이상 {number(data.sessions.clockSuspect)}
          </p>
          <Metric
            label="시작~완료 경과 시간 중앙값 / P90"
            value={`${duration(data.elapsedMs.p50)} / ${duration(data.elapsedMs.p90)}`}
            note={`${number(data.elapsedMs.sessions)}회차 · 활동 시간과 별도`}
          />
        </>
      )}
    </EventPanel>
  )
}

export function RetentionPanel({ data }: { data: OrgRetention }) {
  return (
    <EventPanel
      title="기관 유지율"
      data={data}
      note="KST 월요일 시작 · 조회 기간을 전체 주로 확장 · 활동 기관 코호트"
    >
      {() => (
        <div className="bo-table-wrap">
          <table className="bo-table">
            <thead>
              <tr>
                <th>기준 주</th>
                <th>활동 기관</th>
                {data.retentionWeeks.map((n) => (
                  <th key={n}>{n}주 후 유지율</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.weeks.map((w) => (
                <tr key={w.weekStart}>
                  <th scope="row">
                    {w.weekStart}
                    {!w.finished && ' · 진행 중'}
                  </th>
                  <td>
                    {!w.collected
                      ? '미수집'
                      : w.finished
                        ? number(w.activeOrgs)
                        : `현재까지 ${number(w.activeOrgsSoFar)}`}
                  </td>
                  {data.retentionWeeks.map((n) => {
                    const r = w.retention.find((v) => v.weeksAfter === n)
                    return (
                      <td key={n} title={r?.targetWeekStart}>
                        {w.collected && w.finished && r?.retained ? (
                          <Rate value={r.retained} />
                        ) : (
                          '집계 대기·미수집'
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {!data.weeks.length && <p className="bo-empty">해당 기간의 데이터가 없습니다.</p>}
          <p className="bo-muted">
            아직 끝나지 않았거나 수집되지 않은 주는 0%로 표시하지 않습니다.
          </p>
        </div>
      )}
    </EventPanel>
  )
}

function useEventMetric<T>(name: string, filters: InsightFilters, enabled: boolean) {
  const params = insightParams(name, filters)
  return useQuery({
    queryKey: ['backoffice', name, params],
    queryFn: () => backoffice.get<T>(`/api/admin/insights/${name}`, params),
    enabled,
  })
}

export function AppEventInsights({
  section,
  filters,
}: {
  section: string
  filters: InsightFilters
}) {
  const funnel = useEventMetric<WorkFunnel>(
    'work-funnel',
    filters,
    ['overview', 'usage'].includes(section),
  )
  const reliability = useEventMetric<AppReliability>(
    'app-reliability',
    filters,
    section === 'usage',
  )
  const revision = useEventMetric<RevisionRate>('revision-rate', filters, section === 'quality')
  const activity = useEventMetric<ActivityTime>('activity-time', filters, section === 'retention')
  const retention = useEventMetric<OrgRetention>('org-retention', filters, section === 'retention')
  return (
    <>
      {['overview', 'usage'].includes(section) && (
        <Query state={funnel}>{(d) => <WorkFunnelPanel data={d} />}</Query>
      )}
      {section === 'usage' && (
        <Query state={reliability}>{(d) => <ReliabilityPanel data={d} />}</Query>
      )}
      {section === 'quality' && <Query state={revision}>{(d) => <RevisionPanel data={d} />}</Query>}
      {section === 'retention' && (
        <>
          <Query state={retention}>{(d) => <RetentionPanel data={d} />}</Query>
          <Query state={activity}>{(d) => <ActivityPanel data={d} />}</Query>
        </>
      )}
    </>
  )
}
