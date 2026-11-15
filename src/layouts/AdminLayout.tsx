import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { isMockApi } from '@/api'
import { backoffice } from '@/api/backoffice/client'
import { useAuth } from '@/auth/AuthContext'

const operations = [
  ['home', '운영 홈', '⌂'],
  ['orgs', '기관 · 계정', '▦'],
  ['sales', '영업 기회', '↗'],
  ['contracts', '계약 · 갱신', '▤'],
  ['billing', '청구 · 수금', '₩'],
  ['credit', '크레딧 관리', '◈'],
  ['orders', '주문 · 지급', '+'],
  ['mail', '공식 메일', '✉'],
  ['documents', '정산 문서', '▧'],
  ['releases', '버전 · 릴리즈', '↑'],
  ['incidents', '장애 사건', '⚑'],
  ['datasets', '데이터셋 현황', '▥'],
  ['security', '보안 · 설정', '◇'],
  ['monitoring', '작업 모니터링', '◷'],
  ['stats', '원가 · 통계', '▨'],
  ['inquiries', '문의', '?'],
  ['notices', '공지', '○'],
]
const insights = [
  ['overview', '종합 현황', '▦'],
  ['revenue', '매출 · 계약', '₩'],
  ['usage', '사용 · 작업 퍼널', '↗'],
  ['quality', 'AI 품질 · 교정', '◈'],
  ['retention', '유지 · 작업 시간', '◷'],
  ['datasets', '데이터셋 추이', '▥'],
]

export function AdminLayout() {
  const { pathname } = useLocation()
  const analyzing = pathname.includes('/insights')
  const [expanded, setExpanded] = useState(false)
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const summary = useQuery({
    queryKey: ['backoffice', 'notification-summary'],
    queryFn: () =>
      backoffice.get<{ unread: number; openCritical: number }>('/api/admin/notifications/summary'),
  })
  return (
    <div className="bo-shell">
      <a className="bo-skip" href="#main-content">
        본문으로 이동
      </a>
      <aside className={`bo-sidebar ${expanded ? 'is-open' : ''}`}>
        <Link to="/admin/home" className="bo-brand">
          <span className="bo-logo">⠎</span>세모점
        </Link>
        <p className="bo-sidebar-sub">{analyzing ? 'BUSINESS INSIGHTS' : 'OPERATIONS CONSOLE'}</p>
        <div className="bo-switch">
          <Link
            className={!analyzing ? 'active' : ''}
            to="/admin/home"
            onClick={() => setExpanded(false)}
          >
            백오피스
          </Link>
          <Link
            className={analyzing ? 'active' : ''}
            to="/admin/insights/overview"
            onClick={() => setExpanded(false)}
          >
            인사이트
          </Link>
        </div>
        <nav aria-label={analyzing ? '인사이트 메뉴' : '운영 메뉴'}>
          {(analyzing ? insights : operations).map(([path, title, icon]) => (
            <NavLink
              key={path}
              to={`/admin/${analyzing ? 'insights/' : ''}${path}`}
              onClick={() => setExpanded(false)}
              className={({ isActive }) => `bo-nav-link ${isActive ? 'active' : ''}`}
            >
              <span aria-hidden>{icon}</span>
              {title}
            </NavLink>
          ))}
        </nav>
        <div className="bo-sidebar-bottom">
          <span className="bo-live-dot" />
          {isMockApi
            ? '예시 데이터'
            : `${import.meta.env.VITE_ENV_LABEL ?? 'API 연결'} · 운영자 콘솔`}
          <small>세모점 운영 · 제품 개선</small>
        </div>
      </aside>
      <div className="bo-workspace">
        <header className="bo-topbar">
          <button
            className="btn bo-menu"
            aria-label="메뉴 열기"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            ☰
          </button>
          <span>
            {analyzing ? '비즈니스 인사이트' : '운영 백오피스'}
            <small> / 세모점</small>
          </span>
          <div className="bo-top-actions">
            <Link to="/admin/notifications" className="btn btn--sm">
              알림 {summary.data?.unread ?? '—'}
            </Link>
            <span className="bo-avatar" aria-hidden>
              {session?.loginId.slice(0, 1).toUpperCase()}
            </span>
            <span className="bo-login-id">{session?.loginId}</span>
            <button
              className="btn btn--sm"
              onClick={async () => {
                await logout()
                navigate('/login', { replace: true })
              }}
            >
              로그아웃
            </button>
          </div>
        </header>
        <main id="main-content" className="bo-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
