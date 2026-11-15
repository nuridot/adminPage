import type { ReactNode } from 'react'
import type { Basis, Ratio } from '@/api/backoffice/types'

export const number = (value: number | null | undefined) =>
  value == null ? '—' : value.toLocaleString('ko-KR', { maximumFractionDigits: 1 })
export const money = (value: number | null | undefined) =>
  value == null ? '—' : `₩${number(value)}`
export const percent = (value: number | null | undefined) =>
  value == null ? '—' : `${number(value * 100)}%`
export const timestamp = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '기록 없음'
export const layoutLabel = (value?: string | null) =>
  ({
    PAGE_LAYOUT_TEXT: '텍스트',
    PAGE_LAYOUT_TABLE: '표',
    PAGE_LAYOUT_FORMULA: '수식',
    PAGE_LAYOUT_VISUAL: '그림',
    PAGE_LAYOUT_UNSPECIFIED: '미분류',
  })[value ?? ''] ??
  value ??
  '유형 모름'

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="bo-heading">
      <div>
        <p className="bo-eyebrow">{eyebrow ?? 'SEMOJUM / OPERATIONS'}</p>
        <h1>{title}</h1>
        <p className="bo-description">{description}</p>
      </div>
      <div className="bo-actions">{actions}</div>
    </div>
  )
}
export function Metric({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  tone?: string
}) {
  return (
    <div className={`bo-metric ${tone ?? ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  )
}
export function Panel({
  title,
  note,
  children,
  actions,
}: {
  title: string
  note?: ReactNode
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="bo-panel">
      <header>
        <h2>{title}</h2>
        {actions}
      </header>
      {children}
      {note && <footer>{note}</footer>}
    </section>
  )
}
export function Source({ basis, label }: { basis?: Basis; label: string }) {
  return (
    <span>
      {label}
      {basis && (
        <>
          {' '}
          · {basis.from} ~ {basis.to} · KST · 집계 {timestamp(basis.generatedAt)}
        </>
      )}
    </span>
  )
}
export function Rate({ value }: { value: Ratio }) {
  return (
    <span className="bo-rate">
      <strong>{percent(value.denominator === 0 ? null : value.rate)}</strong>
      <small>
        {number(value.numerator)} / {number(value.denominator)}
        {value.denominator === 0 ? ' · 분모 없음' : ''}
      </small>
    </span>
  )
}
export function Uncollected({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bo-uncollected">
      <span className="bo-badge">미수집</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}
export function Bars({
  rows,
  unit = '',
  percentScale = false,
}: {
  rows: { label: string; value: number | null; detail?: ReactNode }[]
  unit?: string
  percentScale?: boolean
}) {
  const max = percentScale ? 1 : Math.max(1, ...rows.map((r) => Math.abs(r.value ?? 0)))
  if (!rows.length) return <p className="bo-empty">해당 기간의 데이터가 없습니다.</p>
  return (
    <div className="bo-bars">
      {rows.map((r, i) => (
        <div className="bo-bar" key={`${r.label}-${i}`}>
          <div>
            <span>{r.label}</span>
            <strong>
              {r.value == null
                ? '—'
                : percentScale
                  ? percent(r.value)
                  : `${number(r.value)}${unit}`}
            </strong>
          </div>
          <div className="bo-track">
            <span
              className={r.value != null && r.value < 0 ? 'negative' : ''}
              style={{ width: `${Math.min(100, (Math.abs(r.value ?? 0) / max) * 100)}%` }}
            />
          </div>
          {r.detail && <small>{r.detail}</small>}
        </div>
      ))}
    </div>
  )
}
export function Trend({
  rows,
  label,
  unit = '',
}: {
  rows: { label: string; value: number }[]
  label: string
  unit?: string
}) {
  if (!rows.length) return <p className="bo-empty">해당 기간의 데이터가 없습니다.</p>
  const min = Math.min(0, ...rows.map((r) => r.value)),
    max = Math.max(1, ...rows.map((r) => r.value))
  const x = (i: number) => 45 + (i / Math.max(1, rows.length - 1)) * 510
  const y = (v: number) => 150 - ((v - min) / (max - min)) * 120
  return (
    <div className="bo-trend">
      <svg
        viewBox="0 0 600 195"
        role="img"
        aria-label={`${label}: ${rows.map((r) => `${r.label} ${number(r.value)}${unit}`).join(', ')}`}
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1="45" x2="555" y1={30 + 120 * t} y2={30 + 120 * t} stroke="#e4eaf2" />
            <text x="43" y={26 + 120 * t} fill="#62738b" fontSize="10">
              {number(max - (max - min) * t)}
              {unit}
            </text>
          </g>
        ))}
        <polyline
          fill="none"
          stroke="#3f6bd9"
          strokeWidth="3"
          points={rows.map((r, i) => `${x(i)},${y(r.value)}`).join(' ')}
        />
        {rows.map((r, i) => (
          <g key={r.label}>
            <circle cx={x(i)} cy={y(r.value)} r="4" fill="#3f6bd9">
              <title>
                {r.label}: {number(r.value)}
                {unit}
              </title>
            </circle>
            {(rows.length < 9 || i % Math.ceil(rows.length / 6) === 0 || i === rows.length - 1) && (
              <text x={x(i)} y="183" textAnchor="middle" fontSize="11" fill="#62738b">
                {r.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      <details>
        <summary>차트 데이터 표</summary>
        <div className="bo-table-wrap">
          <table className="bo-table">
            <thead>
              <tr>
                <th>기간</th>
                <th>{label}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>
                    {number(r.value)}
                    {unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
