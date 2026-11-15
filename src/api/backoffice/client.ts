import { isMockApi } from '@/api'
import { http } from '@/api/http/client'
import examples from './demo.json'
import type { Json } from './types'

export type Params = Record<string, string | number | boolean | undefined | null>
const fixtures = examples as Record<string, Json>
const state = new Map<string, Json>()

function match(path: string) {
  if (path in fixtures) return path
  return Object.keys(fixtures).find((pattern) =>
    new RegExp('^' + pattern.replace(/\{[^}]+\}/g, '[^/]+') + '$').test(path),
  )
}

export const backoffice = {
  async get<T>(path: string, query?: Params): Promise<T> {
    if (!isMockApi) return http.get<T>(path, query)
    await new Promise((resolve) => setTimeout(resolve, 120))
    const key = match(path)
    if (!key)
      throw new Error('이 화면의 예시 데이터가 없습니다. 실제 서버 모드에서 조회할 수 있습니다.')
    return structuredClone(state.get(path) ?? fixtures[key]) as T
  },
  async mutate<T>(
    method: string,
    path: string,
    body?: unknown,
    key?: string,
    formData?: FormData,
  ): Promise<T> {
    if (!isMockApi)
      return http.request<T>(method, path, {
        body: formData ? undefined : body,
        formData,
        headers: key ? { 'Idempotency-Key': key } : undefined,
      })
    // Demo changes must never be mistaken for a committed financial operation.
    throw new Error('예시 데이터는 조회 전용입니다. 변경하려면 실제 서버에 연결해 주세요.')
  },
}
