import { useEffect, useMemo, useState } from 'react'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { listGuides } from '../../service/guides'
import { listRtdbUsers, type UserProfile } from '../../service/rtdb'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
)

const LEVEL_ORDER = ['Mới bắt đầu', 'Cơ bản', 'Khá'] as const
const DAY_RANGE = 14

type DashboardStats = {
  totalUsers: number
  totalGuides: number
  testedUsers: number
  untestedUsers: number
}

function startOfDay(ts: number) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function formatDay(ts: number) {
  const d = new Date(ts)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

function buildLevelCounts(users: UserProfile[]) {
  const counts: Record<string, number> = {
    'Mới bắt đầu': 0,
    'Cơ bản': 0,
    Khá: 0,
    'Chưa xếp hạng': 0,
  }

  for (const user of users) {
    const level = user.level?.trim()
    if (!level) {
      counts['Chưa xếp hạng'] += 1
      continue
    }
    if (level in counts) counts[level] += 1
    else counts[level] = (counts[level] || 0) + 1
  }

  const labels = [
    ...LEVEL_ORDER.filter((l) => l in counts),
    ...Object.keys(counts).filter(
      (l) => !LEVEL_ORDER.includes(l as (typeof LEVEL_ORDER)[number]) && l !== 'Chưa xếp hạng',
    ),
    'Chưa xếp hạng',
  ]

  return {
    labels,
    values: labels.map((l) => counts[l] || 0),
  }
}

function buildDailyRegistrations(users: UserProfile[], days = DAY_RANGE) {
  const today = startOfDay(Date.now())
  const labels: string[] = []
  const values: number[] = []
  const bucket = new Map<number, number>()

  for (let i = days - 1; i >= 0; i -= 1) {
    const day = today - i * 24 * 60 * 60 * 1000
    bucket.set(day, 0)
    labels.push(formatDay(day))
  }

  for (const user of users) {
    const created = Number(user.createdAt) || 0
    if (!created) continue
    const day = startOfDay(created)
    if (bucket.has(day)) bucket.set(day, (bucket.get(day) || 0) + 1)
  }

  for (let i = days - 1; i >= 0; i -= 1) {
    const day = today - i * 24 * 60 * 60 * 1000
    values.push(bucket.get(day) || 0)
  }

  return { labels, values }
}

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [users, setUsers] = useState<UserProfile[]>([])
  const [guideCount, setGuideCount] = useState(0)

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [userList, guides] = await Promise.all([listRtdbUsers(), listGuides()])
        if (!alive) return
        setUsers(userList)
        setGuideCount(guides.length)
      } catch (err) {
        if (!alive) return
        setError(err instanceof Error ? err.message : 'Không tải được thống kê.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  const stats: DashboardStats = useMemo(() => {
    const testedUsers = users.filter((u) => u.hasCompletedTest).length
    return {
      totalUsers: users.length,
      totalGuides: guideCount,
      testedUsers,
      untestedUsers: users.length - testedUsers,
    }
  }, [users, guideCount])

  const levelChart = useMemo(() => buildLevelCounts(users), [users])
  const dailyChart = useMemo(() => buildDailyRegistrations(users), [users])

  const levelColors = ['#1677ff', '#69b1ff', '#91caff', '#bfbfbf', '#d9d9d9', '#8c8c8c']

  const levelData = {
    labels: levelChart.labels,
    datasets: [
      {
        label: 'Người dùng',
        data: levelChart.values,
        backgroundColor: levelChart.labels.map((_, i) => levelColors[i % levelColors.length]),
        borderRadius: 2,
        maxBarThickness: 48,
      },
    ],
  }

  const dailyData = {
    labels: dailyChart.labels,
    datasets: [
      {
        label: 'Đăng ký',
        data: dailyChart.values,
        borderColor: '#1677ff',
        backgroundColor: 'rgba(22, 119, 255, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#1677ff',
      },
    ],
  }

  return (
    <section className="admin-page admin-dashboard">
      <header className="admin-page__header">
        <h1>Tổng quan</h1>
        <p>Thống kê người dùng và bài giảng.</p>
      </header>

      {error ? <p className="admin-form__error">{error}</p> : null}

      <div className="admin-page__grid admin-dashboard__stats">
        <article className="admin-stat">
          <span className="admin-stat__label">Tổng người dùng</span>
          <strong className="admin-stat__value">{loading ? '—' : stats.totalUsers}</strong>
        </article>
        <article className="admin-stat">
          <span className="admin-stat__label">Tổng bài giảng</span>
          <strong className="admin-stat__value">{loading ? '—' : stats.totalGuides}</strong>
        </article>
        <article className="admin-stat">
          <span className="admin-stat__label">Đã làm bài test</span>
          <strong className="admin-stat__value">{loading ? '—' : stats.testedUsers}</strong>
        </article>
        <article className="admin-stat">
          <span className="admin-stat__label">Chưa làm test</span>
          <strong className="admin-stat__value">{loading ? '—' : stats.untestedUsers}</strong>
        </article>
      </div>

      <div className="admin-dashboard__charts">
        <article className="admin-chart-card">
          <header className="admin-chart-card__header">
            <h2>Người dùng theo mức</h2>
            <p>Phân bổ theo kết quả bài test.</p>
          </header>
          <div className="admin-chart-card__body">
            {loading ? (
              <div className="admin-page__empty">Đang tải biểu đồ...</div>
            ) : (
              <Bar
                data={levelData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                  },
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: { color: 'rgba(0,0,0,0.45)' },
                    },
                    y: {
                      beginAtZero: true,
                      ticks: {
                        precision: 0,
                        color: 'rgba(0,0,0,0.45)',
                      },
                      grid: { color: '#f0f0f0' },
                    },
                  },
                }}
              />
            )}
          </div>
        </article>

        <article className="admin-chart-card">
          <header className="admin-chart-card__header">
            <h2>Đăng ký theo ngày</h2>
            <p>{DAY_RANGE} ngày gần nhất.</p>
          </header>
          <div className="admin-chart-card__body">
            {loading ? (
              <div className="admin-page__empty">Đang tải biểu đồ...</div>
            ) : (
              <Line
                data={dailyData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                  },
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: { color: 'rgba(0,0,0,0.45)' },
                    },
                    y: {
                      beginAtZero: true,
                      ticks: {
                        precision: 0,
                        color: 'rgba(0,0,0,0.45)',
                      },
                      grid: { color: '#f0f0f0' },
                    },
                  },
                }}
              />
            )}
          </div>
        </article>
      </div>
    </section>
  )
}

export default AdminDashboard
