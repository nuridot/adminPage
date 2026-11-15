import type { Session } from '@/api/types'

export interface MfaStep {
  mfaRequired: true
  mfaStep: 'ENROLL' | 'VERIFY'
  mfaToken: string
  mfaTokenExpiresIn: number
}

export class MfaChallenge extends Error {
  constructor(
    readonly challenge: MfaStep,
    readonly loginId: string,
  ) {
    super('2단계 인증이 필요합니다.')
  }
}

export interface MfaResult extends Omit<Session, 'loginId'> {
  adminScope: string
  recoveryCodes: string[] | null
  recoveryCodesRemaining: number
}
