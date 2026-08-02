import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Bg from '../../assets/bg.png'
import Papper from '../../assets/papper.png'
import BgLogin from '../../assets/bglogin.mp4'
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
import { resolveMapLevel } from '../../service/map'
import {
  clearLevelIntroPending,
  getLevelIntroPending,
  markLevelIntroPending,
} from '../../service/levelIntro'

const LEVEL_INTROS: Record<
  number,
  { title: string; body: string }
> = {
  1: {
    title: 'LEVEL 1 – ĐẢO HOANG',
    body: 'Người chơi tỉnh dậy trên bãi biển, thấy Whisker đang ôm chặt La Bàn Cổ đang phát sáng yếu ớt bên cạnh. Không có nước sạch, không có nơi trú ẩn an toàn, không có lương thực để chờ ngày được cứu.',
  },
  2: {
    title: 'LEVEL 2 – EO BIỂN BÃO',
    body: 'La Bàn Cổ quay loạn xạ – vùng biển này đầy đá ngầm nhiễm từ khiến la bàn thường vô dụng. Đây cũng là nơi thuyền trưởng Haha từng đắm tàu năm xưa.',
  },
  3: {
    title: 'LEVEL 3 – QUẦN ĐẢO CỔ XƯA',
    body: 'Tới quần đảo, mọi thứ được vận hành bởi cỗ máy cổ "Lõi Năng Lượng Cổ Đại" – một hệ thống tự động hóa bằng đá cổ, phản hồi theo logic chứ không theo phép thuật. Muốn tiến vào trung tâm, người chơi phải "nói chuyện" với nó bằng ngôn ngữ lập trình kéo thả, lồng trong việc phục hồi 3 hệ thống của người xưa.',
  },
}

type Phase = 'quiz' | 'video' | 'intro'

type DoneResult = { score: number; level: string }

const TestPage = () => {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const questions = placementTest.questions
  const videoRef = useRef<HTMLVideoElement>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, AnswerKey>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<Phase>('quiz')
  const [done, setDone] = useState<DoneResult | null>(null)
  const [muted, setMuted] = useState(true)

  // Quay lại /test khi chưa đóng intro (sau refresh) — không ghi đè phase video
  useEffect(() => {
    if (!user) return
    const pending = getLevelIntroPending(user.uid)
    if (!pending) return

    setDone({
      score: profile?.testScore ?? 0,
      level: pending.level || profile?.level || 'Mới bắt đầu',
    })
    setPhase((prev) => {
      // Đang xem video / intro thì giữ nguyên; chỉ khôi phục khi mới vào trang
      if (prev === 'video' || prev === 'intro') return prev
      return 'intro'
    })
  }, [user, profile?.level, profile?.testScore])

  useEffect(() => {
    if (phase !== 'video') return
    const el = videoRef.current
    if (!el) return
    el.muted = muted
    void el.play().catch(() => undefined)
  }, [phase, muted])

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
      // Đặt phase video trước khi refresh profile — tránh effect pending nhảy thẳng sang intro
      setDone(result)
      setMuted(true)
      setPhase('video')
      markLevelIntroPending(user.uid, result.level)

      await savePlacementTestResult(user.uid, result)
      const remote = await getRtdbUserProfile(user.uid)
      if (remote) {
        saveUserToStorage(toStoredUser(remote))
        await refreshProfile()
      }
    } catch {
      setError('Không lưu được kết quả. Thử lại nhé.')
      if (user) clearLevelIntroPending(user.uid)
      setPhase('quiz')
      setDone(null)
    } finally {
      setSubmitting(false)
    }
  }

  function closeVideo() {
    const el = videoRef.current
    if (el) {
      el.pause()
      el.muted = true
    }
    setMuted(true)
    setPhase('intro')
  }

  function toggleMute() {
    const el = videoRef.current
    if (!el) return
    const next = !muted
    el.muted = next
    setMuted(next)
    if (!next) void el.play().catch(() => undefined)
  }

  function closeIntro() {
    if (!user) return
    clearLevelIntroPending(user.uid)
    navigate('/', { replace: true })
  }

  const shell = (inner: ReactNode) => (
    <div className="test-page">
      <div className="test-page__bg" style={{ backgroundImage: `url(${Bg})` }} />
      <div className="test-page__veil" />
      <div
        className="test-page__panel"
        style={{ backgroundImage: `url(${Papper})` }}
      >
        {inner}
      </div>
    </div>
  )

  if (phase === 'video' && done) {
    return (
      <div className="test-page test-page--video">
        <video
          ref={videoRef}
          className="test-page__video"
          autoPlay
          loop
          playsInline
          muted={muted}
          preload="auto"
        >
          <source src={BgLogin} type="video/mp4" />
        </video>

        <Button
          className="btn-wood btn-wood--compact test-page__video-close"
          onClick={closeVideo}
          aria-label="Đóng video"
        >
          Bỏ qua
        </Button>

        <button
          type="button"
          className="test-page__video-mute"
          onClick={toggleMute}
          title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
        >
          {muted ? 'Bật âm' : 'Tắt âm'}
        </button>
      </div>
    )
  }

  if (phase === 'intro' && done) {
    const mapLevel = resolveMapLevel(done.level)
    const intro = LEVEL_INTROS[mapLevel] || LEVEL_INTROS[1]

    return shell(
      <div className="test-page__panel-inner test-page__panel-inner--result">
        <h1 className="test-page__title">{intro.title}</h1>
        <p className="test-page__intro">{intro.body}</p>
        <Button
          className="btn-wood btn-wood--compact test-page__close"
          onClick={closeIntro}
        >
          Đóng
        </Button>
      </div>,
    )
  }

  return shell(
    <div className="test-page__panel-inner">
      <h1 className="test-page__title">{placementTest.title}</h1>
      <p className="test-page__subtitle">{placementTest.description}</p>

      <div className="test-page__progress">
        <div
          className="test-page__progress-bar"
          style={{
            width: `${Math.round(((index + 1) / questions.length) * 100)}%`,
          }}
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
    </div>,
  )
}

export default TestPage
