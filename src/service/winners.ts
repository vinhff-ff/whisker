import { get, push, ref, set } from 'firebase/database'
import { rtdb } from './firebase'

export type Winner = {
  id: string
  uid: string
  username: string
  rewardId: string
  rewardName: string
  createdAt: number
}

const ROOT = 'winners'

function normalize(id: string, raw: Record<string, unknown>): Winner {
  return {
    id,
    uid: String(raw.uid || ''),
    username: String(raw.username || ''),
    rewardId: String(raw.rewardId || ''),
    rewardName: String(raw.rewardName || ''),
    createdAt: Number(raw.createdAt) || 0,
  }
}

export async function listWinners(): Promise<Winner[]> {
  const snap = await get(ref(rtdb, ROOT))
  if (!snap.exists()) return []
  const val = snap.val() as Record<string, Record<string, unknown>>
  return Object.entries(val)
    .map(([id, item]) => normalize(id, item || {}))
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function addWinner(payload: {
  uid: string
  username: string
  rewardId: string
  rewardName: string
}) {
  const newRef = push(ref(rtdb, ROOT))
  const winner: Winner = {
    id: newRef.key as string,
    ...payload,
    createdAt: Date.now(),
  }
  await set(newRef, {
    uid: winner.uid,
    username: winner.username,
    rewardId: winner.rewardId,
    rewardName: winner.rewardName,
    createdAt: winner.createdAt,
  })
  return winner
}