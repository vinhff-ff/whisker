import { get, push, ref, remove, set, update } from 'firebase/database'
import { rtdb } from './firebase'

export type GuideBlockType =
  | 'task'
  | 'output'
  | 'key'
  | 'step'
  | 'image'
  | 'youtube'

export type GuideBlock = {
  id: string
  type: GuideBlockType
  /** Nội dung text (nhiệm vụ / output / key / bước) hoặc url ảnh/yt cũ */
  value: string
  /** Ảnh demo minh họa cho nhiệm vụ */
  imageValue?: string
  /** Link YouTube demo cho nhiệm vụ */
  youtubeValue?: string
}

export type QuestionType = 'letters' | 'choice' | 'short'

export type GuideQuestion = {
  id: string
  type: QuestionType
  /** Nội dung câu hỏi / gợi ý */
  prompt: string
  /**
   * letters / short: đáp án đúng (chuỗi)
   * choice: có thể để trống, dùng correctIndex
   */
  answer: string
  /** Chỉ dùng cho trắc nghiệm */
  options?: string[]
  /** Index đáp án đúng trong options (0-based) */
  correctIndex?: number
}

export type GuideItem = {
  id: string
  level: number
  month: number
  week: number
  monthDescription: string
  weekDescription: string
  /** Tiêu đề mục Nhiệm vụ */
  tasksTitle: string
  /** Tiêu đề mục Yêu cầu đầu ra */
  outputsTitle: string
  guides: GuideBlock[]
  questions: GuideQuestion[]
  createdAt: number
  updatedAt: number
}

const ROOT = 'guides'

export function createBlockId() {
  return crypto.randomUUID()
}

export function createEmptyBlock(type: GuideBlockType): GuideBlock {
  if (type === 'task') {
    return {
      id: createBlockId(),
      type,
      value: '',
      imageValue: '',
      youtubeValue: '',
    }
  }
  return { id: createBlockId(), type, value: '' }
}

export function createEmptyQuestion(type: QuestionType): GuideQuestion {
  if (type === 'choice') {
    return {
      id: createBlockId(),
      type,
      prompt: '',
      answer: '',
      options: ['', '', '', ''],
      correctIndex: 0,
    }
  }
  return {
    id: createBlockId(),
    type,
    prompt: '',
    answer: '',
  }
}

/** Id cần minh chứng học viên: yêu cầu đầu ra (output); fallback nhiệm vụ/bước cũ */
export function getProofRequiredBlockIds(guides: GuideBlock[] | undefined): string[] {
  const list = guides || []
  const outputs = list.filter((b) => b.type === 'output' && b.id).map((b) => b.id)
  if (outputs.length > 0) return outputs
  return list
    .filter((b) => (b.type === 'task' || b.type === 'step') && b.id)
    .map((b) => b.id)
}

function normalizeBlock(raw: Record<string, unknown>): GuideBlock {
  const type = (raw.type as GuideBlockType) || 'task'
  let imageValue = String(raw.imageValue || '')
  let youtubeValue = String(raw.youtubeValue || '')

  // Tương thích dữ liệu cũ (mediaType + mediaValue)
  const legacyMedia = String(raw.mediaValue || '')
  if (!imageValue && raw.mediaType === 'image' && legacyMedia) {
    imageValue = legacyMedia
  }
  if (!youtubeValue && raw.mediaType === 'youtube' && legacyMedia) {
    youtubeValue = legacyMedia
  }

  return {
    id: String(raw.id || createBlockId()),
    type,
    value: String(raw.value || ''),
    imageValue,
    youtubeValue,
  }
}

function normalizeQuestion(raw: Record<string, unknown>): GuideQuestion {
  const type = (raw.type as QuestionType) || 'short'
  const base: GuideQuestion = {
    id: String(raw.id || createBlockId()),
    type,
    prompt: String(raw.prompt || ''),
    answer: String(raw.answer || ''),
  }
  if (type === 'choice') {
    const options = Array.isArray(raw.options)
      ? (raw.options as unknown[]).map((o) => String(o ?? ''))
      : ['', '', '', '']
    while (options.length < 2) options.push('')
    return {
      ...base,
      options,
      correctIndex: Number.isFinite(Number(raw.correctIndex))
        ? Number(raw.correctIndex)
        : 0,
    }
  }
  return base
}

function normalize(id: string, raw: Record<string, unknown>): GuideItem {
  const questionsRaw = Array.isArray(raw.questions) ? raw.questions : []
  const guidesRaw = Array.isArray(raw.guides) ? raw.guides : []
  return {
    id,
    level: Number(raw.level) || 1,
    month: Number(raw.month) || 1,
    week: Number(raw.week) || 1,
    monthDescription: String(raw.monthDescription || ''),
    weekDescription: String(raw.weekDescription || ''),
    tasksTitle: String(raw.tasksTitle || ''),
    outputsTitle: String(raw.outputsTitle || ''),
    guides: guidesRaw.map((g) =>
      normalizeBlock((g || {}) as Record<string, unknown>),
    ),
    questions: questionsRaw.map((q) =>
      normalizeQuestion((q || {}) as Record<string, unknown>),
    ),
    createdAt: Number(raw.createdAt) || 0,
    updatedAt: Number(raw.updatedAt) || 0,
  }
}

export async function listGuides(): Promise<GuideItem[]> {
  const snap = await get(ref(rtdb, ROOT))
  if (!snap.exists()) return []

  const val = snap.val() as Record<string, Record<string, unknown>>
  return Object.entries(val)
    .map(([id, item]) => normalize(id, item || {}))
    .sort((a, b) => b.createdAt - a.createdAt)
}

export type GuidePayload = {
  level: number
  month: number
  week: number
  monthDescription: string
  weekDescription: string
  tasksTitle: string
  outputsTitle: string
  guides: GuideBlock[]
  questions: GuideQuestion[]
}

export async function createGuide(payload: GuidePayload) {
  const now = Date.now()
  const newRef = push(ref(rtdb, ROOT))
  await set(newRef, {
    ...payload,
    createdAt: now,
    updatedAt: now,
  })
  return newRef.key as string
}

export async function updateGuide(id: string, payload: GuidePayload) {
  await update(ref(rtdb, `${ROOT}/${id}`), {
    ...payload,
    updatedAt: Date.now(),
  })
}

/** Đồng bộ mô tả tháng cho mọi tuần cùng cấp · tháng */
export async function syncMonthDescription(
  level: number,
  month: number,
  monthDescription: string,
  exceptId?: string,
) {
  const all = await listGuides()
  const siblings = all.filter(
    (g) =>
      g.level === level &&
      g.month === month &&
      g.id !== exceptId &&
      g.monthDescription !== monthDescription,
  )
  await Promise.all(
    siblings.map((g) =>
      update(ref(rtdb, `${ROOT}/${g.id}`), {
        monthDescription,
        updatedAt: Date.now(),
      }),
    ),
  )
}

export async function deleteGuide(id: string) {
  await remove(ref(rtdb, `${ROOT}/${id}`))
}

/** Đọc ảnh thành base64 data URL rồi lưu thẳng RTDB */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File phải là ảnh.'))
      return
    }
    if (file.size > 1.5 * 1024 * 1024) {
      reject(new Error('Ảnh quá lớn (tối đa ~1.5MB).'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      if (!result.startsWith('data:image/')) {
        reject(new Error('Không chuyển được ảnh sang base64.'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'))
    reader.readAsDataURL(file)
  })
}
