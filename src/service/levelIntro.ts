const key = (uid: string) => `whisker_level_intro_pending_${uid}`

/** Đánh dấu user vừa nhận level, chưa đóng màn giới thiệu */
export function markLevelIntroPending(uid: string, level: string) {
  localStorage.setItem(key(uid), JSON.stringify({ level, pending: true }))
}

export function getLevelIntroPending(
  uid: string,
): { level: string } | null {
  try {
    const raw = localStorage.getItem(key(uid))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { level?: string; pending?: boolean }
    if (!parsed?.pending || !parsed.level) return null
    return { level: parsed.level }
  } catch {
    return null
  }
}

export function clearLevelIntroPending(uid: string) {
  localStorage.removeItem(key(uid))
}

export function hasLevelIntroPending(uid: string) {
  return Boolean(getLevelIntroPending(uid))
}
