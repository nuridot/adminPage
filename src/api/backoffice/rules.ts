export const contractTransitions: Record<string, string[]> = {
  DRAFT: ['INTERNAL_REVIEW', 'TERMINATED'],
  INTERNAL_REVIEW: ['DRAFT', 'SIGNATURE_REQUESTED', 'TERMINATED'],
  SIGNATURE_REQUESTED: ['DRAFT', 'SIGNED_RECEIVED', 'TERMINATED'],
  SIGNED_RECEIVED: ['ACTIVE', 'TERMINATED'],
  ACTIVE: ['EXPIRED', 'TERMINATED'],
  EXPIRED: [],
  TERMINATED: [],
}

export function operationMessage(result: unknown): string {
  const status = result && typeof result === 'object' && 'status' in result ? result.status : null
  if (status === 'SEND_FAILED') return '발송하지 못했습니다. 실패 사유를 확인하세요.'
  if (status === 'SEND_UNCERTAIN' || status === 'SEND_REQUESTED')
    return '발송 결과가 아직 확인되지 않았습니다. 결과 조회로 확인하세요.'
  if (status === 'PROVIDER_ACCEPTED')
    return '메일 제공자가 접수했습니다. 상대 메일함 도착 여부는 확인되지 않습니다.'
  return '처리가 완료되었습니다.'
}

export function validateOperation(path: string, body: Record<string, unknown>): string | null {
  if (
    path.includes('/secrets') &&
    body.reference &&
    !/^(\/[\w.-]+\/[\w./-]+|arn:aws:[^\s]+|(?:op|vault):\/\/[^\s]+)$/.test(String(body.reference))
  ) {
    return '비밀 원문 대신 SSM 경로, AWS ARN, 1Password 또는 Vault 참조 주소를 입력하세요.'
  }
  const terms = (typeof body.terms === 'object' && body.terms ? body.terms : body) as Record<
    string,
    unknown
  >
  if (path.includes('/contracts')) {
    if (terms.startDate && terms.endDate && String(terms.endDate) < String(terms.startDate))
      return '계약 종료일은 시작일 이후여야 합니다.'
    if (Number(terms.amountKrw) < 0 || Number(terms.monthlyFeeKrw) < 0)
      return '계약 금액은 0 이상이어야 합니다.'
    if (body.status === 'TERMINATED' && (!body.reason || !body.endedOn))
      return '해지 사유와 종료 효력일을 입력하세요.'
  }
  if (/\/credit\/wallets\/.+\/(grants|adjustments)$/.test(path)) {
    if (
      !Number.isSafeInteger(body.amount) ||
      body.amount === 0 ||
      (path.endsWith('/grants') && Number(body.amount) < 0)
    )
      return '크레딧은 0이 아닌 정수이며 지급량은 양수여야 합니다.'
  }
  if (path.includes('/releases')) {
    if (
      body.targetScope === 'ORGS' &&
      (!Array.isArray(body.targetOrgIds) || !body.targetOrgIds.length)
    )
      return '선택 기관 배포의 대상 기관을 입력하세요.'
    if (body.targetScope === 'ALL' && Array.isArray(body.targetOrgIds) && body.targetOrgIds.length)
      return '전체 대상 배포에서는 기관 목록을 비워 주세요.'
    if (body.checksumSha256 && !/^[0-9a-f]{64}$/.test(String(body.checksumSha256)))
      return 'SHA-256은 소문자 16진수 64자리여야 합니다.'
  }
  if (path.endsWith('/sales/opportunities') && !body.organizationId && !body.prospectName)
    return '기관 ID 또는 잠재 기관명을 입력하세요.'
  if (path.endsWith('/close') && ['LOST', 'ON_HOLD'].includes(String(body.outcome)) && !body.reason)
    return '실패·보류 사유를 입력하세요.'
  if (path.endsWith('/datasets/records') && Number(body.cumulativeQuantity) < 0)
    return '누적 수량은 0 이상이어야 합니다. 감소 정정은 변경 후 누적량으로 입력하세요.'
  if (
    Array.isArray(body.extraItems) &&
    body.extraItems.some((i) => !i.description || !(i.quantity > 0) || !(i.unitPrice >= 0))
  )
    return '추가 품목의 설명, 양수 수량, 0 이상 단가를 입력하세요.'
  return null
}
