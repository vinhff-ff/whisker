import { get, push, ref, remove, set, update } from 'firebase/database'
import { rtdb } from './firebase'

export type RewardItem = {
  id: string
  name: string
  /** base64 data URL */
  image: string
  createdAt: number
  updatedAt: number
}

const ROOT = 'rewards'

function normalize(id: string, raw: Record<string, unknown>): RewardItem {
  return {
    id,
    name: String(raw.name || '').trim(),
    image: String(raw.image || ''),
    createdAt: Number(raw.createdAt) || 0,
    updatedAt: Number(raw.updatedAt) || 0,
  }
}

export async function listRewards(): Promise<RewardItem[]> {
  const snap = await get(ref(rtdb, ROOT))
  if (!snap.exists()) return []
  const val = snap.val() as Record<string, Record<string, unknown>>
  return Object.entries(val)
    .map(([id, item]) => normalize(id, item || {}))
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function createReward(payload: { name: string; image: string }) {
  const now = Date.now()
  const newRef = push(ref(rtdb, ROOT))
  await set(newRef, {
    name: payload.name.trim(),
    image: payload.image,
    createdAt: now,
    updatedAt: now,
  })
  return newRef.key as string
}

export async function updateReward(
  id: string,
  payload: { name: string; image: string },
) {
  await update(ref(rtdb, `${ROOT}/${id}`), {
    name: payload.name.trim(),
    image: payload.image,
    updatedAt: Date.now(),
  })
}

export async function deleteReward(id: string) {
  await remove(ref(rtdb, `${ROOT}/${id}`))
}
