const seenKey = (uid: string) => `whisker_chatbot_guide_seen_${uid}`

export function hasSeenChatbotGuide(uid: string): boolean {
  try {
    return localStorage.getItem(seenKey(uid)) === '1'
  } catch {
    return false
  }
}

export function markChatbotGuideSeen(uid: string) {
  try {
    localStorage.setItem(seenKey(uid), '1')
  } catch {
    // ignore
  }
}
