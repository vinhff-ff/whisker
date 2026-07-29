import { get, ref, set, update } from 'firebase/database'
import { rtdb } from './firebase'
import type { StoredUser } from './storage'

export type UserProfile = {
  uid: string
  username: string
  email: string
  displayName: string
  /** Không lưu password — Firebase Auth quản lý */
  hasCompletedTest: boolean
  level: string | null
  score?: number
  createdAt: number
  updatedAt?: number
  lastLoginAt?: number
}

export function toStoredUser(profile: UserProfile): StoredUser {
  return {
    uid: profile.uid,
    username: profile.username,
    displayName: profile.displayName,
    email: profile.email,
    hasCompletedTest: Boolean(profile.hasCompletedTest),
    level: profile.level ?? null,
    score: profile.score,
  }
}

export async function saveRtdbUserProfile(profile: UserProfile) {
  await set(ref(rtdb, `users/${profile.uid}`), profile)
  await set(ref(rtdb, `usernames/${profile.username.toLowerCase()}`), profile.uid)
}

export async function updateRtdbUserProfile(
  uid: string,
  data: Partial<UserProfile>,
) {
  await update(ref(rtdb, `users/${uid}`), {
    ...data,
    updatedAt: Date.now(),
  })
}

export async function getRtdbUserProfile(uid: string) {
  const snap = await get(ref(rtdb, `users/${uid}`))
  if (!snap.exists()) return null
  const val = snap.val() as UserProfile
  return {
    ...val,
    hasCompletedTest: Boolean(val.hasCompletedTest),
    level: val.level ?? null,
  }
}

export async function savePlacementTestResult(
  uid: string,
  result: { score: number; level: string },
) {
  await updateRtdbUserProfile(uid, {
    hasCompletedTest: true,
    level: result.level,
    score: result.score,
  })
}

/** Cộng điểm vào users/{uid}.score (mặc định +1) */
export async function addUserScore(uid: string, amount = 1) {
  const current = await getRtdbUserProfile(uid)
  const nextScore = (current?.score || 0) + amount
  await updateRtdbUserProfile(uid, { score: nextScore })
  return nextScore
}

export async function isUsernameTaken(username: string) {
  const key = username.trim().toLowerCase()
  if (!key) return false
  const snap = await get(ref(rtdb, `usernames/${key}`))
  return snap.exists()
}

export async function getUidByUsername(username: string) {
  const key = username.trim().toLowerCase()
  const snap = await get(ref(rtdb, `usernames/${key}`))
  if (!snap.exists()) return null
  return snap.val() as string
}

export async function listRtdbUsers(): Promise<UserProfile[]> {
  const snap = await get(ref(rtdb, 'users'))
  if (!snap.exists()) return []
  const val = snap.val() as Record<string, UserProfile>
  return Object.values(val).map((item) => ({
    ...item,
    hasCompletedTest: Boolean(item.hasCompletedTest),
    level: item.level ?? null,
  }))
}
