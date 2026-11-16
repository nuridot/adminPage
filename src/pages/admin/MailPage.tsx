import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { backoffice } from '@/api/backoffice/client'
import { action } from '@/api/backoffice/actions'
import { validateMailAttachment } from '@/api/backoffice/mailAttachments'
import { MailAttachmentSummary } from '@/components/MailAttachmentSummary'
import type { Json, Row } from '@/api/backoffice/types'
import {
  ActionDialog,
  asRow,
  Details,
  downloadFile,
  rowsOf,
  textOf,
  type Action,
  type Field,
} from '@/components/Workflow'
import { PageHeading, Panel, timestamp } from '@/components/backoffice'
import { Pagination, Query } from '@/components/ui'

const mailStatus: Record<string, string> = {
  OPEN: '답할 차례',
  WAITING: '상대 답변 대기',
  DONE: '처리 완료',
  DRAFT: '초안',
  CONFIRMED: '발송 확인됨',
  SEND_REQUESTED: '발송 요청',
  PROVIDER_ACCEPTED: '제공자 접수',
  SEND_FAILED: '발송 실패',
  SEND_UNCERTAIN: '결과 미확정',
  DISCARDED: '버림',
}
const draftFields: Field[] = [
  { key: 'toAddresses', label: '받는 사람', required: true, hint: '주소가 여러 개면 쉼표로 구분' },
  { key: 'ccAddresses', label: '참조' },
  { key: 'bccAddresses', label: '숨은 참조' },
  { key: 'subject', label: '제목', required: true, maxLength: 500 },
  { key: 'bodyText', label: '메일 본문', type: 'textarea', required: true, maxLength: 100000 },
]
export function MailPage() {
  const { threadId } = useParams()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const [status, setStatus] = useState(search.get('status') ?? '')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [tab, setTab] = useState('threads')
  const [command, setCommand] = useState<Action | null>(null)
  const [selectedDraft, setSelectedDraft] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState('')
  const sync = useQuery({
    queryKey: ['backoffice', 'mail-sync'],
    queryFn: () => backoffice.get<Row>('/api/admin/official-mail/sync-status'),
  })
  const threads = useQuery({
    queryKey: ['backoffice', 'mail-threads', status, query, page],
    queryFn: () =>
      backoffice.get<Row>('/api/admin/official-mail/threads', { status, q: query, page, size: 20 }),
    enabled: tab === 'threads',
  })
  const detail = useQuery({
    queryKey: ['backoffice', 'mail-thread', threadId],
    queryFn: () =>
      backoffice.get<Row>(`/api/admin/official-mail/threads/${encodeURIComponent(threadId!)}`),
    enabled: !!threadId && tab === 'threads',
  })
  const drafts = useQuery({
    queryKey: ['backoffice', 'mail-drafts'],
    queryFn: () => backoffice.get<Json>('/api/admin/official-mail/drafts'),
    enabled: tab === 'drafts',
  })
  const draft = useQuery({
    queryKey: ['backoffice', 'mail-draft', selectedDraft],
    queryFn: () =>
      backoffice.get<Row>(`/api/admin/official-mail/drafts/${encodeURIComponent(selectedDraft!)}`),
    enabled: !!selectedDraft && tab === 'drafts',
  })
  const newDraft = (initial: Row = {}) =>
    setCommand(
      action(
        '메일 초안 저장',
        'POST',
        '/api/admin/official-mail/drafts',
        {},
        {
          fields: [
            ...draftFields,
            { key: 'threadId', label: '답장 스레드 ID', hint: '새 메일은 비워 둡니다.' },
          ],
          initial,
          required: ['toAddresses', 'subject', 'bodyText'],
          hint: '초안을 저장한 뒤 파일을 첨부할 수 있습니다. 발송 전에 수신자·본문·첨부를 함께 확인합니다.',
          onSuccess: (r) => {
            setSelectedDraft(String(asRow(r as Json).id))
            setTab('drafts')
          },
        },
      ),
    )
  const openAttachment = async (id: Json) => {
    setDownloadError('')
    try {
      await downloadFile(
        `/api/admin/official-mail/attachments/${encodeURIComponent(String(id))}/download-url`,
      )
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : '첨부를 열 수 없습니다.')
    }
  }
  return (
    <>
      <PageHeading
        title="공식 메일"
        description="수신 대화와 기관 맥락을 함께 확인하고, 검토한 초안으로 회신합니다."
        actions={
          <button className="btn btn--primary" onClick={() => newDraft()}>
            + 새 메일 초안
          </button>
        }
      />
      <Query state={sync}>
        {(s) => (
          <p className={s.lastErrorAt ? 'error-box' : 'bo-callout'}>
            {textOf(s.mailbox)} · {s.enabled ? '연결 사용 중' : '연결 꺼짐'} · 마지막 동기화{' '}
            {timestamp(s.lastSyncedAt as string)}
            {s.lastErrorAt && ` · 동기화 오류 ${timestamp(s.lastErrorAt as string)}`}
          </p>
        )}
      </Query>
      <div className="bo-tabs">
        <button className={tab === 'threads' ? 'active' : ''} onClick={() => setTab('threads')}>
          수신함 · 대화
        </button>
        <button className={tab === 'drafts' ? 'active' : ''} onClick={() => setTab('drafts')}>
          초안 · 보낸 메일
        </button>
      </div>
      {tab === 'threads' ? (
        <>
          <form
            className="bo-filters"
            onSubmit={(e) => {
              e.preventDefault()
              setQuery(q)
              setPage(0)
            }}
          >
            <label>
              제목 · 상대 주소
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="메일 검색" />
            </label>
            <label>
              처리 상태
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value)
                  setPage(0)
                }}
              >
                <option value="">전체</option>
                {['OPEN', 'WAITING', 'DONE'].map((s) => (
                  <option key={s} value={s}>
                    {mailStatus[s]}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn">검색</button>
          </form>
          <div className="bo-mail-grid">
            <Query state={threads}>
              {(t) => (
                <Panel title="대화 목록">
                  <div className="bo-mail-list">
                    {rowsOf(t).map((m) => (
                      <button
                        key={String(m.id)}
                        className={threadId === m.id ? 'active' : ''}
                        onClick={() => navigate(`/admin/mail/${encodeURIComponent(String(m.id))}`)}
                      >
                        <strong>{textOf(m.subject)}</strong>
                        <span>{textOf(m.counterpartEmail)}</span>
                        <small>
                          {mailStatus[String(m.status)]} · {timestamp(m.lastMessageAt as string)}
                        </small>
                        <span className="bo-badge">
                          {textOf(asRow(m.organization).name)} ·{' '}
                          {m.orgLinkStatus === 'CONFIRMED' ? '연결 확인' : '연결 확인 필요'}
                        </span>
                      </button>
                    ))}
                    {!rowsOf(t).length && <p className="bo-empty">대화가 없습니다.</p>}
                  </div>
                  <Pagination
                    currentPage={page + 1}
                    totalPages={Number(t.totalPages ?? 1)}
                    onPageChange={(p) => setPage(p - 1)}
                  />
                </Panel>
              )}
            </Query>
            {threadId ? (
              <Query state={detail}>
                {(d) => {
                  const thread = asRow(d.thread),
                    org = asRow(thread.organization)
                  return (
                    <div className="bo-form">
                      <Panel
                        title={textOf(thread.subject)}
                        actions={
                          <span className="bo-badge">{mailStatus[String(thread.status)]}</span>
                        }
                      >
                        <div className="bo-actions">
                          <button
                            className="btn"
                            onClick={() =>
                              newDraft({
                                threadId,
                                toAddresses: thread.counterpartEmail,
                                subject: `Re: ${textOf(thread.subject)}`,
                              })
                            }
                          >
                            답장 초안
                          </button>
                          <button
                            className="btn"
                            onClick={() =>
                              newDraft({
                                subject: `Fwd: ${textOf(thread.subject)}`,
                                bodyText: rowsOf(d.messages)
                                  .map(
                                    (m) =>
                                      `--- ${textOf(m.fromAddress)} / ${textOf(m.sentAt)} ---\n${textOf(m.bodyText)}`,
                                  )
                                  .join('\n\n'),
                              })
                            }
                          >
                            전달 초안
                          </button>
                          <button
                            className="btn"
                            onClick={() =>
                              setCommand(
                                action(
                                  '메일 처리 상태',
                                  'PATCH',
                                  '/api/admin/official-mail/threads/{threadId}/status',
                                  { threadId },
                                  {
                                    required: ['status'],
                                    choices: { status: ['OPEN', 'WAITING', 'DONE'] },
                                  },
                                ),
                              )
                            }
                          >
                            상태 변경
                          </button>
                        </div>
                        {rowsOf(d.messages).map((m) => (
                          <article key={String(m.id)} className="bo-mail-message">
                            <header>
                              <strong>{textOf(m.fromName ?? m.fromAddress)}</strong>
                              <small>{timestamp(m.sentAt as string)}</small>
                            </header>
                            <p className="bo-muted">
                              {textOf(m.fromAddress)} → {textOf(m.toAddresses)}
                              {m.ccAddresses && ` · 참조 ${textOf(m.ccAddresses)}`}
                            </p>
                            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                              {typeof m.bodyText === 'string'
                                ? m.bodyText
                                : '글 본문이 없습니다. HTML 본문은 안전을 위해 표시하지 않습니다.'}
                            </p>
                            <div className="bo-actions">
                              {rowsOf(m.attachments).map((a) => (
                                <button
                                  key={String(a.id)}
                                  disabled={!a.stored}
                                  className="btn btn--sm"
                                  onClick={() => void openAttachment(a.id)}
                                >
                                  {textOf(a.fileName)}
                                  {!a.stored ? ' · 보관 안 됨' : ' ↓'}
                                </button>
                              ))}
                            </div>
                          </article>
                        ))}
                        {downloadError && (
                          <p role="alert" className="error-box">
                            {downloadError}
                          </p>
                        )}
                      </Panel>
                      <Panel title="기관 맥락 · 내부 메모">
                        <p>
                          {textOf(org.name)}
                          {org.id && (
                            <>
                              {' '}
                              ·{' '}
                              <Link
                                className="bo-text-link"
                                to={`/admin/orgs/${encodeURIComponent(String(org.id))}`}
                              >
                                기관 정보 →
                              </Link>
                            </>
                          )}
                        </p>
                        <div className="bo-actions">
                          <button
                            className="btn"
                            onClick={() =>
                              setCommand(
                                action(
                                  '기관 연결 확인 · 정정',
                                  'PUT',
                                  '/api/admin/official-mail/threads/{threadId}/organization',
                                  { threadId },
                                  {
                                    initial: { organizationId: org.id ?? null },
                                    fields: [
                                      {
                                        key: 'organizationId',
                                        nullable: true,
                                        label: '연결할 기관 ID',
                                        hint: '연결 해제는 빈 값으로 두세요.',
                                      },
                                      {
                                        key: 'reason',
                                        label: '연결·정정 사유',
                                        type: 'textarea',
                                        required: true,
                                      },
                                    ],
                                    required: ['reason'],
                                    hint: '기존 확인된 연결을 바꾸면 정정 사유가 기록됩니다.',
                                  },
                                ),
                              )
                            }
                          >
                            기관 연결
                          </button>
                          <button
                            className="btn"
                            onClick={() =>
                              setCommand(
                                action(
                                  '담당자 지정',
                                  'PATCH',
                                  '/api/admin/official-mail/threads/{threadId}/assignee',
                                  { threadId },
                                  {
                                    fields: [
                                      {
                                        key: 'assigneeUserId',
                                        label: '담당자 ID',
                                        nullable: true,
                                        hint: '비우면 담당자 지정을 해제합니다.',
                                      },
                                    ],
                                  },
                                ),
                              )
                            }
                          >
                            담당자 지정
                          </button>
                          <button
                            className="btn"
                            onClick={() =>
                              setCommand(
                                action(
                                  '내부 메모 추가',
                                  'POST',
                                  '/api/admin/official-mail/threads/{threadId}/notes',
                                  { threadId },
                                  {
                                    required: ['body'],
                                    hint: '운영자에게만 보이며 외부 메일로 발송되지 않습니다.',
                                  },
                                ),
                              )
                            }
                          >
                            내부 메모
                          </button>
                        </div>
                        {rowsOf(d.notes).map((n, i) => (
                          <div className="bo-callout" key={i}>
                            <p style={{ whiteSpace: 'pre-wrap' }}>{textOf(n.body)}</p>
                            <small>
                              {textOf(asRow(n.author).loginId)} · {timestamp(n.createdAt as string)}
                            </small>
                          </div>
                        ))}
                        <Details
                          value={{
                            organizationCandidates: d.organizationCandidates ?? [],
                            organizationHistory: d.organizationHistory ?? [],
                          }}
                        />
                      </Panel>
                    </div>
                  )
                }}
              </Query>
            ) : (
              <Panel title="대화 선택">
                <p className="bo-empty">왼쪽 목록에서 메일을 선택하세요.</p>
              </Panel>
            )}
          </div>
        </>
      ) : (
        <>
          <Query state={drafts}>
            {(list) => (
              <Panel title="초안 · 발송 상태">
                <div className="bo-table-wrap">
                  <table className="bo-table">
                    <thead>
                      <tr>
                        <th>제목</th>
                        <th>받는 사람</th>
                        <th>상태</th>
                        <th>갱신</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsOf(list).map((d) => (
                        <tr key={String(d.id)}>
                          <td>
                            <button className="btn" onClick={() => setSelectedDraft(String(d.id))}>
                              {textOf(d.subject)}
                            </button>
                          </td>
                          <td>{textOf(d.toAddresses)}</td>
                          <td>
                            <span className="bo-badge">
                              {mailStatus[String(d.status)] ?? textOf(d.status)}
                            </span>
                          </td>
                          <td>{timestamp(d.updatedAt as string)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!rowsOf(list).length && <p className="bo-empty">저장한 초안이 없습니다.</p>}
                </div>
              </Panel>
            )}
          </Query>
          {selectedDraft && (
            <Query state={draft}>
              {(d) => {
                const editable = ['DRAFT', 'CONFIRMED', 'SEND_FAILED'].includes(String(d.status))
                const attachments = rowsOf(d.attachments)
                const snapshot = Object.fromEntries(
                  draftFields.map((f) => [f.key, d[f.key] ?? null]),
                )
                return (
                  <Panel
                    title={textOf(d.subject)}
                    note="메일 제공자 접수는 상대 메일함 도착을 보장하지 않습니다."
                  >
                    <p>
                      <span className="bo-badge">{mailStatus[String(d.status)]}</span>
                    </p>
                    <Details value={snapshot} />
                    <MailAttachmentSummary attachments={attachments} />
                    <div className="bo-actions">
                      {attachments.map((file) => (
                        <span key={String(file.id)} className="bo-actions">
                          <button
                            className="btn btn--sm"
                            onClick={() => void openAttachment(file.id)}
                          >
                            {textOf(file.fileName)} 열기
                          </button>
                          {editable && (
                            <button
                              className="btn btn--sm"
                              onClick={() =>
                                setCommand(
                                  action(
                                    '첨부파일 삭제',
                                    'DELETE',
                                    '/api/admin/official-mail/drafts/{draftId}/attachments/{attachmentId}',
                                    { draftId: selectedDraft, attachmentId: String(file.id) },
                                    {
                                      hint: `${textOf(file.fileName)}을 초안에서 제거합니다. 기존 발송 확인이 해제됩니다.`,
                                      reviewOnly: true,
                                    },
                                  ),
                                )
                              }
                            >
                              {textOf(file.fileName)} 삭제
                            </button>
                          )}
                        </span>
                      ))}
                      {editable && (
                        <button
                          className="btn"
                          onClick={() =>
                            setCommand(
                              action(
                                '메일 첨부 올리기',
                                'POST',
                                '/api/admin/official-mail/drafts/{draftId}/attachments',
                                { draftId: selectedDraft },
                                {
                                  fields: [],
                                  upload: true,
                                  uploadAccept: '',
                                  maxFileMB: 10,
                                  uploadLabel: '첨부파일 · 파일당 10MB · 합계 17MB · 최대 10개',
                                  validateFile: (file) =>
                                    validateMailAttachment(
                                      file,
                                      attachments.map((a) => ({ sizeBytes: Number(a.sizeBytes) })),
                                    ),
                                  hint: '파일은 한 번에 하나씩 올립니다. 첨부를 바꾸면 발송 확인이 해제되어 다시 확인해야 합니다.',
                                },
                              ),
                            )
                          }
                        >
                          + 첨부파일 추가
                        </button>
                      )}
                    </div>
                    {downloadError && (
                      <p role="alert" className="error-box">
                        {downloadError}
                      </p>
                    )}
                    {d.failureReason && (
                      <p role="alert" className="error-box">
                        {textOf(d.failureReason)}
                      </p>
                    )}
                    <div className="bo-actions">
                      {editable && (
                        <>
                          <button
                            className="btn"
                            onClick={() =>
                              setCommand(
                                action(
                                  '초안 수정',
                                  'PATCH',
                                  '/api/admin/official-mail/drafts/{draftId}',
                                  { draftId: selectedDraft },
                                  {
                                    fields: draftFields,
                                    initial: snapshot,
                                    required: ['toAddresses', 'subject', 'bodyText'],
                                  },
                                ),
                              )
                            }
                          >
                            수정
                          </button>
                          <button
                            className="btn"
                            onClick={() =>
                              setCommand(
                                action(
                                  '수신자 · 본문 · 첨부 확인',
                                  'POST',
                                  '/api/admin/official-mail/drafts/{draftId}/confirm',
                                  { draftId: selectedDraft },
                                  {
                                    fields: draftFields,
                                    initial: snapshot,
                                    required: ['toAddresses', 'subject', 'bodyText'],
                                    reviewOnly: true,
                                    bodyExtras: {
                                      attachmentIds: attachments.map((file) => file.id),
                                    },
                                    review: <MailAttachmentSummary attachments={attachments} />,
                                    hint: '수신자·본문·첨부가 저장본과 같아야 확인됩니다. 내용을 바꾸려면 초안 수정부터 진행하세요.',
                                  },
                                ),
                              )
                            }
                          >
                            발송 전 확인
                          </button>
                          <button
                            className="btn"
                            onClick={() =>
                              setCommand(
                                action(
                                  '초안 버리기',
                                  'DELETE',
                                  '/api/admin/official-mail/drafts/{draftId}',
                                  { draftId: selectedDraft },
                                ),
                              )
                            }
                          >
                            버리기
                          </button>
                        </>
                      )}
                      {d.status === 'CONFIRMED' && (
                        <button
                          className="btn btn--primary"
                          onClick={() =>
                            setCommand(
                              action(
                                '공식 메일 발송',
                                'POST',
                                '/api/admin/official-mail/drafts/{draftId}/send',
                                { draftId: selectedDraft },
                                {
                                  idempotent: true,
                                  reviewOnly: true,
                                  review: (
                                    <>
                                      <Details value={snapshot} />
                                      <MailAttachmentSummary attachments={attachments} />
                                    </>
                                  ),
                                  hint: '확인한 수신자·본문·첨부로 발송합니다. 첨부가 바뀌었다면 초안을 다시 불러와 확인해야 합니다.',
                                },
                              ),
                            )
                          }
                        >
                          확인한 메일 발송
                        </button>
                      )}
                      {['SEND_REQUESTED', 'SEND_UNCERTAIN'].includes(String(d.status)) && (
                        <button
                          className="btn"
                          onClick={() =>
                            setCommand(
                              action(
                                '발송 결과 다시 조회',
                                'POST',
                                '/api/admin/official-mail/drafts/{draftId}/check',
                                { draftId: selectedDraft },
                                {
                                  hint: '다시 보내지 않고 보낸 편지함에서 처리 결과만 확인합니다.',
                                },
                              ),
                            )
                          }
                        >
                          결과 다시 조회
                        </button>
                      )}
                      <button className="btn" onClick={() => void draft.refetch()}>
                        상태 새로고침
                      </button>
                    </div>
                  </Panel>
                )
              }}
            </Query>
          )}
        </>
      )}
      {command && (
        <ActionDialog
          key={command.path + command.label}
          action={command}
          onClose={() => setCommand(null)}
        />
      )}
    </>
  )
}
