import schemas from './schemas.json'
import { labels, type Action, type Field } from '@/components/Workflow'
import type { Json, Row } from './types'
import { validateOperation } from './rules'

const enums: Record<string, string[]> = {
  planType: ['FREE', 'BASIC', 'STANDARD', 'PREMIUM', 'COUPON'],
  platform: ['WINDOWS', 'MACOS'],
  channel: ['TEST', 'STABLE'],
  signatureStatus: ['UNKNOWN', 'UNSIGNED', 'PENDING', 'VERIFIED', 'FAILED'],
  targetScope: ['ALL', 'ORGS'],
  severity: ['SEV1', 'SEV2', 'SEV3'],
  environment: ['DEV', 'STAGING', 'PROD'],
  outcome: ['WON', 'LOST', 'ON_HOLD'],
}
function fieldsOf(shape: Row): Field[] {
  return Object.entries(shape).map(([key, value]) => {
    const field: Field = { key, label: labels[key] ?? key }
    if (Array.isArray(value)) {
      field.type = 'list'
      if (value[0] && typeof value[0] === 'object') field.fields = fieldsOf(value[0] as Row)
      else field.hint = '여러 값은 쉼표로 구분합니다.'
    } else if (value && typeof value === 'object') field.fields = fieldsOf(value)
    else field.type = value as Field['type']
    if (enums[key]) {
      field.type = 'select'
      field.options = enums[key]
    }
    return field
  })
}
export function action(
  label: string,
  method: string,
  template: string,
  ids: Record<string, string | number> = {},
  options: Partial<Action> & { required?: string[]; choices?: Record<string, string[]> } = {},
): Action {
  const shape = (schemas as Record<string, Json>)[`${method} ${template}`] as Row | undefined
  const fields = options.fields ?? fieldsOf(shape ?? {})
  const configure = (fs: Field[]): Field[] =>
    fs.map((f) => ({
      ...f,
      required: !!(options.required?.includes(f.key) || f.required),
      nullable:
        f.nullable ??
        ((method === 'PATCH' || method === 'PUT') &&
          !options.required?.includes(f.key) &&
          !f.required),
      ...(options.choices?.[f.key]
        ? { type: 'select' as const, options: options.choices[f.key] }
        : {}),
      ...(f.fields ? { fields: configure(f.fields) } : {}),
    }))
  const path = template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    if (ids[key] == null) throw new Error(`Missing route parameter: ${key}`)
    return encodeURIComponent(ids[key])
  })
  return {
    validate: (body) => validateOperation(path, body),
    ...options,
    label,
    method,
    path,
    fields: configure(fields),
  }
}
