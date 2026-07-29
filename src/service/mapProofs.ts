/** Minh chứng map — chỉ lưu local (base64), không gọi API */

export type WeekProofs = Record<string, string> // stepId → dataURL

function storageKey(uid: string, level: number, month: number, week: number) {
  return `whisker_map_proofs_${uid}_${level}_${month}_${week}`
}

export function getWeekProofs(
  uid: string,
  level: number,
  month: number,
  week: number,
): WeekProofs {
  try {
    const raw = localStorage.getItem(storageKey(uid, level, month, week))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as WeekProofs
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveWeekProofs(
  uid: string,
  level: number,
  month: number,
  week: number,
  proofs: WeekProofs,
) {
  localStorage.setItem(
    storageKey(uid, level, month, week),
    JSON.stringify(proofs),
  )
}

export function setStepProof(
  uid: string,
  level: number,
  month: number,
  week: number,
  stepId: string,
  dataUrl: string,
) {
  const next = {
    ...getWeekProofs(uid, level, month, week),
    [stepId]: dataUrl,
  }
  saveWeekProofs(uid, level, month, week, next)
  return next
}

export function removeStepProof(
  uid: string,
  level: number,
  month: number,
  week: number,
  stepId: string,
) {
  const current = getWeekProofs(uid, level, month, week)
  const next = { ...current }
  delete next[stepId]
  saveWeekProofs(uid, level, month, week, next)
  return next
}

export function hasAllStepProofs(stepIds: string[], proofs: WeekProofs) {
  if (stepIds.length === 0) return false
  return stepIds.every((id) => Boolean(proofs[id]))
}

/** Đọc file ảnh → base64 data URL */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Chỉ chấp nhận file ảnh.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'))
    reader.readAsDataURL(file)
  })
}
