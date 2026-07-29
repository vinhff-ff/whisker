import testData from '../data/test.json'

export type AnswerKey = 'A' | 'B' | 'C'

export type TestQuestion = {
  id: number
  skill: string
  question: string
  options: { key: AnswerKey; text: string }[]
}

export type TestData = {
  title: string
  description: string
  scoring: {
    A: number
    B: number
    C: number
    max_score: number
    levels: { range: [number, number]; label: string }[]
  }
  questions: TestQuestion[]
}

export const placementTest = testData as TestData

export function scoreAnswers(answers: Record<number, AnswerKey>) {
  const { scoring, questions } = placementTest
  let score = 0

  for (const q of questions) {
    const key = answers[q.id]
    if (!key) continue
    score += scoring[key] ?? 0
  }

  const level =
    scoring.levels.find(
      (lv) => score >= lv.range[0] && score <= lv.range[1],
    )?.label || scoring.levels[0]?.label || 'Mới bắt đầu'

  return { score, level, maxScore: scoring.max_score }
}
