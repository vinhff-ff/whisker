import { useEffect, useState } from 'react'
import { Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { listRtdbUsers, type UserProfile } from '../../service/rtdb'

type UserRow = UserProfile & { key: string }

const columns: ColumnsType<UserRow> = [
  {
    title: 'Username',
    dataIndex: 'username',
    key: 'username',
    render: (username: string, row) => username || row.displayName || '—',
  },
  {
    title: 'Tên hiển thị',
    dataIndex: 'displayName',
    key: 'displayName',
    render: (name: string) => name || '—',
  },
  {
    title: 'Mức',
    dataIndex: 'level',
    key: 'level',
    width: 140,
    render: (level: string | null) => level || 'Chưa xếp hạng',
  },
  {
    title: 'Tổng điểm',
    dataIndex: 'score',
    key: 'score',
    width: 120,
    align: 'right',
    sorter: (a, b) => (a.score || 0) - (b.score || 0),
    defaultSortOrder: 'descend',
    render: (score?: number) => score ?? 0,
  },
]

const AdminUsers = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [users, setUsers] = useState<UserRow[]>([])

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const list = await listRtdbUsers()
        if (!alive) return
        setUsers(
          list
            .map((u) => ({
              ...u,
              key: u.uid,
              score: Number(u.score) || 0,
            }))
            .sort((a, b) => (b.score || 0) - (a.score || 0)),
        )
      } catch (err) {
        if (!alive) return
        setError(err instanceof Error ? err.message : 'Không tải được người dùng.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  return (
    <section className="admin-page admin-users">
      <header className="admin-page__header">
        <h1>Người dùng</h1>
        <p>Danh sách username và tổng điểm hiện tại.</p>
      </header>

      {error ? <p className="admin-form__error">{error}</p> : null}

      <Table<UserRow>
        className="admin-antd-table"
        rowKey="uid"
        columns={columns}
        dataSource={users}
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        locale={{ emptyText: 'Chưa có người dùng.' }}
        scroll={{ x: true }}
      />
    </section>
  )
}

export default AdminUsers
