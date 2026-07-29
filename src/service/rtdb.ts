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
  /** Điểm thưởng (mặc định 0). +1 khi hoàn thành bài tập tuần */
  score: number
  /** Điểm bài test đầu vào (chỉ để xếp level, không dùng làm score) */
  testScore?: number
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
    score: Number(profile.score) || 0,
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

  let score = Number(val.score) || 0
  let testScore =
    val.testScore === undefined || val.testScore === null
      ? undefined
      : Number(val.testScore)

  // Migrate: chỉ khi chưa có testScore và chưa làm bài tuần nào trên map
  if (val.hasCompletedTest && testScore === undefined && score > 0) {
    const mapSnap = await get(ref(rtdb, `users/${uid}/mapProgress`))
    if (!mapSnap.exists()) {
      testScore = score
      score = 0
      await updateRtdbUserProfile(uid, { testScore, score: 0 })
    }
  }

  return {
    ...val,
    hasCompletedTest: Boolean(val.hasCompletedTest),
    level: val.level ?? null,
    score,
    testScore,
  }
}

export async function savePlacementTestResult(
  uid: string,
  result: { score: number; level: string },
) {
  await updateRtdbUserProfile(uid, {
    hasCompletedTest: true,
    level: result.level,
    testScore: result.score,
    // Sau bài test: điểm thưởng = 0; +1 khi hoàn thành bài tập tuần
    score: 0,
  })
}

/** Cộng điểm vào users/{uid}.score (mặc định +1 khi xong bài tuần) */
export async function addUserScore(uid: string, amount = 1) {
  const current = await getRtdbUserProfile(uid)
  const nextScore = (Number(current?.score) || 0) + amount
  await updateRtdbUserProfile(uid, { score: Math.max(0, nextScore) })
  return Math.max(0, nextScore)
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
    score: Number(item.score) || 0,
  }))
}
