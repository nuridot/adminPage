import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { backoffice, type Params } from '@/api/backoffice/client'
import { action } from '@/api/backoffice/actions'
import { contractTransitions } from '@/api/backoffice/rules'
import { getStoredSession } from '@/api/http/session'
import type { Json, Row } from '@/api/backoffice/types'
import {
  ActionDialog,
  asRow,
  Details,
  displayValue,
  labels,
  rowsOf,
  textOf,
  valueLabels,
  type Action,
  type Field,
} from '@/components/Workflow'
import { PageHeading, Panel } from '@/components/backoffice'
import { Pagination, Query } from '@/components/ui'
import { opsTarget } from './OpsHomePage'

interface Tab {
  key: string
  label: string
  path: string
  columns: string[]
  rowsKey?: string
  paged?: boolean
  filters?: Field[]
  detailPath?: string
  detailKey?: string
  unwrap?: string
  rowId?: string
}
interface Module {
  title: string
  description: string
  tabs: Tab[]
}
const orgFilter: Field = { key: 'orgId', label: '기관 ID' }
const statusFilter = (options: string[]): Field => ({
  key: 'status',
  label: '상태',
  type: 'select',
  options,
})
const contractStates = [
  'DRAFT',
  'INTERNAL_REVIEW',
  'SIGNATURE_REQUESTED',
  'SIGNED_RECEIVED',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
]
const modules: Record<string, Module> = {
  orders: {
    title: '크레딧 주문 · 지급',
    description: '주문과 입금 확인, 증빙을 관리하고 입금된 주문을 한 번만 지급합니다.',
    tabs: [
      {
        key: 'orders',
        label: '주문',
        path: '/api/admin/orders',
        columns: [
          'orderDate',
          'orgName',
          'description',
          'amountKrw',
          'creditAmount',
          'paidAt',
          'invoiceStatus',
        ],
        filters: [{ key: 'organizationId', label: '기관 ID' }],
      },
    ],
  },
  contracts: {
    title: '계약 · 갱신',
    description: '조건과 버전, 서명본, 효력과 갱신 이력을 연결합니다.',
    tabs: [
      {
        key: 'contracts',
        label: '전체 계약',
        path: '/api/admin/contracts',
        columns: [
          'contractNo',
          'organizationName',
          'status',
          'monthlyFeeKrw',
          'startDate',
          'endDate',
        ],
        filters: [orgFilter, statusFilter(contractStates)],
        detailPath: '/api/admin/contracts/',
        unwrap: 'contract',
      },
      {
        key: 'expiring',
        label: '만료 예정',
        path: '/api/admin/contracts/expiring',
        columns: ['contractNo', 'organizationName', 'endDate', 'daysLeft', 'renewalStatus'],
        filters: [{ key: 'days', label: '만료까지 일수', type: 'number' }],
        detailPath: '/api/admin/contracts/',
        unwrap: 'contract',
      },
    ],
  },
  billing: {
    title: '청구 · 수금',
    description: '월 청구와 실제 입금, 배분·환불·미수를 구분해 관리합니다.',
    tabs: [
      {
        key: 'invoices',
        label: '청구',
        path: '/api/admin/billing/invoices',
        columns: [
          'invoiceNo',
          'organizationName',
          'totalAmount',
          'allocatedAmount',
          'outstandingAmount',
          'collectionStatus',
          'dueDate',
        ],
        filters: [
          orgFilter,
          { key: 'month', label: '청구 월', type: 'month' },
          statusFilter(['ISSUED', 'CANCELLED', 'CORRECTED']),
          { key: 'latestOnly', label: '최신 버전만', type: 'checkbox' },
        ],
        detailPath: '/api/admin/billing/invoices/',
        unwrap: 'invoice',
      },
      {
        key: 'payments',
        label: '입금 · 배분',
        path: '/api/admin/billing/payments',
        columns: [
          'receivedOn',
          'organizationName',
          'payerName',
          'amount',
          'allocatedAmount',
          'refundedAmount',
          'unallocatedAmount',
          'status',
        ],
        filters: [orgFilter],
        detailPath: '/api/admin/billing/payments/',
      },
      {
        key: 'receivables',
        label: '미수',
        path: '/api/admin/billing/receivables',
        columns: [
          'invoiceNo',
          'organizationName',
          'dueDate',
          'outstandingAmount',
          'daysOverdue',
          'collectionStatus',
        ],
        rowsKey: 'invoices',
        filters: [orgFilter],
        detailPath: '/api/admin/billing/invoices/',
        unwrap: 'invoice',
      },
    ],
  },
  documents: {
    title: '정산 문서',
    description: '확정 청구를 기준으로 PDF를 발행하고 공유·정정 이력을 관리합니다.',
    tabs: [
      {
        key: 'invoices',
        label: '청구서 · 거래명세서',
        path: '/api/admin/billing/invoices',
        columns: ['invoiceNo', 'organizationName', 'version', 'issueDate', 'totalAmount', 'status'],
        filters: [orgFilter],
        detailPath: '/api/admin/billing/invoices/',
        unwrap: 'invoice',
      },
      {
        key: 'tax-invoices',
        label: '세금계산서 수동 등록',
        path: '/api/admin/billing/tax-invoices',
        columns: [
          'invoiceNo',
          'approvalNo',
          'issueDate',
          'supplyAmount',
          'vatAmount',
          'status',
          'fileName',
        ],
        filters: [orgFilter],
      },
    ],
  },
  sales: {
    title: '영업 기회',
    description: '기관 발굴부터 견적·계약까지, 단계 이동과 후속 연락을 기록합니다.',
    tabs: [
      {
        key: 'opportunities',
        label: '영업 기회',
        path: '/api/admin/sales/opportunities',
        columns: [
          'title',
          'organizationName',
          'prospectName',
          'stageName',
          'ownerName',
          'expectedMonthlyFeeKrw',
          'nextFollowUpAt',
          'status',
        ],
        paged: true,
        filters: [
          { key: 'q', label: '기관 · 제목 검색' },
          statusFilter(['OPEN', 'CLOSED']),
          { key: 'stageCode', label: '단계 코드' },
          { key: 'ownerUserId', label: '담당자 ID' },
          { key: 'from', label: '생성 시작일', type: 'date' },
          { key: 'to', label: '생성 종료일', type: 'date' },
        ],
        detailPath: '/api/admin/sales/opportunities/',
        unwrap: 'opportunity',
      },
    ],
  },
  releases: {
    title: '버전 · 릴리즈',
    description: '설치 파일과 노트를 검토한 뒤, 대상별로 공개하거나 중지합니다.',
    tabs: [
      {
        key: 'releases',
        label: '릴리즈',
        path: '/api/admin/releases',
        columns: [
          'version',
          'platform',
          'channel',
          'targetScope',
          'signatureStatus',
          'noteStatus',
          'displayStatus',
        ],
        detailPath: '/api/admin/releases/',
      },
    ],
  },
  incidents: {
    title: '장애 사건',
    description: '영향과 담당자를 확인하고 대응 내용을 시간순으로 기록합니다.',
    tabs: [
      {
        key: 'incidents',
        label: '장애 사건',
        path: '/api/admin/incidents',
        columns: ['title', 'severity', 'status', 'affectedJobCount', 'startedAt', 'assigneeUserId'],
        paged: true,
        filters: [{ key: 'open', label: '진행 중 사건만', type: 'checkbox' }],
        detailPath: '/api/admin/incidents/',
      },
    ],
  },
  datasets: {
    title: '데이터셋 현황',
    description: '보유 자료의 기준일·누적 수량·단위와 출처를 수동 기록합니다.',
    tabs: [
      {
        key: 'datasets',
        label: '현재 보유량',
        path: '/api/admin/datasets',
        columns: ['datasetName', 'latestQuantity', 'unit', 'asOf', 'source', 'recordedAt'],
        rowsKey: 'datasets',
        rowId: 'datasetName',
      },
      {
        key: 'records',
        label: '기록 · 정정 이력',
        path: '/api/admin/datasets/records',
        columns: [
          'datasetName',
          'asOf',
          'cumulativeQuantity',
          'unit',
          'source',
          'correctionReason',
          'effective',
        ],
        filters: [{ key: 'datasetName', label: '자료명', required: true }],
      },
    ],
  },
  security: {
    title: '보안 · 설정',
    description: '시크릿의 원문 없이 소유·만료·교체 현황을 관리하고 주요 변경을 감사합니다.',
    tabs: [
      {
        key: 'secrets',
        label: '시크릿 메타정보',
        path: '/api/admin/secrets',
        columns: ['name', 'environment', 'owner', 'purpose', 'expiresOn', 'expiryState'],
        detailPath: '/api/admin/secrets/',
      },
      {
        key: 'audit',
        label: '감사 이력',
        path: '/api/admin/audit-logs',
        columns: ['occurredAt', 'actorLoginId', 'action', 'targetType', 'targetId', 'success'],
        paged: true,
        filters: [
          { key: 'from', label: '시작일 (KST)', type: 'date' },
          { key: 'to', label: '종료일 (KST)', type: 'date' },
          { key: 'actor', label: '처리자' },
          { key: 'targetType', label: '대상 종류' },
          { key: 'action', label: '작업 종류' },
        ],
      },
    ],
  },
  notifications: {
    title: '운영 알림함',
    description: '읽음은 나에게, 처리 완료는 모든 운영자에게 반영됩니다.',
    tabs: [
      {
        key: 'notifications',
        label: '알림',
        path: '/api/admin/notifications',
        columns: [
          'title',
          'kind',
          'severity',
          'occurrenceCount',
          'lastOccurredAt',
          'read',
          'acknowledged',
        ],
        paged: true,
        filters: [
          {
            key: 'kind',
            label: '종류',
            type: 'select',
            options: [
              'UNPAID',
              'CONTRACT_EXPIRY',
              'LOW_BALANCE',
              'MAIL_ERROR',
              'SECRET_EXPIRY',
              'INCIDENT',
              'MAIL_REPLY_DUE',
            ],
          },
          { key: 'unreadOnly', label: '안 읽은 알림만', type: 'checkbox' },
          { key: 'includeAcknowledged', label: '처리 완료 포함', type: 'checkbox' },
        ],
      },
    ],
  },
}

function createActions(module: string, tab: string): Action[] {
  if (module === 'orders')
    return [
      action(
        '주문 등록',
        'POST',
        '/api/admin/orders',
        {},
        {
          required: ['organizationId', 'orderDate', 'description', 'amountKrw'],
          hint: '주문 금액은 부가세 포함입니다. 주문 등록만으로 크레딧이 지급되지는 않습니다.',
        },
      ),
    ]
  if (module === 'contracts')
    return [
      action(
        '계약 초안 만들기',
        'POST',
        '/api/admin/contracts',
        {},
        {
          required: [
            'organizationId',
            'planType',
            'startDate',
            'endDate',
            'amountKrw',
            'monthlyFeeKrw',
          ],
          hint: '금액은 공급가입니다. 갱신 계약이면 이전 계약 ID를 연결하세요.',
        },
      ),
    ]
  if (module === 'billing')
    return tab === 'payments'
      ? [
          action(
            '입금 기록',
            'POST',
            '/api/admin/billing/payments',
            {},
            {
              required: ['organizationId', 'receivedOn', 'amount', 'payerName'],
              hint: '실제 은행 입금을 기록합니다. 청구에 배분하지 않은 금액은 미배분으로 남습니다.',
            },
          ),
        ]
      : [
          action(
            '월 청구 발행',
            'POST',
            '/api/admin/billing/invoices',
            {},
            {
              required: ['contractId', 'billingMonth'],
              initial: { includeMonthlyFee: true },
              hint: '같은 계약·월의 중복 청구는 서버에서 차단됩니다.',
            },
          ),
        ]
  if (module === 'documents' && tab === 'tax-invoices')
    return [
      action(
        '세금계산서 수동 등록',
        'POST',
        '/api/admin/billing/tax-invoices',
        {},
        {
          upload: true,
          uploadOptional: true,
          maxFileMB: 20,
          fields: [
            { key: 'invoiceId', label: '청구 ID' },
            { key: 'approvalNo', label: '국세청 승인 번호' },
            { key: 'issueDate', label: '발행일', type: 'date' },
            { key: 'supplyAmount', label: '공급가', type: 'number' },
            { key: 'vatAmount', label: '세액', type: 'number' },
            { key: 'memo', label: '메모', type: 'textarea' },
          ],
          required: ['invoiceId', 'approvalNo', 'issueDate'],
          hint: '외부에서 발행한 세금계산서를 등록합니다. 청구서 PDF와는 다른 문서입니다.',
        },
      ),
    ]
  if (module === 'sales')
    return [
      action(
        '영업 기회 생성',
        'POST',
        '/api/admin/sales/opportunities',
        {},
        { required: ['title'], hint: '기존 기관 ID 또는 잠재 기관명 중 하나를 입력하세요.' },
      ),
    ]
  if (module === 'releases')
    return [
      action(
        '릴리즈 초안 등록',
        'POST',
        '/api/admin/releases',
        {},
        { required: ['platform', 'channel', 'version', 'minSupportedVersion'] },
      ),
    ]
  if (module === 'incidents')
    return [
      action(
        '장애 사건 등록',
        'POST',
        '/api/admin/incidents',
        {},
        { required: ['title', 'severity'], hint: 'SEV1 사건은 긴급 운영 알림이 생성됩니다.' },
      ),
    ]
  if (module === 'datasets')
    return [
      action(
        '데이터셋 수량 기록',
        'POST',
        '/api/admin/datasets/records',
        {},
        {
          required: ['datasetName', 'asOf', 'cumulativeQuantity', 'unit', 'source'],
          hint: '기준일의 누적 수량을 입력합니다. 같은 기준일 정정이면 사유가 필요하며 이전 기록은 보존됩니다.',
        },
      ),
    ]
  if (module === 'security' && tab === 'secrets')
    return [
      action(
        '시크릿 메타정보 등록',
        'POST',
        '/api/admin/secrets',
        {},
        {
          required: ['name', 'environment', 'reference'],
          hint: '비밀값을 입력하지 마세요. 비밀 저장소의 참조 주소와 운영 정보만 기록합니다.',
        },
      ),
    ]
  if (module === 'notifications')
    return [action('모든 알림 읽음', 'POST', '/api/admin/notifications/read-all')]
  return []
}

function detailActions(module: string, tab: string, raw: Row): Action[] {
  const r = asRow(raw.contract ?? raw.invoice ?? raw.opportunity ?? raw)
  const id = String(r.id ?? '')
  const initial = { ...r, ...asRow(rowsOf(raw.versions)[0]) }
  if (module === 'orders')
    return [
      action(
        '입금 · 계산서 기록',
        'PATCH',
        '/api/admin/orders/{orderId}',
        { orderId: id },
        {
          initial: { paidAt: r.paidAt, invoiceStatus: r.invoiceStatus },
          fields: [
            { key: 'paidAt', label: '입금 확인일', type: 'date' },
            {
              key: 'invoiceStatus',
              label: '계산서 상태',
              type: 'select',
              options: ['PENDING', 'ISSUED'],
            },
          ],
        },
      ),
      ...(r.paidAt && Number(r.creditAmount) > 0
        ? [
            action(
              '주문 크레딧 지급',
              'POST',
              '/api/admin/credit/orders/{orderId}/grant',
              { orderId: id },
              {
                idempotent: true,
                hint: `${textOf(r.orgName)} · ${textOf(r.creditAmount)} 크레딧. 주문당 한 번만 지급하며 기관 배정량도 함께 올라갑니다. 이미 지급했다는 응답이면 원장을 확인하세요. 기관 배정량을 다시 수동으로 올리지 마세요.`,
              },
            ),
          ]
        : []),
      ...['receipt', 'quote'].flatMap((kind) => [
        action(
          kind === 'receipt' ? '증빙 업로드' : '견적서 업로드',
          'POST',
          `/api/admin/orders/{orderId}/${kind}`,
          { orderId: id },
          { upload: true },
        ),
        ...(r[kind + 'FileName']
          ? [
              action(
                kind === 'receipt' ? '증빙 받기' : '견적서 받기',
                'GET',
                `/api/admin/orders/{orderId}/${kind}`,
                { orderId: id },
                { download: true },
              ),
            ]
          : []),
      ]),
    ]
  if (module === 'contracts')
    return [
      ...(r.status === 'DRAFT' || r.status === 'INTERNAL_REVIEW'
        ? [
            action(
              '계약 조건 수정',
              'PATCH',
              '/api/admin/contracts/{contractId}',
              { contractId: id },
              { initial },
            ),
          ]
        : []),
      ...(['DRAFT', 'INTERNAL_REVIEW', 'SIGNATURE_REQUESTED'].includes(String(r.status))
        ? [
            action(
              '조건 변경 · 새 버전',
              'POST',
              '/api/admin/contracts/{contractId}/versions',
              { contractId: id },
              { initial, required: ['changeNote'] },
            ),
          ]
        : []),
      ...((contractTransitions[String(r.status)] ?? []).length
        ? [
            action(
              '계약 상태 변경',
              'POST',
              '/api/admin/contracts/{contractId}/status',
              { contractId: id },
              {
                required: ['status'],
                choices: { status: contractTransitions[String(r.status)] ?? [] },
                hint: `현재 ${valueLabels[String(r.status)] ?? r.status}. 해지는 효력일과 사유를 확인해 주세요. 허용되는 전이는 서버에서 검증합니다.`,
              },
            ),
          ]
        : []),
      ...(!['ACTIVE', 'EXPIRED', 'TERMINATED'].includes(String(r.status))
        ? [
            action(
              '서명본 업로드',
              'POST',
              '/api/admin/contracts/{contractId}/signed-file',
              { contractId: id },
              {
                upload: true,
                maxFileMB: 20,
                hint: '현재 계약 버전의 서명본을 보관합니다. 다시 올리면 교체됩니다.',
              },
            ),
          ]
        : []),
      action(
        '갱신 계약 초안',
        'POST',
        '/api/admin/contracts',
        {},
        {
          initial: { organizationId: r.organizationId, renewedFromId: r.id },
          required: [
            'organizationId',
            'planType',
            'startDate',
            'endDate',
            'amountKrw',
            'monthlyFeeKrw',
          ],
        },
      ),
      ...rowsOf(raw.versions)
        .filter((v) => v.signedFileName)
        .map((v) =>
          action(
            `v${v.version} 서명본 받기`,
            'GET',
            '/api/admin/contracts/{contractId}/versions/{version}/signed-file',
            { contractId: id, version: String(v.version) },
            { download: true },
          ),
        ),
    ]
  if (
    (module === 'billing' && tab !== 'payments') ||
    (module === 'documents' && tab === 'invoices')
  )
    return [
      ...(r.status === 'ISSUED'
        ? [
            action(
              '청구 정정',
              'POST',
              '/api/admin/billing/invoices/{invoiceId}/corrections',
              { invoiceId: id },
              {
                required: ['note'],
                initial: { includeMonthlyFee: true },
                hint: '새 버전으로 정정하고 입금 배분을 이동합니다. 전체 항목을 다시 확인하세요.',
              },
            ),
            action(
              '청구 취소',
              'POST',
              '/api/admin/billing/invoices/{invoiceId}/cancel',
              { invoiceId: id },
              { required: ['reason'] },
            ),
            action(
              '미납 처리 기록',
              'POST',
              '/api/admin/billing/invoices/{invoiceId}/collection-events',
              { invoiceId: id },
              {
                required: ['type', 'note'],
                choices: { type: ['CONTACT', 'GRACE', 'RESTRICT', 'RELEASE'] },
                hint: '제한은 운영 기록입니다. 변환·로그인 이용을 자동으로 막지는 않습니다.',
              },
            ),
            action(
              '정산 PDF 발행',
              'POST',
              '/api/admin/billing/invoices/{invoiceId}/documents',
              { invoiceId: id },
              {
                required: ['type'],
                choices: { type: ['INVOICE', 'STATEMENT'] },
                hint: '확정 데이터 스냅샷으로 청구서 또는 거래명세서를 발행합니다.',
              },
            ),
          ]
        : []),
      ...rowsOf(raw.documents).flatMap((d) => [
        action(
          `${textOf(d.documentNo)} 받기`,
          'GET',
          '/api/admin/billing/documents/{documentId}/download',
          { documentId: String(d.id) },
          { download: true },
        ),
        action(
          `${textOf(d.documentNo)} 공유 설정`,
          'PATCH',
          '/api/admin/billing/documents/{documentId}/share',
          { documentId: String(d.id) },
          { initial: { shared: d.sharedWithOrg ?? false } },
        ),
      ]),
    ]
  if (module === 'billing' && tab === 'payments')
    return r.status === 'VALID'
      ? [
          action(
            '청구에 입금 배분',
            'POST',
            '/api/admin/billing/payments/{paymentId}/allocations',
            { paymentId: id },
            { required: ['invoiceId', 'amount'] },
          ),
          action(
            '남은 금액 환불 기록',
            'POST',
            '/api/admin/billing/payments/{paymentId}/refunds',
            { paymentId: id },
            { required: ['amount', 'refundedOn', 'reason'] },
          ),
          action(
            '잘못된 입금 무효 처리',
            'POST',
            '/api/admin/billing/payments/{paymentId}/void',
            { paymentId: id },
            { required: ['reason'] },
          ),
          ...rowsOf(raw.allocations)
            .filter((a) => a.status === 'VALID')
            .map((a) =>
              action(
                `${textOf(a.invoiceNo)} 배분 해제`,
                'DELETE',
                '/api/admin/billing/payments/{paymentId}/allocations/{allocationId}',
                { paymentId: id, allocationId: String(a.id) },
                { hint: `배분 금액 ${textOf(a.amount)}원을 입금의 미배분 금액으로 돌립니다.` },
              ),
            ),
        ]
      : []
  if (module === 'documents' && tab === 'tax-invoices')
    return [
      action(
        '세금계산서 파일 받기',
        'GET',
        '/api/admin/billing/tax-invoices/{taxInvoiceId}/file',
        { taxInvoiceId: id },
        { download: true },
      ),
      ...(r.status === 'ISSUED'
        ? [
            action(
              '세금계산서 등록 취소',
              'POST',
              '/api/admin/billing/tax-invoices/{taxInvoiceId}/cancel',
              { taxInvoiceId: id },
              { required: ['reason'], hint: '외부 취소·수정 발행 후 해당 이력을 기록합니다.' },
            ),
          ]
        : []),
    ]
  if (module === 'sales')
    return [
      ...(r.status === 'OPEN'
        ? [
            action(
              '영업 기회 수정',
              'PATCH',
              '/api/admin/sales/opportunities/{opportunityId}',
              { opportunityId: id },
              {
                initial: {
                  ...r,
                  memo: raw.memo ?? null,
                  contactName: asRow(raw.contact).name ?? null,
                  contactPhone: asRow(raw.contact).phone ?? null,
                  contactEmail: asRow(raw.contact).email ?? null,
                },
              },
            ),
            action(
              '단계 변경',
              'POST',
              '/api/admin/sales/opportunities/{opportunityId}/stage',
              { opportunityId: id },
              { required: ['stageCode'] },
            ),
            action(
              '견적 등록',
              'POST',
              '/api/admin/sales/opportunities/{opportunityId}/quotes',
              { opportunityId: id },
              { required: ['amountKrw', 'monthlyFeeKrw'] },
            ),
            action(
              '계약 연결',
              'PUT',
              '/api/admin/sales/opportunities/{opportunityId}/contract',
              { opportunityId: id },
              { required: ['contractId'] },
            ),
            action(
              '영업 기회 종료',
              'POST',
              '/api/admin/sales/opportunities/{opportunityId}/close',
              { opportunityId: id },
              {
                required: ['outcome'],
                hint: '성사·실패·보류로 종료하면 수정할 수 없습니다. 실패·보류는 사유를 입력하세요.',
              },
            ),
          ]
        : []),
      ...rowsOf(raw.quotes).flatMap((q) => [
        action(
          `견적 ${String(q.id).slice(0, 8)} 파일 올리기`,
          'POST',
          '/api/admin/sales/opportunities/{opportunityId}/quotes/{quoteId}/file',
          { opportunityId: id, quoteId: String(q.id) },
          { upload: true },
        ),
        ...(q.fileName
          ? [
              action(
                `${textOf(q.fileName)} 받기`,
                'GET',
                '/api/admin/sales/opportunities/{opportunityId}/quotes/{quoteId}/file',
                { opportunityId: id, quoteId: String(q.id) },
                { download: true },
              ),
            ]
          : []),
      ]),
    ]
  if (module === 'releases')
    return [
      ...(r.status === 'DRAFT'
        ? [
            action(
              '릴리즈 초안 수정',
              'PUT',
              '/api/admin/releases/{releaseId}',
              { releaseId: id },
              { initial: r, required: ['minSupportedVersion'] },
            ),
          ]
        : []),
      action(
        '서명 확인 결과 기록',
        'PATCH',
        '/api/admin/releases/{releaseId}/signature',
        { releaseId: id },
        { required: ['signatureStatus'] },
      ),
      action(
        '릴리즈 노트 작성',
        'PUT',
        '/api/admin/releases/{releaseId}/notes',
        { releaseId: id },
        { initial: asRow(r.notes), hint: '노트를 고치면 다시 초안이 됩니다.' },
      ),
      ...(r.noteStatus === 'DRAFT'
        ? [
            action('노트 검토 요청', 'POST', '/api/admin/releases/{releaseId}/notes/submit', {
              releaseId: id,
            }),
          ]
        : []),
      ...(r.noteStatus === 'IN_REVIEW'
        ? [
            action('노트 승인', 'POST', '/api/admin/releases/{releaseId}/notes/approve', {
              releaseId: id,
            }),
            action('노트 반려', 'POST', '/api/admin/releases/{releaseId}/notes/reject', {
              releaseId: id,
            }),
          ]
        : []),
      ...(r.status === 'DRAFT' && r.noteStatus === 'APPROVED'
        ? [
            action(
              '릴리즈 공개 · 예약',
              'POST',
              '/api/admin/releases/{releaseId}/publish',
              { releaseId: id },
              {
                hint: `버전 ${r.version} · ${r.channel} · 대상 ${r.targetScope}. 공개 시각을 비우면 즉시 공개합니다. 서명·노트·대상을 다시 확인하세요.`,
              },
            ),
          ]
        : []),
      ...(r.status === 'PUBLISHED'
        ? [
            action(
              '배포 중지',
              'POST',
              '/api/admin/releases/{releaseId}/halt',
              { releaseId: id },
              {
                required: ['reason'],
                hint: '업데이트 공개를 중지합니다. 이미 설치된 앱을 자동 강등하지 않습니다.',
              },
            ),
          ]
        : []),
      ...(r.status === 'HALTED'
        ? [
            action(
              '릴리즈 재공개',
              'POST',
              '/api/admin/releases/{releaseId}/resume',
              { releaseId: id },
              { hint: `버전 ${r.version} · ${r.channel} · ${r.targetScope} 대상` },
            ),
          ]
        : []),
    ]
  if (module === 'incidents')
    return [
      action(
        '사건 정보 수정',
        'PUT',
        '/api/admin/incidents/{incidentId}',
        { incidentId: id },
        { initial: r, required: ['title', 'severity'] },
      ),
      action(
        '사건 상태 변경',
        'PATCH',
        '/api/admin/incidents/{incidentId}/status',
        { incidentId: id },
        {
          required: ['status'],
          choices: { status: ['OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED'] },
        },
      ),
      action(
        '대응 메모 추가',
        'POST',
        '/api/admin/incidents/{incidentId}/notes',
        { incidentId: id },
        { required: ['body'], hint: '기록은 쌓기만 하며 수정·삭제하지 않습니다.' },
      ),
    ]
  if (module === 'security' && tab === 'secrets')
    return [
      action(
        '메타정보 수정',
        'PUT',
        '/api/admin/secrets/{secretId}',
        { secretId: id },
        {
          initial: r,
          required: ['reference'],
          choices: { status: ['ACTIVE', 'ROTATING', 'REVOKED'] },
          hint: '비밀 원문을 입력하지 마세요.',
        },
      ),
      action(
        '교체 완료 기록',
        'POST',
        '/api/admin/secrets/{secretId}/rotate',
        { secretId: id },
        { required: ['rotatedOn'] },
      ),
    ]
  if (module === 'notifications')
    return [
      ...(!r.read
        ? [
            action('이 알림 읽음', 'POST', '/api/admin/notifications/{notificationId}/read', {
              notificationId: id,
            }),
          ]
        : []),
      ...(!r.acknowledged
        ? [
            action(
              '알림 처리 완료',
              'POST',
              '/api/admin/notifications/{notificationId}/acknowledge',
              { notificationId: id },
              { hint: '모든 운영자에게 처리 완료로 표시됩니다.' },
            ),
          ]
        : []),
    ]
  if (module === 'datasets')
    return [
      action(
        '수량 기록 · 정정',
        'POST',
        '/api/admin/datasets/records',
        {},
        {
          initial: { datasetName: r.datasetName, unit: r.unit, source: r.source },
          required: ['datasetName', 'asOf', 'cumulativeQuantity', 'unit', 'source'],
          hint: '변경 후 누적량을 기록하세요. 같은 기준일이면 정정 사유가 필요합니다.',
        },
      ),
    ]
  return []
}

export function OperationsPage() {
  const { pathname } = useLocation()
  const parts = pathname.split('/').filter(Boolean)
  const moduleKey = parts[1]
  const config = modules[moduleKey]
  if (!config)
    return (
      <PageHeading
        title="화면을 찾을 수 없습니다"
        description="메뉴에서 이동할 화면을 선택하세요."
      />
    )
  return <ModuleScreen key={moduleKey} moduleKey={moduleKey} config={config} parts={parts} />
}
function ReleasePreview() {
  const [platform, setPlatform] = useState('WINDOWS')
  const [channel, setChannel] = useState('STABLE')
  const [orgId, setOrgId] = useState('')
  const [params, setParams] = useState<Params | null>(null)
  const preview = useQuery({
    queryKey: ['backoffice', 'release-preview', params],
    queryFn: async () =>
      (await backoffice.get<Row | undefined>('/api/admin/releases/preview', params ?? {})) ?? null,
    enabled: !!params,
  })
  return (
    <details className="bo-panel">
      <summary>기관별 업데이트 대상 미리보기</summary>
      <form
        className="bo-filters"
        onSubmit={(e) => {
          e.preventDefault()
          setParams({ platform, channel, orgId })
        }}
      >
        <label>
          플랫폼
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option>WINDOWS</option>
            <option>MACOS</option>
          </select>
        </label>
        <label>
          채널
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option>STABLE</option>
            <option>TEST</option>
          </select>
        </label>
        <label>
          기관 ID
          <input
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            placeholder="비우면 무소속 기준"
          />
        </label>
        <button className="btn" disabled={preview.isFetching}>
          대상 확인
        </button>
      </form>
      {params && (
        <Query state={preview}>
          {(r) =>
            r ? (
              <Details value={r} />
            ) : (
              <p className="bo-empty">현재 받을 수 있는 릴리즈가 없습니다.</p>
            )
          }
        </Query>
      )}
    </details>
  )
}
function MfaReset({ onAction }: { onAction: (a: Action) => void }) {
  const [loginId, setLoginId] = useState('')
  const self = loginId.trim() === getStoredSession()?.loginId
  return (
    <details className="bo-panel">
      <summary>운영자 2단계 인증 초기화</summary>
      <p className="bo-muted">
        인증 앱을 잃은 다른 운영자의 등록을 초기화합니다. 대상 세션이 해제되고 다음 로그인에서 다시
        등록합니다.
      </p>
      <form
        className="bo-filters"
        onSubmit={(e) => {
          e.preventDefault()
          if (!self)
            onAction(
              action(
                '운영자 2단계 인증 초기화',
                'DELETE',
                '/api/admin/accounts/{loginId}/mfa',
                { loginId: loginId.trim() },
                {
                  reviewOnly: true,
                  hint: `대상 계정 ${loginId.trim()}의 인증 앱·복구 코드를 초기화합니다. 본인 확인 후 실행합니다.`,
                },
              ),
            )
        }}
      >
        <label>
          대상 로그인 ID
          <input required value={loginId} onChange={(e) => setLoginId(e.target.value)} />
        </label>
        {self ? (
          <p>자기 계정은 다른 운영자에게 요청해 주세요.</p>
        ) : (
          <button className="btn" disabled={!loginId.trim()}>
            초기화 내용 확인
          </button>
        )}
      </form>
    </details>
  )
}
function ModuleScreen({
  moduleKey,
  config,
  parts,
}: {
  moduleKey: string
  config: Module
  parts: string[]
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  const tab =
    config.tabs.find(
      (t) => t.key === (config.tabs.some((x) => x.key === parts[2]) ? parts[2] : search.get('tab')),
    ) ?? config.tabs[0]
  const routeId = config.tabs.some((t) => t.key === parts[2]) ? parts[3] : parts[2]
  const [selected, setSelected] = useState<Row | null>(null)
  const [filters, setFilters] = useState<Record<string, string | boolean>>({
    open: true,
    latestOnly: true,
  })
  const [applied, setApplied] = useState<Params>(
    moduleKey === 'incidents'
      ? { open: true }
      : moduleKey === 'billing'
        ? { latestOnly: true }
        : {},
  )
  const [page, setPage] = useState(0)
  const [localQuery, setLocalQuery] = useState('')
  const [command, setCommand] = useState<Action | null>(null)
  const filterReady = !(tab.filters ?? []).some((f) => f.required && !applied[f.key])
  const query = useQuery({
    queryKey: ['backoffice', tab.path, applied, page],
    queryFn: () =>
      backoffice.get<Json>(tab.path, { ...applied, ...(tab.paged ? { page, size: 20 } : {}) }),
    enabled: filterReady,
  })
  const selectedId =
    routeId ?? (selected?.[tab.rowId ?? 'id'] == null ? '' : String(selected[tab.rowId ?? 'id']))
  const detail = useQuery({
    queryKey: ['backoffice', 'detail', tab.detailPath, selectedId],
    queryFn: () => backoffice.get<Row>(`${tab.detailPath}${encodeURIComponent(selectedId)}`),
    enabled: !!tab.detailPath && !!selectedId,
  })
  const listing = rowsOf(query.data, tab.rowsKey)
    .map((row) =>
      tab.key === 'expiring'
        ? { ...asRow(row.contract), daysLeft: row.daysLeft, renewalStatus: row.renewalStatus }
        : row,
    )
    .filter((row) => JSON.stringify(row).toLowerCase().includes(localQuery.toLowerCase()))
  const data = tab.detailPath
    ? detail.data
    : selected
      ? listing.find((r) => r[tab.rowId ?? 'id'] === selected[tab.rowId ?? 'id'])
      : null
  const stages = useQuery({
    queryKey: ['backoffice', 'sales-stages'],
    queryFn: () => backoffice.get<Json>('/api/admin/sales/stages'),
    enabled: moduleKey === 'sales',
  })
  const stageRows = rowsOf(stages.data).filter((s) => s.active === true)
  const stageFields = (a: Action): Action => ({
    ...a,
    fields: a.fields?.map((f) =>
      f.key === 'stageCode'
        ? {
            ...f,
            type: 'select',
            options: stageRows.map((s) => String(s.code)),
            optionLabels: Object.fromEntries(
              stageRows.map((s) => [String(s.code), String(s.name)]),
            ),
          }
        : f,
    ),
  })
  const create = createActions(moduleKey, tab.key).map(stageFields)
  const select = (row: Row) => {
    setSelected(row)
    if (tab.detailPath)
      navigate(
        `/admin/${moduleKey}/${tab.key}/${encodeURIComponent(String(row[tab.rowId ?? 'id']))}`,
      )
  }
  const changeTab = (key: string) => {
    setSelected(null)
    setPage(0)
    setFilters({ open: true, latestOnly: true })
    setApplied({})
    setSearch({ tab: key })
    navigate(`/admin/${moduleKey}?tab=${key}`)
  }
  const actions = data ? detailActions(moduleKey, tab.key, data).map(stageFields) : []
  return (
    <>
      <PageHeading
        title={config.title}
        description={config.description}
        actions={create.map((a) => (
          <button className="btn btn--primary" key={a.label} onClick={() => setCommand(a)}>
            + {a.label}
          </button>
        ))}
      />
      {moduleKey === 'releases' && <ReleasePreview />}
      {moduleKey === 'security' && <MfaReset onAction={setCommand} />}
      {config.tabs.length > 1 && (
        <div className="bo-tabs">
          {config.tabs.map((t) => (
            <button
              key={t.key}
              className={t.key === tab.key ? 'active' : ''}
              onClick={() => changeTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <form
        className="bo-filters"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(0)
          setApplied(
            Object.fromEntries(
              Object.entries(filters)
                .filter(([key]) => tab.filters?.some((f) => f.key === key))
                .map(([key, v]) => [
                  key,
                  tab.filters?.find((f) => f.key === key)?.type === 'datetime-local' &&
                  typeof v === 'string' &&
                  v
                    ? `${v}:00+09:00`
                    : v,
                ]),
            ),
          )
        }}
      >
        {tab.filters?.map((f) => (
          <label key={f.key}>
            {f.label}
            {f.type === 'select' ? (
              <select
                value={String(filters[f.key] ?? '')}
                onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}
              >
                <option value="">전체</option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {valueLabels[o] ?? o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.type ?? 'text'}
                required={f.required}
                value={f.type === 'checkbox' ? undefined : String(filters[f.key] ?? '')}
                checked={f.type === 'checkbox' ? filters[f.key] === true : undefined}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    [f.key]: f.type === 'checkbox' ? e.target.checked : e.target.value,
                  })
                }
              />
            )}
          </label>
        ))}
        {tab.filters?.length ? <button className="btn">조건 조회</button> : null}
        <label>
          현재 목록 검색
          <input
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="이름 · 번호"
          />
        </label>
        <button
          type="button"
          className="btn"
          onClick={() => void query.refetch()}
          disabled={!filterReady || query.isFetching}
        >
          새로고침
        </button>
      </form>
      {!filterReady ? (
        <p className="bo-callout">필수 조회 조건을 입력해 주세요.</p>
      ) : (
        <Query state={query}>
          {(result) => (
            <Panel title={tab.label}>
              <div className="bo-table-wrap">
                <table className="bo-table">
                  <thead>
                    <tr>
                      {tab.columns.map((c) => (
                        <th key={c}>{labels[c] ?? c}</th>
                      ))}
                      <th>상세</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listing.map((r, i) => (
                      <tr key={String(r[tab.rowId ?? 'id'] ?? i)}>
                        {tab.columns.map((c) => (
                          <td key={c}>
                            {typeof r[c] === 'string' && valueLabels[String(r[c])]
                              ? valueLabels[String(r[c])]
                              : displayValue(c, r[c])}
                          </td>
                        ))}
                        <td>
                          <button className="btn btn--sm" onClick={() => select(r)}>
                            보기
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!listing.length && <p className="bo-empty">조건에 맞는 기록이 없습니다.</p>}
              </div>
              {tab.paged && (
                <Pagination
                  currentPage={page + 1}
                  totalPages={Number(
                    asRow(result).totalPages ??
                      Math.ceil(
                        Number(asRow(result).totalCount ?? asRow(result).totalElements ?? 0) / 20,
                      ),
                  )}
                  onPageChange={(p) => setPage(p - 1)}
                />
              )}
              {moduleKey === 'datasets' && tab.key === 'datasets' && (
                <Details value={{ totals: asRow(result).totals ?? [] }} />
              )}
            </Panel>
          )}
        </Query>
      )}
      {selectedId && tab.detailPath && detail.isPending && (
        <Query state={detail}>{() => null}</Query>
      )}
      {detail.error && tab.detailPath && <Query state={detail}>{() => null}</Query>}
      {data && (
        <Panel
          title="상세 · 처리 이력"
          actions={
            <button
              className="btn btn--sm"
              onClick={() => {
                setSelected(null)
                navigate(`/admin/${moduleKey}?tab=${tab.key}`)
              }}
            >
              상세 닫기
            </button>
          }
        >
          {actions.length > 0 && (
            <div className="bo-actions">
              {actions.map((a) => (
                <button className="btn" key={a.path + a.label} onClick={() => setCommand(a)}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
          {moduleKey === 'notifications' && typeof data.link === 'string' && (
            <Link className="bo-text-link" to={opsTarget(data.link)}>
              알림 대상 보기 →
            </Link>
          )}
          {moduleKey === 'incidents' &&
            typeof data.sentryUrl === 'string' &&
            /^https:\/\//.test(data.sentryUrl) && (
              <a
                className="bo-text-link"
                href={data.sentryUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                Sentry에서 원인 보기 ↗
              </a>
            )}
          <Details
            value={
              data.contract || data.invoice || data.opportunity
                ? Object.fromEntries(
                    Object.entries({
                      ...data,
                      ...asRow(data.contract ?? data.invoice ?? data.opportunity),
                    }).filter(([k]) => !['contract', 'invoice', 'opportunity'].includes(k)),
                  )
                : data
            }
          />
        </Panel>
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
