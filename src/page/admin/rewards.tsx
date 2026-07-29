import { useEffect, useState, type FormEvent } from 'react'
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons'
import { App as AntApp, Button, Drawer, Space, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { fileToDataUrl } from '../../service/guides'
import {
  createReward,
  deleteReward,
  listRewards,
  updateReward,
  type RewardItem,
} from '../../service/rewards'

type DrawerMode = 'create' | 'edit' | 'view' | null

type FormState = {
  name: string
  image: string
}

const emptyForm = (): FormState => ({ name: '', image: '' })

const DRAWER_TITLE: Record<Exclude<DrawerMode, null>, string> = {
  create: 'Thêm phần thưởng',
  edit: 'Sửa phần thưởng',
  view: 'Xem phần thưởng',
}

function AdminRewardsInner() {
  const { modal, message } = AntApp.useApp()
  const [items, setItems] = useState<RewardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewing, setViewing] = useState<RewardItem | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const drawerOpen = drawerMode !== null

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await listRewards())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được phần thưởng.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const closeDrawer = () => {
    setDrawerMode(null)
    setEditingId(null)
    setViewing(null)
    setForm(emptyForm())
    setError('')
  }

  const openCreate = () => {
    setDrawerMode('create')
    setEditingId(null)
    setViewing(null)
    setForm(emptyForm())
    setError('')
  }

  const openView = (item: RewardItem) => {
    setDrawerMode('view')
    setViewing(item)
    setEditingId(null)
    setError('')
  }

  const openEdit = (item: RewardItem) => {
    setDrawerMode('edit')
    setEditingId(item.id)
    setViewing(null)
    setForm({ name: item.name, image: item.image })
    setError('')
  }

  const onPickImage = async (file: File | null) => {
    if (!file) return
    setError('')
    try {
      const base64 = await fileToDataUrl(file)
      setForm((prev) => ({ ...prev, image: base64 }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đọc được ảnh.')
    }
  }

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault()
    const name = form.name.trim()
    if (!name) {
      setError('Vui lòng nhập tên phần thưởng.')
      return
    }
    if (!form.image) {
      setError('Vui lòng chọn ảnh phần thưởng.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = { name, image: form.image }
      if (drawerMode === 'edit' && editingId) {
        await updateReward(editingId, payload)
        message.success('Đã cập nhật phần thưởng.')
      } else {
        await createReward(payload)
        message.success('Đã thêm phần thưởng.')
      }
      await load()
      closeDrawer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (item: RewardItem) => {
    modal.confirm({
      title: 'Xóa phần thưởng?',
      content: `Bạn có chắc muốn xóa “${item.name}”?`,
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try {
          await deleteReward(item.id)
          setItems((prev) => prev.filter((x) => x.id !== item.id))
          if (editingId === item.id || viewing?.id === item.id) closeDrawer()
          message.success('Đã xóa phần thưởng.')
        } catch (err) {
          message.error(err instanceof Error ? err.message : 'Xóa thất bại.')
          throw err
        }
      },
    })
  }

  const columns: ColumnsType<RewardItem> = [
    {
      title: 'Ảnh',
      dataIndex: 'image',
      key: 'image',
      width: 88,
      render: (image: string, item) =>
        image ? (
          <img src={image} alt={item.name} className="admin-reward-thumb" />
        ) : (
          '—'
        ),
    },
    {
      title: 'Tên',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 140,
      align: 'right',
      render: (_, item) => (
        <Space size={4}>
          <Tooltip title="Xem">
            <Button
              size="small"
              type="text"
              icon={<EyeOutlined />}
              onClick={() => openView(item)}
              aria-label="Xem"
            />
          </Tooltip>
          <Tooltip title="Sửa">
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEdit(item)}
              aria-label="Sửa"
            />
          </Tooltip>
          <Tooltip title="Xóa">
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(item)}
              aria-label="Xóa"
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <section className="admin-page admin-rewards">
      <header className="admin-page__header admin-content__header">
        <div>
          <h1>Phần thưởng</h1>
          <p>Xem, thêm, sửa, xóa phần thưởng (tên + ảnh base64).</p>
        </div>
        <Button type="primary" onClick={openCreate}>
          + Thêm mới
        </Button>
      </header>

      {error && !drawerOpen ? <p className="admin-form__error">{error}</p> : null}

      <Table<RewardItem>
        className="admin-antd-table"
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        locale={{ emptyText: 'Chưa có phần thưởng. Bấm “Thêm mới” để tạo.' }}
        scroll={{ x: true }}
      />

      <Drawer
        title={drawerMode ? DRAWER_TITLE[drawerMode] : ''}
        placement="right"
        width={Math.min(520, typeof window !== 'undefined' ? window.innerWidth : 520)}
        open={drawerOpen}
        onClose={closeDrawer}
        destroyOnHidden
        className="admin-drawer"
        extra={
          drawerMode === 'view' && viewing ? (
            <Button type="primary" onClick={() => openEdit(viewing)}>
              Sửa
            </Button>
          ) : drawerMode === 'create' || drawerMode === 'edit' ? (
            <Space>
              <Button onClick={closeDrawer} disabled={saving}>
                Hủy
              </Button>
              <Button type="primary" loading={saving} onClick={() => void handleSave()}>
                {drawerMode === 'create' ? 'Thêm mới' : 'Cập nhật'}
              </Button>
            </Space>
          ) : null
        }
      >
        {drawerMode === 'view' && viewing ? (
          <div className="admin-drawer-body">
            <div className="admin-reward-view">
              <h2>{viewing.name}</h2>
              {viewing.image ? (
                <img src={viewing.image} alt={viewing.name} className="admin-reward-view__image" />
              ) : (
                <div className="admin-page__empty">Chưa có ảnh.</div>
              )}
            </div>
          </div>
        ) : null}

        {(drawerMode === 'create' || drawerMode === 'edit') && (
          <form className="admin-form admin-drawer-body" onSubmit={handleSave}>
            <label className="admin-field">
              <span>Tên phần thưởng</span>
              <input
                type="text"
                placeholder="Nhập tên..."
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </label>

            <div className="admin-field">
              <span>Ảnh (base64)</span>
              <div className="admin-guide-block__image">
                <label className="admin-file">
                  <span>Chọn ảnh</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      void onPickImage(e.target.files?.[0] || null)
                      e.target.value = ''
                    }}
                  />
                </label>
                {form.image ? (
                  <img src={form.image} alt="Preview" className="admin-guide-block__preview" />
                ) : null}
              </div>
            </div>

            {error ? <p className="admin-form__error">{error}</p> : null}
          </form>
        )}
      </Drawer>
    </section>
  )
}

const AdminRewards = () => (
  <AntApp>
    <AdminRewardsInner />
  </AntApp>
)

export default AdminRewards
