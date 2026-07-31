function monthIntroKey(uid: string, level: number, month: number) {
  return `whisker_map_month_intro_${uid}_${level}_${month}`
}

export function hasSeenMonthIntro(
  uid: string,
  level: number,
  month: number,
): boolean {
  try {
    return localStorage.getItem(monthIntroKey(uid, level, month)) === '1'
  } catch {
    return false
  }
}

export function markMonthIntroSeen(
  uid: string,
  level: number,
  month: number,
) {
  try {
    localStorage.setItem(monthIntroKey(uid, level, month), '1')
  } catch {
    // ignore quota / private mode
  }
}
