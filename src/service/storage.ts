const USER_KEY = 'whisker_user'

export type StoredUser = {
  uid: string
  username: string
  displayName: string
  email: string
  /** Password chỉ nằm trên Firebase Auth, không lưu local */
  hasCompletedTest: boolean
  level: string | null
  score?: number
}

export function saveUserToStorage(user: StoredUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getUserFromStorage(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredUser
    return {
      ...parsed,
      hasCompletedTest: Boolean(parsed.hasCompletedTest),
      level: parsed.level ?? null,
    }
  } catch {
    return null
  }
}

export function clearUserStorage() {
  localStorage.removeItem(USER_KEY)
}
