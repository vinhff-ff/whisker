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

/** Chuẩn hóa danh sách tuần có bài (số nguyên ≥ 1, sort tăng dần). */
export function normalizeAvailableWeeks(availableWeeks: Iterable<number>): number[] {
  return [...new Set([...availableWeeks].map(Number))]
    .filter((w) => Number.isFinite(w) && w >= 1)
    .sort((a, b) => a - b)
}

/** Firebase đôi khi trả steps dạng array — chỉ giữ key tuần "1"…"4" = true. */
export function normalizeDoneSteps(
  raw: Record<string, boolean> | boolean[] | null | undefined,
): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(raw)) {
    const week = Number(key)
    if (!Number.isFinite(week) || week < 1 || week > 4) continue
    if (value) out[String(week)] = true
  }
  return out
}

/**
 * Chỉ giữ chuỗi hoàn thành liên tiếp từ tuần có bài đầu tiên.
 * Tránh tick “nhảy cóc” làm mở khóa mọi tuần sau.
 */
export function sanitizeSequentialDone(
  done: Record<string, boolean>,
  availableWeeks: Iterable<number>,
): Record<string, boolean> {
  const available = normalizeAvailableWeeks(availableWeeks)
  const cleaned: Record<string, boolean> = {}
  for (const week of available) {
    if (!done[String(week)]) break
    if (!isWeekUnlocked(week, cleaned, available)) break
    cleaned[String(week)] = true
  }
  return cleaned
}

/**
 * Tuần mở khi:
 * - Admin đã có bài học cho tuần đó
 * - Mọi tuần có bài đứng trước đã hoàn thành (theo thứ tự tuần)
 */
export function isWeekUnlocked(
  week: number,
  done: Record<string, boolean>,
  availableWeeks: Iterable<number>,
): boolean {
  const available = normalizeAvailableWeeks(availableWeeks)
  if (!available.includes(week)) return false

  const index = available.indexOf(week)
  for (let i = 0; i < index; i += 1) {
    if (!done[String(available[i])]) return false
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
    steps: normalizeDoneSteps(
      val.steps && typeof val.steps === 'object'
        ? (val.steps as Record<string, boolean>)
        : {},
    ),
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
  const available = normalizeAvailableWeeks(availableWeeks)
  const current = await getMapProgress(uid, level, month)
  const stepsSoFar = sanitizeSequentialDone(current.steps, available)
  if (!isWeekUnlocked(week, stepsSoFar, available)) {
    throw new Error('Tuần này chưa được mở khóa.')
  }
  const steps = sanitizeSequentialDone(
    { ...stepsSoFar, [String(week)]: true },
    available,
  )
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
