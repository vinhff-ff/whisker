import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Drawer, message } from 'antd'
import PaperBg from '../../assets/papperbg.png'
import StartIcon from '../../assets/start.png'
import Thu2Icon from '../../assets/thu2.png'
import IslandIcon from '../../assets/island.png'
import KhoBauIcon from '../../assets/khobau.png'
import Button from '../../ui/button'
import {
  listGuides,
  type GuideBlock,
  type GuideItem,
  type GuideQuestion,
} from '../../service/guides'
import {
  claimMapQuizReward,
  completeMapWeek,
  getCurrentMonth,
  getMapProgress,
  isWeekUnlocked,
  resolveMapLevel,
} from '../../service/map'
import {
  addUserScore,
  getRtdbUserProfile,
  toStoredUser,
} from '../../service/rtdb'
import { saveUserToStorage } from '../../service/storage'
import { useAuth } from '../../service/AuthGate'

const WEEKS = [
  { week: 1, label: 'Tuần 1', icon: StartIcon, x: 26, y: 27, mx: 25, my: 74, tilt: -7 },
  { week: 2, label: 'Tuần 2', icon: Thu2Icon, x: 74, y: 38, mx: 42, my: 26, tilt: 5 },
  { week: 3, label: 'Tuần 3', icon: IslandIcon, x: 26, y: 58, mx: 62, my: 74, tilt: -4 },
  { week: 4, label: 'Tuần 4', icon: KhoBauIcon, x: 74, y: 78, mx: 80, my: 26, tilt: 8 },
] as const

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isAnswerCorrect(q: GuideQuestion, raw: string | undefined) {
  if (raw == null || raw === '') return false
  if (q.type === 'choice') {
    return String(q.correctIndex ?? '') === String(raw)
  }
  return normalizeText(raw) === normalizeText(q.answer || '')
}

/** Soft dashed rope — desktop zigzag 1/3 trái, 2/4 phải */
const ROPE_PATH =
  'M 26 20 C 42 18, 58 28, 74 38 S 58 48, 26 58 S 42 68, 74 78'

/** Rope mobile: trên→dưới 1-2-3-4, trái/phải 1-3 / 2-4 */
const ROPE_PATH_MOBILE =
  'M 22 74 C 28 50, 36 36, 42 26 S 52 50, 62 74 S 72 50, 80 26'

function youtubeEmbedUrl(url: string) {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '')
      return id ? `https://www.youtube.com/embed/${id}` : ''
    }
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v')
      if (id) return `https://www.youtube.com/embed/${id}`
    }
  } catch {
    return ''
  }
  return ''
}

const MapPage = () => {
  const navigate = useNavigate()
  const { user, profile, ready, refreshProfile } = useAuth()
  const level = resolveMapLevel(profile?.level)
  const currentMonth = getCurrentMonth()
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [quizRewards, setQuizRewards] = useState<Record<string, boolean>>({})
  const [guides, setGuides] = useState<GuideItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savingWeek, setSavingWeek] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)
  const [gameWeek, setGameWeek] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submittingQuiz, setSubmittingQuiz] = useState(false)
  const [totalScore, setTotalScore] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!ready || !user) return
    let alive = true

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [progress, allGuides] = await Promise.all([
          getMapProgress(user.uid, level, currentMonth),
          listGuides(),
        ])
        if (!alive) return
        setDone(progress.steps || {})
        setQuizRewards(progress.quizRewards || {})
        setGuides(
          allGuides.filter(
            (g) => g.level === level && g.month === currentMonth,
          ),
        )
        setTotalScore(profile?.score || 0)
      } catch (err) {
        if (!alive) return
        setError(err instanceof Error ? err.message : 'Không tải được bản đồ.')
      } finally {
        if (alive) setLoading(false)
      }
    }

    void load()
    return () => {
      alive = false
    }
  }, [ready, user, level, currentMonth, profile?.score])

  const lessonByWeek = useMemo(() => {
    const map: Record<number, GuideItem | undefined> = {}
    for (const g of guides) {
      map[g.week] = g
    }
    return map
  }, [guides])

  const availableWeeks = useMemo(
    () =>
      Object.keys(lessonByWeek)
        .map(Number)
        .filter((w) => Boolean(lessonByWeek[w])),
    [lessonByWeek],
  )

  const activeLesson =
    selectedWeek !== null ? lessonByWeek[selectedWeek] || null : null

  const gameLesson = gameWeek !== null ? lessonByWeek[gameWeek] || null : null
  const gameQuestions = gameLesson?.questions || []
  const gameAlreadyRewarded =
    gameWeek !== null ? Boolean(quizRewards[String(gameWeek)]) : false

  const openGame = (week: number) => {
    if (!done[String(week)]) return
    setAnswers({})
    setGameWeek(week)
  }

  const closeGame = () => {
    setGameWeek(null)
    setAnswers({})
  }

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const submitQuiz = async () => {
    if (!user || gameWeek === null || !gameLesson || submittingQuiz) return
    if (gameQuestions.length === 0) {
      message.warning('Tuần này chưa có câu hỏi.')
      return
    }

    const unanswered = gameQuestions.some(
      (q) => answers[q.id] == null || answers[q.id] === '',
    )
    if (unanswered) {
      message.warning('Hãy trả lời hết các câu hỏi trước khi nộp bài.')
      return
    }

    const allCorrect = gameQuestions.every((q) =>
      isAnswerCorrect(q, answers[q.id]),
    )
    if (!allCorrect) {
      message.error('Chưa đúng hết. Hãy kiểm tra lại đáp án.')
      return
    }

    if (quizRewards[String(gameWeek)]) {
      message.info('Bạn đã nhận điểm cho tuần này rồi.')
      return
    }

    setSubmittingQuiz(true)
    try {
      const claim = await claimMapQuizReward(
        user.uid,
        level,
        currentMonth,
        gameWeek,
      )
      setQuizRewards(claim.progress.quizRewards || {})
      if (claim.alreadyClaimed) {
        message.info('Bạn đã nhận điểm cho tuần này rồi.')
        return
      }
      const nextScore = await addUserScore(user.uid, 1)
      const remote = await getRtdbUserProfile(user.uid)
      if (remote) {
        saveUserToStorage(toStoredUser(remote))
        await refreshProfile()
      }
      setTotalScore(nextScore)
      message.success('Chính xác! +1 điểm.')
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : 'Không nộp được bài. Thử lại.',
      )
    } finally {
      setSubmittingQuiz(false)
    }
  }

  const renderQuestion = (q: GuideQuestion, index: number) => (
    <article key={q.id} className="map-quiz__item">
      <p className="map-quiz__prompt">
        <span className="map-quiz__num">{index + 1}.</span> {q.prompt || '—'}
      </p>

      {q.type === 'choice' ? (
        <div className="map-quiz__choices">
          {(q.options || []).map((opt, oi) => (
            <label key={`${q.id}-${oi}`} className="map-quiz__choice">
              <input
                type="radio"
                name={`q-${q.id}`}
                checked={answers[q.id] === String(oi)}
                onChange={() => setAnswer(q.id, String(oi))}
                disabled={submittingQuiz || gameAlreadyRewarded}
              />
              <span>{opt || `Lựa chọn ${oi + 1}`}</span>
            </label>
          ))}
        </div>
      ) : (
        <input
          className="map-quiz__input"
          type="text"
          placeholder={
            q.type === 'letters' ? 'Nhập chữ cái / từ...' : 'Nhập đáp án ngắn...'
          }
          value={answers[q.id] || ''}
          onChange={(e) => setAnswer(q.id, e.target.value)}
          disabled={submittingQuiz || gameAlreadyRewarded}
        />
      )}
    </article>
  )

  const markComplete = async (week: number, e: MouseEvent) => {
    e.stopPropagation()
    if (!user || savingWeek !== null) return
    if (!isWeekUnlocked(week, done, availableWeeks)) return
    if (done[String(week)]) return

    setSavingWeek(week)
    setError('')
    setDone((prev) => ({ ...prev, [String(week)]: true }))
    try {
      await completeMapWeek(user.uid, level, currentMonth, week, availableWeeks)
    } catch (err) {
      setDone((prev) => {
        const next = { ...prev }
        delete next[String(week)]
        return next
      })
      setError(err instanceof Error ? err.message : 'Không lưu được tiến độ.')
    } finally {
      setSavingWeek(null)
    }
  }

  const onWeekClick = (week: number) => {
    if (!isWeekUnlocked(week, done, availableWeeks)) return
    setSelectedWeek(week)
  }

  const completedCount = availableWeeks.filter((w) => done[String(w)]).length

  const renderGuideBlock = (block: GuideBlock, index: number) => {
    if (block.type === 'step') {
      return (
        <div key={block.id} className="map-lesson__block">
          <strong>Bước {index + 1}</strong>
          <p>{block.value || '—'}</p>
        </div>
      )
    }
    if (block.type === 'image') {
      return block.value ? (
        <div key={block.id} className="map-lesson__block">
          <strong>Ảnh {index + 1}</strong>
          <img src={block.value} alt={`Hướng dẫn ${index + 1}`} />
        </div>
      ) : null
    }
    const embed = youtubeEmbedUrl(block.value)
    return (
      <div key={block.id} className="map-lesson__block">
        <strong>Video {index + 1}</strong>
        {embed ? (
          <div className="map-lesson__video">
            <iframe
              src={embed}
              title={`YouTube ${index + 1}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <a href={block.value} target="_blank" rel="noreferrer">
            {block.value || '—'}
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="map-page">
      <Button
        className="btn-wood btn-wood--login map-page__back"
        onClick={() => navigate('/')}
      >
        Quay lại
      </Button>

      <div className="map-page__layout">
        <div className="map-page__sheet">
          <div className="map-page__plane">
            <img
              className="map-page__paper"
              src={PaperBg}
              alt=""
              draggable={false}
            />

            <div className="map-page__board">
              <svg
                className="map-page__rope"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d={isMobile ? ROPE_PATH_MOBILE : ROPE_PATH}
                  fill="none"
                  stroke="rgba(92, 58, 26, 0.55)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="2.2 2.8"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={isMobile ? ROPE_PATH_MOBILE : ROPE_PATH}
                  fill="none"
                  stroke="rgba(196, 138, 72, 0.35)"
                  strokeWidth="0.5"
                  strokeLinecap="round"
                  strokeDasharray="1.4 3.2"
                  strokeDashoffset="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {WEEKS.map((node) => {
                const hasLesson = Boolean(lessonByWeek[node.week])
                const unlocked = isWeekUnlocked(node.week, done, availableWeeks)
                const isDone = Boolean(done[String(node.week)])
                const busy = savingWeek === node.week
                const active = selectedWeek === node.week
                const locked = !unlocked
                const left = isMobile ? node.mx : node.x
                const top = isMobile ? node.my : node.y

                return (
                  <div
                    key={node.week}
                    className={[
                      'map-stage',
                      unlocked ? 'is-unlocked' : 'is-locked',
                      isDone ? 'is-done' : '',
                      active ? 'is-active' : '',
                      busy ? 'is-busy' : '',
                      !hasLesson ? 'is-empty-lesson' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      ['--tilt' as string]: `${node.tilt}deg`,
                    }}
                  >
                    <span className="map-stage__hover">
                      {hasLesson ? node.label : `${node.label} · Chưa có bài`}
                    </span>

                    {unlocked ? (
                      <button
                        type="button"
                        className={`map-stage__status${isDone ? ' is-tick' : ' is-go'}`}
                        onClick={(e) => {
                          if (!isDone) void markComplete(node.week, e)
                        }}
                        disabled={busy || isDone}
                        title={isDone ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}
                        aria-label={isDone ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}
                      >
                        {isDone ? '✓' : null}
                      </button>
                    ) : (
                      <span
                        className="map-stage__status is-lock"
                        aria-label={
                          hasLesson ? 'Chưa mở khóa' : 'Admin chưa thêm bài học'
                        }
                        title={
                          hasLesson
                            ? 'Hoàn thành tuần trước để mở'
                            : 'Admin chưa thêm bài học tuần này'
                        }
                      >
                        🔒
                      </span>
                    )}

                    <button
                      type="button"
                      className="map-stage__hit"
                      onClick={() => onWeekClick(node.week)}
                      disabled={locked}
                      aria-label={node.label}
                    >
                      <img
                        className="map-stage__icon"
                        src={node.icon}
                        alt=""
                        draggable={false}
                      />
                    </button>
                  </div>
                )
              })}

              {loading ? (
                <div className="map-page__loading">Đang mở bản đồ...</div>
              ) : null}
            </div>
          </div>

          {error ? <p className="map-page__error">{error}</p> : null}

          {selectedWeek !== null ? (
            <aside
              className="map-panel"
              role="dialog"
              aria-label={`Tuần ${selectedWeek}`}
            >
              <div className="map-panel__head">
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    Tuần {activeLesson?.week ?? selectedWeek}
                  </span>
                </div>
                <button
                  type="button"
                  className="map-panel__close"
                  onClick={() => setSelectedWeek(null)}
                >
                  Đóng
                </button>
              </div>

              {!activeLesson ? (
                <div className="map-panel__empty">
                  Tháng {currentMonth} chưa có bài học cho tuần {selectedWeek} (cấp {level}).
                </div>
              ) : (
                <div className="map-lesson">
                  {(activeLesson.guides || []).length === 0 ? (
                    <div className="map-panel__empty">Chưa có hướng dẫn.</div>
                  ) : (
                    <div className="map-lesson__guides">
                      {activeLesson.guides.map((block, index) =>
                        renderGuideBlock(block, index),
                      )}
                    </div>
                  )}
                </div>
              )}
            </aside>
          ) : null}
        </div>

        <aside className="map-page__side-menu">
          <h3 className="map-page__side-title">
            Trò chơi Tháng {currentMonth}
          </h3>

          <nav className="map-page__side-list">
            {WEEKS.map((node) => {
              const unlocked = Boolean(done[String(node.week)])
              return (
                <Button
                  key={node.week}
                  className="btn-wood map-page__side-item"
                  type="button"
                  disabled={!unlocked}
                  onClick={() => openGame(node.week)}
                >
                  {node.label}
                </Button>
              )
            })}
          </nav>

          <div className="map-page__side-score">
            <span>Tổng điểm</span>
            <strong>{totalScore}</strong>
          </div>
        </aside>
      </div>

      <Drawer
        title={`Trò chơi · Tuần ${gameWeek ?? ''}`}
        placement="left"
        width={Math.min(440, typeof window !== 'undefined' ? window.innerWidth : 440)}
        open={gameWeek !== null}
        onClose={closeGame}
        destroyOnHidden
        className="map-quiz-drawer"
        footer={
          gameLesson && gameQuestions.length > 0 ? (
            <Button
              className="btn-wood map-quiz__submit"
              type="button"
              disabled={submittingQuiz || gameAlreadyRewarded}
              onClick={() => void submitQuiz()}
            >
              {gameAlreadyRewarded
                ? 'Đã nhận điểm'
                : submittingQuiz
                  ? 'Đang nộp...'
                  : 'Nộp bài'}
            </Button>
          ) : null
        }
      >
        {!gameLesson ? (
          <div className="map-quiz__empty">
            Tháng {currentMonth} chưa có bài cho tuần {gameWeek} (cấp {level}).
          </div>
        ) : gameQuestions.length === 0 ? (
          <div className="map-quiz__empty">Tuần này chưa có câu hỏi.</div>
        ) : (
          <div className="map-quiz">
            <div className="map-quiz__list">
              {gameQuestions.map((q, index) => renderQuestion(q, index))}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default MapPage