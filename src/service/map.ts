import { get, ref, set } from 'firebase/database'
import { rtdb } from './firebase'

/** Map test level labels → map level 1–4 */
export function resolveMapLevel(level: string | null | undefined): number {
  if (!level) return 1
  const trimmed = level.trim()
  const asNum = Number(trimmed)
  if (asNum >= 1 && asNum <= 4) return asNum

  const lower = trimmed.toLowerCase()
  if (lower.includes('khá') || lower.includes('kha')) return 3
  if (lower.includes('cơ bản') || lower.includes('co ban') || lower.includes('basic')) return 2
  if (lower.includes('mới') || lower.includes('moi') || lower.includes('begin')) return 1
  if (lower.includes('giỏi') || lower.includes('gioi') || lower.includes('cao')) return 4
  return 1
}

export function getCurrentMonth() {
  return new Date().getMonth() + 1
}

export type MapStepProgress = {
  /** week 1–4 → completed */
  steps: Record<string, boolean>
  /** week 1–4 → đã nhận điểm trò chơi */
  quizRewards?: Record<string, boolean>
  updatedAt: number
}

/**
 * Tuần mở khi:
 * - Admin đã có bài học cho tuần đó
 * - Các tuần trước (có bài) đã hoàn thành
 */
export function isWeekUnlocked(
  week: number,
  done: Record<string, boolean>,
  availableWeeks: Iterable<number>,
): boolean {
  const available = new Set(availableWeeks)
  if (!available.has(week)) return false

  for (let prev = 1; prev < week; prev += 1) {
    if (!available.has(prev)) continue
    if (!done[String(prev)]) return false
  }
  return true
}

function progressPath(uid: string, level: number, month: number) {
  return `users/${uid}/mapProgress/${level}/${month}`
}

export async function getMapProgress(
  uid: string,
  level: number,
  month: number,
): Promise<MapStepProgress> {
  const snap = await get(ref(rtdb, progressPath(uid, level, month)))
  if (!snap.exists()) {
    return { steps: {}, quizRewards: {}, updatedAt: 0 }
  }
  const val = snap.val() as {
    steps?: Record<string, boolean>
    quizRewards?: Record<string, boolean>
    updatedAt?: number
  }
  return {
    steps: val.steps && typeof val.steps === 'object' ? val.steps : {},
    quizRewards:
      val.quizRewards && typeof val.quizRewards === 'object'
        ? val.quizRewards
        : {},
    updatedAt: Number(val.updatedAt) || 0,
  }
}

/** Hoàn thành tuần → mở khóa tuần tiếp theo (trong tháng hiện tại) */
export async function completeMapWeek(
  uid: string,
  level: number,
  month: number,
  week: number,
  availableWeeks: Iterable<number>,
) {
  const current = await getMapProgress(uid, level, month)
  if (!isWeekUnlocked(week, current.steps, availableWeeks)) {
    throw new Error('Tuần này chưa được mở khóa.')
  }
  const steps = { ...current.steps, [String(week)]: true }
  const payload: MapStepProgress = {
    steps,
    quizRewards: current.quizRewards || {},
    updatedAt: Date.now(),
  }
  await set(ref(rtdb, progressPath(uid, level, month)), payload)
  return payload
}

/** Đánh dấu tuần đã nhận +1 điểm trò chơi (một lần) */
export async function claimMapQuizReward(
  uid: string,
  level: number,
  month: number,
  week: number,
) {
  const current = await getMapProgress(uid, level, month)
  if (current.quizRewards?.[String(week)]) {
    return { alreadyClaimed: true as const, progress: current }
  }
  const payload: MapStepProgress = {
    steps: current.steps,
    quizRewards: { ...(current.quizRewards || {}), [String(week)]: true },
    updatedAt: Date.now(),
  }
  await set(ref(rtdb, progressPath(uid, level, month)), payload)
  return { alreadyClaimed: false as const, progress: payload }
}
