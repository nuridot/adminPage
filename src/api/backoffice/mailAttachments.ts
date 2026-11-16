export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENTS_BYTES = 17 * 1024 * 1024
export const MAX_ATTACHMENTS = 10
const blockedExtensions = new Set(
  'ade adp apk appx appxbundle bat cab chm cmd com cpl diagcab diagcfg diagpack dll dmg ex ex_ exe hta img ins iso isp jar jnlp js jse lib lnk mde mjs msc msi msix msixbundle msp mst nsh pif ps1 scr sct shb sys vb vbe vbs vhd vxd wsc wsf wsh xll'.split(
    ' ',
  ),
)

export function validateMailAttachment(
  file: Pick<File, 'name' | 'size'>,
  existing: { sizeBytes: number }[],
) {
  const name = (file.name.split(/[\\/]/).pop() ?? '')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/[.\s]+$/u, '')
  if (!name || file.size === 0) return '이름이 있는 빈 파일이 아닌 파일을 선택해 주세요.'
  if (Array.from(name).length > 255) return '파일 이름은 255자 이하여야 합니다.'
  if (blockedExtensions.has(name.split('.').pop()!.toLowerCase()))
    return '실행 파일 등 이 형식은 메일에 첨부할 수 없습니다.'
  if (file.size > MAX_ATTACHMENT_BYTES) return '파일 하나는 10MB까지 첨부할 수 있습니다.'
  if (existing.length >= MAX_ATTACHMENTS) return '첨부는 최대 10개까지 가능합니다.'
  if (existing.reduce((sum, item) => sum + item.sizeBytes, 0) + file.size > MAX_ATTACHMENTS_BYTES)
    return '첨부파일의 합계는 17MB까지 가능합니다.'
  return null
}
