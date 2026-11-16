import type { Row } from '@/api/backoffice/types'
import { number } from './backoffice'
import { textOf } from './Workflow'

export function MailAttachmentSummary({ attachments }: { attachments: Row[] }) {
  return (
    <div className="bo-callout">
      <strong>첨부 {attachments.length}개</strong>
      {attachments.length ? (
        <ul>
          {attachments.map((file) => (
            <li key={String(file.id)}>
              {textOf(file.fileName)} · {number(Number(file.sizeBytes))} bytes
            </li>
          ))}
        </ul>
      ) : (
        <p>첨부파일 없음</p>
      )}
    </div>
  )
}
