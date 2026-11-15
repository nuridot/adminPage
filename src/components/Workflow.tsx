import { useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { backoffice } from '@/api/backoffice/client'
import { isMockApi } from '@/api'
import { operationMessage } from '@/api/backoffice/rules'
import type { Json, Row } from '@/api/backoffice/types'
import { ApiError } from '@/api/http/client'
import { Modal } from '@/components/Modal'
import { number, timestamp } from './backoffice'

export interface Field {
  key: string
  label: string
  type?:
    | 'text'
    | 'number'
    | 'date'
    | 'month'
    | 'datetime-local'
    | 'textarea'
    | 'checkbox'
    | 'select'
    | 'list'
  required?: boolean
  min?: number
  step?: number
  nonzero?: boolean
  nullable?: boolean
  maxLength?: number
  options?: string[]
  optionLabels?: Record<string, string>
  fields?: Field[]
  hint?: string
}
export interface Action {
  label: string
  method?: string
  path: string
  fields?: Field[]
  initial?: Row
  idempotent?: boolean
  upload?: boolean
  uploadOptional?: boolean
  maxFileMB?: number
  fileField?: string
  reviewOnly?: boolean
  validate?: (body: Row) => string | null
  hint?: string
  download?: boolean
  onSuccess?: (data: unknown) => void
}

export function dateTimeInput(value: Json | undefined) {
  if (typeof value !== 'string' || !value) return ''
  if (!/(Z|[+-]\d\d:\d\d)$/.test(value)) return value.slice(0, 16)
  const date = new Date(value)
  return Number.isNaN(date.valueOf())
    ? ''
    : new Date(date.valueOf() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16)
}

export function asRow(value: Json | undefined): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}
export function rowsOf(value: Json | undefined, key = 'items'): Row[] {
  const list = Array.isArray(value) ? value : asRow(value)[key]
  return Array.isArray(list)
    ? list.filter((v): v is Row => !!v && typeof v === 'object' && !Array.isArray(v))
    : []
}
export function textOf(value: Json | undefined): string {
  return value == null
    ? '—'
    : typeof value === 'object'
      ? Array.isArray(value)
        ? value.map(textOf).join(', ')
        : textOf(value.name ?? value.loginId ?? value.id)
      : typeof value === 'boolean'
        ? value
          ? '예'
          : '아니요'
        : String(value)
}
export function displayValue(key: string, value: Json | undefined): ReactNode {
  if (value == null) return '—'
  if (typeof value === 'number') return number(value)
  if (typeof value === 'string' && /At$|occurredAt/.test(key) && !Number.isNaN(Date.parse(value)))
    return timestamp(value)
  return textOf(value)
}

export function Fields({
  fields,
  value,
  onChange,
  disabled = false,
}: {
  fields: Field[]
  value: Row
  onChange: (v: Row) => void
  disabled?: boolean
}) {
  return (
    <div className="bo-detail-grid">
      {fields.map((f) => {
        const val = value[f.key]
        const update = (v: Json) => onChange({ ...value, [f.key]: v })
        if (f.fields && f.type !== 'list')
          return (
            <fieldset
              key={f.key}
              style={{ gridColumn: '1/-1', border: '1px solid #dfe7f2', borderRadius: 8 }}
            >
              <legend>{f.label}</legend>
              <Fields fields={f.fields} value={asRow(val)} onChange={update} disabled={disabled} />
            </fieldset>
          )
        if (f.type === 'list' && f.fields) {
          const entries = rowsOf(val)
          return (
            <fieldset
              key={f.key}
              style={{ gridColumn: '1/-1', border: '1px solid #dfe7f2', borderRadius: 8 }}
            >
              <legend>{f.label}</legend>
              {entries.map((entry, i) => (
                <div key={i}>
                  <Fields
                    fields={f.fields!}
                    value={entry}
                    onChange={(v) => update(entries.map((old, n) => (n === i ? v : old)))}
                    disabled={disabled}
                  />
                  <button
                    className="btn btn--sm"
                    disabled={disabled}
                    type="button"
                    onClick={() => update(entries.filter((_, n) => n !== i))}
                  >
                    항목 삭제
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn"
                disabled={disabled}
                onClick={() => update([...entries, {}])}
              >
                항목 추가
              </button>
            </fieldset>
          )
        }
        const common = { disabled, required: f.required, 'aria-label': f.label }
        return (
          <label className="bo-field" key={f.key}>
            <span>
              {f.label}
              {f.required ? ' *' : ''}
            </span>
            {f.type === 'checkbox' ? (
              <input
                {...common}
                type="checkbox"
                checked={val === true}
                onChange={(e) => update(e.target.checked)}
              />
            ) : f.type === 'select' ? (
              <select
                {...common}
                value={typeof val === 'string' ? val : ''}
                onChange={(e) => update(e.target.value)}
              >
                <option value="">선택</option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {f.optionLabels?.[o] ?? valueLabels[o] ?? o}
                  </option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                {...common}
                value={typeof val === 'string' ? val : ''}
                maxLength={f.maxLength}
                onChange={(e) => update(e.target.value)}
              />
            ) : (
              <input
                {...common}
                type={f.type === 'list' ? 'text' : (f.type ?? 'text')}
                value={
                  f.type === 'datetime-local'
                    ? dateTimeInput(val)
                    : Array.isArray(val)
                      ? val.map(textOf).join(', ')
                      : val == null
                        ? ''
                        : String(val)
                }
                min={f.min}
                maxLength={f.maxLength}
                step={f.type === 'number' ? (f.step ?? 'any') : undefined}
                onChange={(e) =>
                  update(
                    f.type === 'number'
                      ? e.target.value === ''
                        ? null
                        : Number(e.target.value)
                      : f.type === 'list'
                        ? e.target.value
                            .split(',')
                            .map((v) => v.trim())
                            .filter(Boolean)
                        : e.target.value,
                  )
                }
              />
            )}
            {f.hint && <small>{f.hint}</small>}
          </label>
        )
      })}
    </div>
  )
}

export function prepareBody(fields: Field[], values: Row): Row {
  return Object.fromEntries(
    fields.flatMap((f) => {
      let v = values[f.key]
      if (f.fields && f.type === 'list') v = rowsOf(v).map((row) => prepareBody(f.fields!, row))
      else if (f.fields) v = prepareBody(f.fields, asRow(v))
      else if (
        f.type === 'datetime-local' &&
        typeof v === 'string' &&
        v &&
        !/(Z|[+-]\d\d:\d\d)$/.test(v)
      )
        v = `${v.length === 16 ? v + ':00' : v}+09:00`
      if (f.nullable && (v === undefined || v === '')) v = null
      if (v === undefined || v === '') return []
      return [[f.key, v]]
    }),
  )
}

export async function downloadFile(path: string) {
  if (isMockApi) throw new Error('예시 데이터에서는 파일을 내려받을 수 없습니다.')
  const result = await backoffice.get<{ url: string }>(path)
  const url = new URL(result.url)
  if (url.protocol !== 'https:') throw new Error('안전한 다운로드 주소가 아닙니다.')
  const link = document.createElement('a')
  link.href = url.href
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.click()
}

export function ActionDialog({ action, onClose }: { action: Action; onClose: () => void }) {
  const qc = useQueryClient()
  const [values, setValues] = useState<Row>(action.initial ?? {})
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID())
  const [body, setBody] = useState<Row | null>(
    action.reviewOnly ? prepareBody(action.fields ?? [], action.initial ?? {}) : null,
  )
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<unknown>(undefined)
  const [unknownResult, setUnknownResult] = useState(false)
  const execute = async () => {
    if (busy || (unknownResult && !action.idempotent)) return
    setBusy(true)
    setSent(true)
    setError('')
    try {
      let result: unknown
      if (action.download) {
        await downloadFile(action.path)
        result = null
      } else {
        let form: FormData | undefined
        if (action.upload) {
          form = new FormData()
          if (file) form.append(action.fileField ?? 'file', file)
          for (const [k, v] of Object.entries(body ?? {})) if (v != null) form.append(k, String(v))
        }
        result = await backoffice.mutate(
          action.method ?? 'POST',
          action.path,
          body ?? {},
          action.idempotent ? requestKey : undefined,
          form,
        )
      }
      setSuccess(result ?? null)
      setUnknownResult(false)
      await qc.invalidateQueries({ queryKey: ['backoffice'] })
      action.onSuccess?.(result)
    } catch (e) {
      if (
        (e instanceof ApiError && e.status < 500) ||
        (e instanceof Error && (e.message.startsWith('예시 데이터') || e.message.includes('취소')))
      )
        setSent(false)
      setUnknownResult(
        (!(e instanceof ApiError) || e.status >= 500) &&
          !(
            e instanceof Error &&
            (e.message.startsWith('예시 데이터') || e.message.includes('취소'))
          ),
      )
      setError(e instanceof Error ? e.message : '요청을 완료하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={action.label}
      open
      onClose={() => {
        if (!busy) onClose()
      }}
      width={700}
    >
      {action.hint && <p className="bo-callout">{action.hint}</p>}
      {success !== undefined ? (
        <>
          <p role="status" className="notice-box">
            {action.download ? '다운로드를 열었습니다.' : operationMessage(success)}
          </p>
          {success && typeof success === 'object' ? <Details value={success as Row} /> : null}
          <button className="btn btn--primary" onClick={onClose}>
            닫기
          </button>
        </>
      ) : body === null && !action.download ? (
        <form
          className="bo-form"
          onSubmit={(e) => {
            e.preventDefault()
            const invalid = (action.fields ?? []).find(
              (f) => f.nonzero && Number(values[f.key]) === 0,
            )
            if (invalid) {
              setError(`${invalid.label}은 0일 수 없습니다.`)
              return
            }
            setError('')
            const next = prepareBody(action.fields ?? [], values)
            const invalidOperation = action.validate?.(next)
            if (invalidOperation) {
              setError(invalidOperation)
              return
            }
            setBody(next)
          }}
        >
          <Fields fields={action.fields ?? []} value={values} onChange={setValues} />
          {action.upload && (
            <label className="bo-field">
              <span>파일 · PDF, PNG, JPG · 최대 {action.maxFileMB ?? 10}MB</span>
              <input
                required={!action.uploadOptional}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (
                    f &&
                    (f.size > (action.maxFileMB ?? 10) * 1024 * 1024 ||
                      !/\.(pdf|png|jpe?g)$/i.test(f.name))
                  ) {
                    setError(`PDF·PNG·JPG ${action.maxFileMB ?? 10}MB 이하 파일을 선택하세요.`)
                    setFile(null)
                    e.target.value = ''
                  } else {
                    setFile(f ?? null)
                    setError('')
                  }
                }}
              />
            </label>
          )}
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <button
            className="btn btn--primary"
            disabled={!!action.upload && !action.uploadOptional && !file}
          >
            입력 내용 확인
          </button>
        </form>
      ) : (
        <>
          <p>아래 대상과 내용을 확인한 후 실행해 주세요.</p>
          <Details value={body ?? {}} />
          {file && (
            <p>
              첨부: {file.name} ({number(file.size)} bytes)
            </p>
          )}
          {action.idempotent && (
            <p className="bo-muted">
              요청 번호 {requestKey} · 재시도해도 같은 요청으로 처리됩니다.
            </p>
          )}
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          {unknownResult && (
            <p role="alert" className="bo-callout">
              처리 결과를 확인하지 못했습니다. 원장·상세를 먼저 새로고침하세요.{' '}
              {action.idempotent
                ? '다시 확인하면 같은 요청 번호를 사용합니다.'
                : '중복 처리를 막기 위해 이 요청을 다시 전송하지 않습니다.'}
            </p>
          )}
          <div className="bo-actions">
            <button
              className="btn"
              disabled={busy || sent || action.reviewOnly}
              onClick={() => {
                setRequestKey(crypto.randomUUID())
                setBody(null)
              }}
            >
              수정
            </button>
            <button
              className="btn btn--primary"
              disabled={busy || (unknownResult && !action.idempotent)}
              onClick={() => void execute()}
            >
              {busy ? '처리 중…' : sent ? '같은 요청 재확인' : '확인 후 실행'}
            </button>
            <button className="btn" disabled={busy} onClick={onClose}>
              닫기
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

export const valueLabels: Record<string, string> = {
  ACTIVE: '유효',
  DRAFT: '초안',
  INTERNAL_REVIEW: '내부 검토',
  SIGNATURE_REQUESTED: '날인 요청',
  SIGNED_RECEIVED: '서명본 수령',
  EXPIRED: '만료',
  TERMINATED: '해지',
  OPEN: '진행 중',
  CLOSED: '종료',
  WON: '성사',
  LOST: '실패',
  ON_HOLD: '보류',
  BEFORE_DUE: '납기 전',
  OVERDUE: '납기 초과',
  GRACE: '유예',
  RESTRICTED: '제한',
  RELEASE: '해제',
  CONTACT: '연락',
  INVOICE: '청구서',
  STATEMENT: '거래명세서',
  ISSUED: '발행',
  CANCELLED: '취소',
  VALID: '유효',
  VOID: '무효',
  WAITING: '답변 대기',
  DONE: '처리 완료',
  PROVIDER_ACCEPTED: '메일 제공자 접수',
  REQUESTED: '발송 요청',
  UNKNOWN: '결과 미확정',
  FAILED: '실패',
  CONFIRMED: '확인 완료',
  PUBLISHED: '공개',
  HALTED: '중지',
  IN_REVIEW: '검토 중',
  APPROVED: '승인',
  PENDING: '대기',
  VERIFIED: '확인 완료',
  ALL: '전체',
  ORGS: '선택 기관',
  TEST: '테스트',
  STABLE: '정식',
  INVESTIGATING: '조사 중',
  MITIGATED: '완화',
  RESOLVED: '해결',
  ROTATING: '교체 중',
  REVOKED: '폐기',
  GRANT: '지급',
  RESERVE: '예약',
  CAPTURE: '차감 확정',
  ADJUST: '조정',
  EXPIRE: '만료',
}
export const labels: Record<string, string> = {
  orgId: '기관 ID',
  orgName: '기관',
  orderDate: '주문일',
  creditAmount: '주문 크레딧',
  creditGranted: '지급됨',
  paidAt: '입금 확인일',
  invoiceStatus: '계산서 상태',
  receiptFileName: '증빙 파일',
  quoteFileName: '견적 파일',
  requestId: '연결 요청',
  totals: '단위별 합계',
  organizationCandidates: '기관 연결 후보',
  organizationHistory: '연결 정정 이력',
  planCode: '현재 요금제',
  planName: '요금제 이름',
  pendingPlanCode: '다음 요금제',
  anchorOn: '지급 기준일',
  currentPeriodOn: '현재 주기',
  nextGrantOn: '다음 지급일',
  subscriptionId: '구독 번호',
  startsOn: '첫 지급 기준일',
  id: '번호',
  name: '이름',
  title: '제목',
  status: '상태',
  organizationId: '기관 ID',
  organizationName: '기관',
  contractId: '계약 ID',
  contractNo: '계약 번호',
  invoiceId: '청구 ID',
  invoiceNo: '청구 번호',
  paymentId: '입금 ID',
  version: '버전',
  currentVersion: '현재 버전',
  planType: '계약 유형',
  startDate: '시작일',
  endDate: '종료일',
  amountKrw: '총 계약 금액 (원)',
  monthlyFeeKrw: '월정액 (원)',
  terms: '계약 조건',
  partyName: '계약 상대방',
  partyBizNo: '사업자 번호',
  partyRepresentative: '대표자',
  partyAddress: '주소',
  partySignatory: '상대 서명자',
  ourSignatory: '당사 서명자',
  changeNote: '변경 사유',
  reason: '사유',
  endedOn: '종료 효력일',
  renewedFromId: '이전 계약 ID',
  signedFileUploaded: '서명본 보관',
  versions: '버전 이력',
  contract: '계약',
  invoice: '청구',
  opportunity: '영업 기회',
  notes: '메모',
  history: '변경 이력',
  quotes: '견적',
  documents: '문서',
  taxInvoices: '세금계산서',
  allocations: '입금 배분',
  refunds: '환불',
  items: '항목',
  collectionEvents: '미납 처리 이력',
  note: '메모',
  memo: '메모',
  createdAt: '등록 시각',
  updatedAt: '수정 시각',
  createdBy: '등록자',
  occurredAt: '발생 시각',
  actorLoginId: '처리자',
  action: '작업',
  targetType: '대상 종류',
  targetId: '대상 번호',
  success: '성공',
  beforeValue: '변경 전',
  afterValue: '변경 후',
  body: '내용',
  entryId: '거래 번호',
  entryType: '거래 종류',
  source: '출처',
  sourceRef: '출처 번호',
  lotKind: '잔액 종류',
  balanceDelta: '잔액 변화',
  reservedDelta: '예약 변화',
  balanceBefore: '이전 잔액',
  balanceAfter: '이후 잔액',
  reservedAfter: '예약 잔액',
  availableAfter: '이후 가용량',
  replayed: '기존 요청 재확인',
  actor: '처리자',
  jobId: '작업 ID',
  pageNo: '쪽 번호',
  validUntil: '유효 종료일',
  walletId: '지갑 ID',
  ownerType: '소유자 구분',
  loginId: '계정',
  contractBalance: '계약 잔액',
  extraBalance: '추가분',
  validBalance: '유효 잔액',
  reserved: '예약',
  available: '가용량',
  legacyRemaining: '관문 잔여',
  amount: '금액 / 수량',
  receivedOn: '입금일',
  refundedOn: '환불일',
  payerName: '입금자',
  method: '입금 방식',
  allocatedAmount: '배분 금액',
  refundedAmount: '환불 금액',
  unallocatedAmount: '미배분 금액',
  outstandingAmount: '미수액',
  supplyAmount: '공급가',
  vatAmount: '세액',
  totalAmount: '합계',
  periodStart: '기간 시작',
  periodEnd: '기간 종료',
  issueDate: '발행일',
  dueDate: '납기',
  daysOverdue: '초과 일수',
  collectionStatus: '수금 상태',
  collectionAction: '미납 조치',
  billingMonth: '청구 월',
  orderIds: '주문 ID 목록',
  includeMonthlyFee: '월정액 포함',
  extraItems: '추가 항목',
  description: '품목',
  quantity: '수량',
  unitPrice: '단가',
  type: '종류',
  untilDate: '유예 기한',
  shared: '기관 공유',
  sharedWithOrg: '기관 공유',
  documentNo: '문서 번호',
  docType: '문서 유형',
  approvalNo: '승인 번호',
  fileName: '파일명',
  fileSize: '파일 크기',
  sha256: '체크섬',
  severity: '등급',
  assigneeUserId: '담당자 ID',
  sentryUrl: 'Sentry 링크',
  affectedJobCount: '영향 작업 수',
  affectedOrgIds: '영향 기관 ID 목록',
  relatedInquiryIds: '관련 문의 ID 목록',
  relatedReleaseId: '관련 릴리즈',
  startedAt: '시작 시각',
  resolvedAt: '해결 시각',
  datasetName: '자료명',
  asOf: '기준일',
  latestQuantity: '최근 누적량',
  cumulativeQuantity: '누적 수량',
  unit: '단위',
  correctionReason: '정정 사유',
  effective: '유효 기록',
  recordedBy: '기록자',
  recordedAt: '기록 시각',
  environment: '환경',
  purpose: '용도',
  owner: '소유자',
  reference: '비밀 참조 주소',
  expiresOn: '만료일',
  rotatedOn: '최근 교체일',
  expiryState: '만료 상태',
  daysUntilExpiry: '만료까지 일수',
  platform: '플랫폼',
  channel: '채널',
  build: '빌드',
  fileUrl: '설치 파일 주소',
  checksumSha256: 'SHA-256 체크섬',
  signatureStatus: '서명 확인',
  minSupportedVersion: '최소 지원 버전',
  targetScope: '배포 대상',
  targetOrgIds: '대상 기관 ID 목록',
  changes: '변경 사항',
  improvements: '개선',
  fixes: '수정',
  knownIssues: '알려진 문제',
  publicText: '공개 안내',
  noteStatus: '노트 상태',
  displayStatus: '표시 상태',
  publishAt: '공개 예정 (KST)',
  publishedAt: '공개 시각',
  haltReason: '중지 사유',
  prospectName: '잠재 기관명',
  contactName: '담당자 이름',
  contactPhone: '연락처',
  contactEmail: '이메일',
  stageCode: '단계',
  stageName: '단계',
  ownerUserId: '담당 운영자 ID',
  ownerName: '담당 운영자',
  expectedMonthlyFeeKrw: '예상 월정액',
  expectedAmountKrw: '예상 총액',
  nextFollowUpAt: '다음 연락 (KST)',
  closeOutcome: '종료 결과',
  outcome: '결과',
  conditions: '견적 조건',
  toAddresses: '받는 사람',
  ccAddresses: '참조',
  bccAddresses: '숨은 참조',
  subject: '제목',
  bodyText: '메일 본문',
  threadId: '스레드 ID',
  replyToMessageId: '답장 원본 ID',
  kind: '분류',
  read: '읽음',
  acknowledged: '처리 완료',
  occurrenceCount: '발생 횟수',
  lastOccurredAt: '최근 발생',
  acknowledgeMemo: '처리 메모',
  previousInvoiceId: '이전 청구 버전',
  endReason: '종료 사유',
  activatedAt: '효력 발생',
  renewedByIds: '갱신 계약',
  contractCount: '계약 수',
  organizationCount: '기관 수',
  availableBalance: '가용 잔액',
  balanceMismatches: '잔액 불일치',
  missingCaptures: '확정 누락',
  staleReservations: '장기 예약',
  lotMismatches: '묶음 불일치',
  page: '페이지',
  size: '페이지 크기',
  totalElements: '전체 건수',
  totalCount: '전체 건수',
  totalPages: '전체 페이지',
  current: '현재',
  details: '상세',
  result: '결과',
  metadata: '부가 정보',
  contact: '연락처',
  email: '이메일',
  phone: '전화',
  link: '이동 경로',
  ip: 'IP',
  userId: '사용자 ID',
  httpStatus: '응답 상태',
  requestMethod: '요청 방식',
  requestPath: '요청 경로',
  before: '변경 전',
  after: '변경 후',
  errorCode: '오류 코드',
  errorMessage: '오류 내용',
  failureReason: '실패 사유',
  providerAcceptedAt: '제공자 접수 시각',
  sendRequestedAt: '발송 요청 시각',
  lastCheckedAt: '최근 확인',
  confirmedAt: '확인 시각',
  confirmedBy: '확인자',
  sentBy: '발송자',
  orgLinkStatus: '기관 연결 상태',
  counterpartEmail: '상대 주소',
  lastMessageAt: '최근 메일',
  organization: '기관',
  assignee: '담당자',
  graceUntil: '유예 종료',
  signedFileName: '서명 파일',
  signedUploadedAt: '서명 업로드',
  canceledAt: '취소 시각',
  cancelledAt: '취소 시각',
  cancelReason: '취소 사유',
  voidReason: '무효 사유',
  previousDocumentId: '이전 문서',
  sharedAt: '공유 시각',
  noteApprovedAt: '노트 승인',
  noteApprovedBy: '노트 승인자',
  haltedAt: '중지 시각',
  haltedBy: '중지자',
  publishedBy: '공개자',
  closedAt: '종료 시각',
  closedBy: '종료 처리자',
  closeReason: '종료 사유',
  stageEnteredAt: '단계 진입',
  fromStage: '이전 단계',
  toStage: '변경 단계',
  changedAt: '변경 시각',
  changedBy: '변경자',
  fromStageName: '이전 단계',
  toStageName: '변경 단계',
  fileUploadedAt: '파일 업로드',
  authorUserId: '작성자',
  lineNo: '품목 번호',
  itemType: '품목 유형',
  releasedAt: '해제 시각',
  orderId: '주문 ID',
  entryCount: '거래 수',
  acknowledgedAt: '처리 시각',
  acknowledgedBy: '처리자',
  firstOccurredAt: '최초 발생',
  targetRef: '대상 참조',
  renewalStatus: '갱신 상태',
  renewalContractId: '갱신 계약',
  daysLeft: '잔여 일수',
  from: '시작',
  to: '종료',
  generatedAt: '집계 시각',
  checkedAt: '확인 시각',
  mismatchCount: '불일치 건수',
  total: '합계',
  unitPriceKrw: '단가 (원)',
}

export function Details({ value }: { value: Row }) {
  const entries = Object.entries(value).filter(
    ([k]) => !['bodyHtml', 'secret', 'accessToken', 'refreshToken', 'mfaToken'].includes(k),
  )
  return (
    <div className="bo-form">
      <dl className="bo-detail-list">
        {entries
          .filter(([, v]) => v === null || typeof v !== 'object')
          .map(([k, v]) => (
            <div key={k}>
              <dt>{labels[k] ?? k}</dt>
              <dd>
                {typeof v === 'string' && valueLabels[v] ? valueLabels[v] : displayValue(k, v)}
              </dd>
            </div>
          ))}
      </dl>
      {entries
        .filter(([, v]) => v && typeof v === 'object')
        .map(([k, v]) => (
          <details key={k}>
            <summary>
              {labels[k] ?? k}
              {Array.isArray(v) ? ` (${v.length})` : ''}
            </summary>
            {Array.isArray(v) ? (
              v.map((item, i) =>
                typeof item === 'object' && item ? (
                  <Details key={i} value={asRow(item)} />
                ) : (
                  <p key={i}>{textOf(item)}</p>
                ),
              )
            ) : (
              <Details value={asRow(v)} />
            )}
          </details>
        ))}
    </div>
  )
}
