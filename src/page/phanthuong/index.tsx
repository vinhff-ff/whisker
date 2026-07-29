import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import Button from '../../ui/button'
import { useAuth } from '../../service/AuthGate'
import {
  addUserScore,
  getRtdbUserProfile,
  listRtdbUsers,
  toStoredUser,
  type UserProfile,
} from '../../service/rtdb'
import { listRewards, type RewardItem } from '../../service/rewards'
import { addWinner, listWinners, type Winner } from '../../service/winners'
import { saveUserToStorage } from '../../service/storage'

type UserRow = UserProfile & { key: string }
type WinnerRow = Winner & { key: string }

const PALETTE = [
  '#c48a2e',
  '#3d9a5f',
  '#8b5a2b',
  '#d4a85a',
  '#6b3410',
  '#a87320',
  '#4a2c14',
  '#e4c07a',
]

type Slice = RewardItem & {
  startAngle: number
  endAngle: number
  midAngle: number
  color: string
}

function buildSlices(rewards: RewardItem[]): Slice[] {
  if (rewards.length === 0) return []
  const sweep = 360 / rewards.length
  return rewards.map((r, i) => {
    const startAngle = i * sweep
    const endAngle = startAngle + sweep
    return {
      ...r,
      startAngle,
      endAngle,
      midAngle: (startAngle + endAngle) / 2,
      color: PALETTE[i % PALETTE.length],
    }
  })
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return ['M', cx, cy, 'L', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y, 'Z'].join(' ')
}

const leaderboardColumns: ColumnsType<UserRow> = [
  {
    title: 'Tên',
    key: 'name',
    ellipsis: true,
    render: (_v, row) => row.displayName || row.username || '—',
  },
  {
    title: 'Tổng điểm',
    dataIndex: 'score',
    key: 'score',
    width: 110,
    align: 'right',
    render: (score?: number) => score ?? 0,
  },
]

const winnerColumns: ColumnsType<WinnerRow> = [
  {
    title: 'Tên',
    dataIndex: 'username',
    key: 'username',
    ellipsis: true,
  },
  {
    title: 'Phần thưởng',
    dataIndex: 'rewardName',
    key: 'rewardName',
    ellipsis: true,
  },
  {
    title: 'Thời gian',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 150,
    render: (ts: number) => new Date(ts).toLocaleString('vi-VN'),
  },
]

const SPIN_DURATION_MS = 4200

function useTableBodyHeight(enabled = true) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(200)

  useLayoutEffect(() => {
    if (!enabled) return
    const el = wrapRef.current
    if (!el) return

    const measure = () => {
      const header = el.querySelector('.ant-table-thead') as HTMLElement | null
      const headerH = header?.offsetHeight ?? 40
      const next = Math.max(120, Math.floor(el.clientHeight - headerH))
      setHeight((prev) => (prev === next ? prev : next))
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [enabled])

  return { wrapRef, height }
}

const RewardsPage = () => {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()

  const [rewards, setRewards] = useState<RewardItem[]>([])
  const [winners, setWinners] = useState<WinnerRow[]>([])
  const [leaderboard, setLeaderboard] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)

  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const leaderboardScroll = useTableBodyHeight(true)
  const winnersScroll = useTableBodyHeight(true)

  const slices = useMemo(() => buildSlices(rewards), [rewards])

  const currentScore = profile?.score ?? 0
  const canSpin = currentScore >= 1

  const loadAll = async () => {
    try {
      const [rewardList, winnerList, users] = await Promise.all([
        listRewards(),
        listWinners(),
        listRtdbUsers(),
      ])
      setRewards(rewardList)
      setWinners(winnerList.map((w) => ({ ...w, key: w.id })))
      setLeaderboard(
        users
          .map((u) => ({ ...u, key: u.uid, score: Number(u.score) || 0 }))
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, 20),
      )
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không tải được dữ liệu.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleSpin = async () => {
    if (spinning) return
    if (!user) {
      message.warning('Bạn cần đăng nhập để quay thưởng.')
      return
    }
    if (currentScore < 1) {
      message.warning('Bạn đã hết điểm để quay.')
      return
    }
    if (slices.length === 0) {
      message.info('Hiện chưa có phần thưởng nào để quay.')
      return
    }

    setSpinning(true)
    try {
      const target = slices[Math.floor(Math.random() * slices.length)]

      const spins = 5
      const normalizedPrev = ((rotation % 360) + 360) % 360
      const targetMod = (360 - target.midAngle + 360) % 360
      const delta = (targetMod - normalizedPrev + 360) % 360
      const newRotation = rotation + spins * 360 + delta

      setRotation(newRotation)

      timeoutRef.current = setTimeout(() => {
        void (async () => {
          try {
            const nextScore = await addUserScore(user.uid, -1)
            const remote = await getRtdbUserProfile(user.uid)
            if (remote) {
              saveUserToStorage(toStoredUser(remote))
            }
            await refreshProfile()

            await addWinner({
              uid: user.uid,
              username: profile?.displayName || profile?.username || user.uid,
              rewardId: target.id,
              rewardName: target.name,
            })

            message.success(`Chúc mừng! Bạn trúng: ${target.name} (còn ${nextScore} điểm)`)
            await loadAll()
          } catch (err) {
            message.error(err instanceof Error ? err.message : 'Lưu kết quả thất bại.')
          } finally {
            setSpinning(false)
          }
        })()
      }, SPIN_DURATION_MS)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Quay thưởng thất bại.')
      setSpinning(false)
    }
  }

  return (
    <section className="rewards-page">
      <div className="rewards-page__topbar">
        <Button
          className="btn-wood btn-wood--compact rewards-page__back"
          type="button"
          onClick={() => navigate('/')}
        >
          Quay lại
        </Button>
      </div>

      <div className="rewards-page__content">
        <div className="rewards-page__left">
          <div className="rewards-page__wheel-block">
            <div className="rewards-wheel">
              <div className="rewards-wheel__pointer" aria-hidden />
              <div
                className="rewards-wheel__disc"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning
                    ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`
                    : 'none',
                }}
              >
                <svg viewBox="0 0 300 300" width="100%" height="100%">
                  {slices.length === 0 ? (
                    <circle cx={150} cy={150} r={145} fill="#8b5a2b" stroke="#fff6d0" strokeWidth={1.5} />
                  ) : (
                    slices.map((s) => (
                      <path
                        key={s.id}
                        d={describeArc(150, 150, 145, s.startAngle, s.endAngle)}
                        fill={s.color}
                        stroke="#fff6d0"
                        strokeWidth={1.5}
                      />
                    ))
                  )}
                  {slices.map((s) => {
                    const imgSize = Math.min(36, Math.max(22, 180 / Math.max(slices.length, 1)))
                    const textPos = polarToCartesian(150, 150, 112, s.midAngle)
                    const imgPos = polarToCartesian(150, 150, 78, s.midAngle)
                    const label =
                      s.name.length > 12 ? `${s.name.slice(0, 10)}…` : s.name
                    return (
                      <g key={`${s.id}-label`}>
                        <text
                          x={textPos.x}
                          y={textPos.y}
                          fill="#fff6d0"
                          fontSize={11}
                          fontWeight={800}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${s.midAngle} ${textPos.x} ${textPos.y})`}
                        >
                          {label}
                        </text>
                        {s.image ? (
                          <g transform={`rotate(${s.midAngle} ${imgPos.x} ${imgPos.y})`}>
                            <defs>
                              <clipPath id={`reward-clip-${s.id}`}>
                                <circle cx={imgPos.x} cy={imgPos.y} r={imgSize / 2} />
                              </clipPath>
                            </defs>
                            <circle
                              cx={imgPos.x}
                              cy={imgPos.y}
                              r={imgSize / 2 + 2}
                              fill="rgba(255, 246, 208, 0.92)"
                            />
                            <image
                              href={s.image}
                              x={imgPos.x - imgSize / 2}
                              y={imgPos.y - imgSize / 2}
                              width={imgSize}
                              height={imgSize}
                              preserveAspectRatio="xMidYMid slice"
                              clipPath={`url(#reward-clip-${s.id})`}
                              style={{ pointerEvents: 'none' }}
                            />
                          </g>
                        ) : null}
                      </g>
                    )
                  })}
                  <circle cx={150} cy={150} r={28} fill="#6b3410" stroke="#fff6d0" strokeWidth={3} />
                  <circle cx={150} cy={150} r={12} fill="#c48a2e" />
                </svg>
              </div>
            </div>

            <div className="rewards-page__spin-info">
              Điểm hiện có: <strong>{currentScore}</strong>
            </div>

            <Button
              className="btn-wood btn-wood--compact rewards-page__spin-btn"
              type="button"
              disabled={spinning || loading || slices.length === 0 || !canSpin}
              onClick={() => void handleSpin()}
            >
              {spinning ? 'Đang quay...' : !canSpin ? 'Hết điểm để quay' : 'Quay ngay'}
            </Button>
          </div>
        </div>

        <div className="rewards-page__right">
          <div className="rewards-page__table-block">
            <h2 style={{ fontWeight: 700 }}>Bảng xếp hạng</h2>
            <div className="rewards-page__table-scroll" ref={leaderboardScroll.wrapRef}>
              <Table<UserRow>
                className="rewards-table"
                rowKey="uid"
                columns={leaderboardColumns}
                dataSource={leaderboard}
                loading={loading}
                pagination={false}
                locale={{ emptyText: 'Chưa có dữ liệu.' }}
                scroll={{ y: leaderboardScroll.height }}
                size="small"
              />
            </div>
          </div>

          <div className="rewards-page__table-block">
            <h2 style={{ fontWeight: 700 }}>Danh sách trúng thưởng</h2>
            <div className="rewards-page__table-scroll" ref={winnersScroll.wrapRef}>
              <Table<WinnerRow>
                className="rewards-table"
                rowKey="id"
                columns={winnerColumns}
                dataSource={winners}
                loading={loading}
                pagination={false}
                locale={{ emptyText: 'Chưa có ai trúng thưởng.' }}
                scroll={{ y: winnersScroll.height }}
                size="small"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default RewardsPage
