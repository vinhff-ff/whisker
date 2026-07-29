import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Bg from '../../assets/bg.png'
import Papper from '../../assets/papper.png'
import Button from '../../ui/button'
import {
  placementTest,
  savePlacementTestResult,
  saveUserToStorage,
  scoreAnswers,
  toStoredUser,
  useAuth,
  type AnswerKey,
  getRtdbUserProfile,
} from '../../service'

const TestPage = () => {
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()
  const questions = placementTest.questions
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, AnswerKey>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ score: number; level: string } | null>(null)

  const current = questions[index]

  function selectAnswer(key: AnswerKey) {
    if (!current) return
    setAnswers((prev) => ({ ...prev, [current.id]: key }))
  }

  function goNext() {
    if (!current || !answers[current.id]) {
      setError('Hãy chọn một đáp án trước.')
      return
    }
    setError('')
    if (index < questions.length - 1) {
      setIndex((v) => v + 1)
      return
    }
    void finish()
  }

  function goPrev() {
    setError('')
    setIndex((v) => Math.max(0, v - 1))
  }

  async function finish() {
    if (!user) return
    const unanswered = questions.some((q) => !answers[q.id])
    if (unanswered) {
      setError('Em cần trả lời hết tất cả câu hỏi.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const result = scoreAnswers(answers)
      await savePlacementTestResult(user.uid, result)
      const profile = await getRtdbUserProfile(user.uid)
      if (profile) {
        saveUserToStorage(toStoredUser(profile))
        await refreshProfile()
      }
      setDone(result)
    } catch {
      setError('Không lưu được kết quả. Thử lại nhé.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="test-page">
        <div className="test-page__bg" style={{ backgroundImage: `url(${Bg})` }} />
        <div className="test-page__veil" />
        <div
          className="test-page__panel"
          style={{ backgroundImage: `url(${Papper})` }}
        >
          <div className="test-page__panel-inner test-page__panel-inner--result">
            <p className="test-page__eyebrow">Hoàn thành</p>
            <h1 className="test-page__title">Kết quả bài test</h1>
            <p className="test-page__subtitle">
              Điểm bài test:{' '}
              <strong>
                {done.score}/{placementTest.scoring.max_score}
              </strong>{' '}
              (chỉ để xếp level)
            </p>
            <p className="test-page__level">Level: {done.level}</p>
            <p className="test-page__subtitle">
              Điểm thưởng bắt đầu từ <strong>0</strong>. Làm xong bài tập tuần
              sẽ +1 điểm.
            </p>
            <Button
              className="btn-wood test-page__submit"
              onClick={() => navigate('/', { replace: true })}
            >
              Vào khám phá
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="test-page">
      <div className="test-page__bg" style={{ backgroundImage: `url(${Bg})` }} />
      <div className="test-page__veil" />

      <div
        className="test-page__panel"
        style={{ backgroundImage: `url(${Papper})` }}
      >
        <div className="test-page__panel-inner">
          <h1 className="test-page__title">{placementTest.title}</h1>
          <p className="test-page__subtitle">{placementTest.description}</p>

          <div className="test-page__progress">
            <div
              className="test-page__progress-bar"
              style={{ width: `${Math.round(((index + 1) / questions.length) * 100)}%` }}
            />
          </div>
          <p className="test-page__meta">
            Câu {index + 1}/{questions.length}
          </p>

          <h2 className="test-page__question">{current.question}</h2>

          <div className="test-page__options">
            {current.options.map((opt) => {
              const active = answers[current.id] === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  className={`test-page__option${active ? ' is-active' : ''}`}
                  onClick={() => selectAnswer(opt.key)}
                >
                  <span className="test-page__option-key">{opt.key}</span>
                  <span>{opt.text}</span>
                </button>
              )
            })}
          </div>

          {error && <div className="test-page__error">{error}</div>}

          <div className="test-page__actions">
            <Button
              className="btn-wood test-page__nav"
              onClick={goPrev}
              disabled={index === 0 || submitting}
            >
              Quay lại
            </Button>
            <Button
              className="btn-wood test-page__nav"
              onClick={goNext}
              disabled={submitting}
            >
              {index === questions.length - 1
                ? submitting
                  ? 'Đang lưu...'
                  : 'Nộp bài'
                : 'Tiếp theo'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TestPage
