import { useEffect, useId, useState, type FormEvent } from 'react'
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons'
import { App as AntApp, Button, Drawer, Space, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  createEmptyBlock,
  createEmptyQuestion,
  createGuide,
  deleteGuide,
  fileToDataUrl,
  listGuides,
  updateGuide,
  type GuideBlock,
  type GuideBlockType,
  type GuideItem,
  type GuideQuestion,
  type QuestionType,
} from '../../service/guides'

type FormState = {
  level: number
  month: number
  week: number
  guides: GuideBlock[]
  questions: GuideQuestion[]
}

type DrawerMode = 'create' | 'edit' | 'view' | null

const emptyForm = (): FormState => ({
  level: 1,
  month: 1,
  week: 1,
  guides: [],
  questions: [],
})

const LEVELS = [1, 2, 3, 4]
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const WEEKS = [1, 2, 3, 4]

const BLOCK_LABEL: Record<GuideBlockType, string> = {
  step: 'Bước',
  image: 'Ảnh',
  youtube: 'YouTube',
}

const QUESTION_LABEL: Record<QuestionType, string> = {
  letters: 'Điền chữ cái',
  choice: 'Trắc nghiệm',
  short: 'Đáp án ngắn',
}

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
      const parts = u.pathname.split('/')
      const embedIdx = parts.indexOf('embed')
      if (embedIdx >= 0 && parts[embedIdx + 1]) {
        return `https://www.youtube.com/embed/${parts[embedIdx + 1]}`
      }
    }
  } catch {
    return ''
  }
  return ''
}

const DRAWER_TITLE: Record<Exclude<DrawerMode, null>, string> = {
  create: 'Thêm nội dung',
  edit: 'Sửa nội dung',
  view: 'Xem nội dung',
}

function AdminContentInner() {
  const { modal, message } = AntApp.useApp()
  const formId = useId()
  const [items, setItems] = useState<GuideItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewing, setViewing] = useState<GuideItem | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const drawerOpen = drawerMode !== null
  const drawerWidth =
    typeof window !== 'undefined' ? Math.min(1080, window.innerWidth) : 1080

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await listGuides())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu.')
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

  const openView = (item: GuideItem) => {
    setDrawerMode('view')
    setViewing(item)
    setEditingId(null)
    setError('')
  }

  const openEdit = (item: GuideItem) => {
    setDrawerMode('edit')
    setEditingId(item.id)
    setViewing(null)
    setForm({
      level: item.level,
      month: item.month,
      week: item.week,
      guides: item.guides.map((g) => ({ ...g })),
      questions: (item.questions || []).map((q) => ({
        ...q,
        options: q.options ? [...q.options] : undefined,
      })),
    })
    setError('')
  }

  const addBlock = (type: GuideBlockType) => {
    setForm((prev) => ({
      ...prev,
      guides: [...prev.guides, createEmptyBlock(type)],
    }))
  }

  const updateBlock = (id: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      guides: prev.guides.map((g) => (g.id === id ? { ...g, value } : g)),
    }))
  }

  const removeBlock = (id: string) => {
    setForm((prev) => ({
      ...prev,
      guides: prev.guides.filter((g) => g.id !== id),
    }))
  }

  const addQuestion = (type: QuestionType) => {
    setForm((prev) => ({
      ...prev,
      questions: [...prev.questions, createEmptyQuestion(type)],
    }))
  }

  const updateQuestion = (id: string, patch: Partial<GuideQuestion>) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }))
  }

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== questionId) return q
        const options = [...(q.options || [])]
        options[optionIndex] = value
        return { ...q, options }
      }),
    }))
  }

  const addOption = (questionId: string) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== questionId) return q
        return { ...q, options: [...(q.options || []), ''] }
      }),
    }))
  }

  const removeOption = (questionId: string, optionIndex: number) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== questionId) return q
        const options = (q.options || []).filter((_, i) => i !== optionIndex)
        const correctIndex =
          q.correctIndex !== undefined && q.correctIndex >= options.length
            ? Math.max(0, options.length - 1)
            : q.correctIndex
        return { ...q, options, correctIndex }
      }),
    }))
  }

  const removeQuestion = (id: string) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== id),
    }))
  }

  const onPickImage = async (blockId: string, file: File | null) => {
    if (!file) return
    setError('')
    try {
      const base64 = await fileToDataUrl(file)
      updateBlock(blockId, base64)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đọc được ảnh.')
    }
  }

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault()
    setSaving(true)
    setError('')

    try {
      const guides = form.guides.map((block) => ({
        ...block,
        value: block.value.trim(),
      }))

      const questions = form.questions.map((q) => {
        const base: GuideQuestion = {
          id: q.id,
          type: q.type,
          prompt: q.prompt.trim(),
          answer: q.answer.trim(),
        }
        if (q.type === 'choice') {
          const options = (q.options || []).map((o) => o.trim())
          const correctIndex = q.correctIndex ?? 0
          return {
            ...base,
            options,
            correctIndex,
            answer: options[correctIndex] || base.answer,
          }
        }
        return base
      })

      const payload = {
        level: form.level,
        month: form.month,
        week: form.week,
        guides,
        questions,
      }

      if (drawerMode === 'edit' && editingId) {
        await updateGuide(editingId, payload)
        message.success('Đã cập nhật nội dung.')
      } else {
        await createGuide(payload)
        message.success('Đã thêm nội dung.')
      }

      await load()
      closeDrawer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (item: GuideItem) => {
    modal.confirm({
      title: 'Xóa nội dung?',
      content: `Bạn có chắc muốn xóa Cấp ${item.level} · Tháng ${item.month} · Tuần ${item.week}?`,
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try {
          await deleteGuide(item.id)
          setItems((prev) => prev.filter((x) => x.id !== item.id))
          if (editingId === item.id || viewing?.id === item.id) closeDrawer()
          message.success('Đã xóa nội dung.')
        } catch (err) {
          message.error(err instanceof Error ? err.message : 'Xóa thất bại.')
          throw err
        }
      },
    })
  }

  const columns: ColumnsType<GuideItem> = [
    {
      title: 'Cấp',
      dataIndex: 'level',
      key: 'level',
      width: 90,
      render: (level: number) => `Cấp ${level}`,
    },
    {
      title: 'Tháng',
      dataIndex: 'month',
      key: 'month',
      width: 100,
      render: (month: number) => `Tháng ${month}`,
    },
    {
      title: 'Tuần',
      dataIndex: 'week',
      key: 'week',
      width: 90,
      render: (week: number) => `Tuần ${week}`,
    },
    {
      title: 'Hướng dẫn',
      key: 'guides',
      render: (_, item) => `${item.guides?.length || 0} ô`,
    },
    {
      title: 'Câu hỏi',
      key: 'questions',
      render: (_, item) => `${item.questions?.length || 0} câu`,
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

  const renderGuidesEditor = () => (
    <div className="admin-guides">
      <div className="admin-guides__toolbar">
        <h2>Hướng dẫn</h2>
        <div className="admin-guides__actions">
          <Button size="small" onClick={() => addBlock('step')}>
            + Bước
          </Button>
          <Button size="small" onClick={() => addBlock('image')}>
            + Ảnh
          </Button>
          <Button size="small" onClick={() => addBlock('youtube')}>
            + YT
          </Button>
        </div>
      </div>

      {form.guides.length === 0 ? (
        <div className="admin-page__empty">Chưa có ô hướng dẫn.</div>
      ) : (
        <ul className="admin-guides__list">
          {form.guides.map((block, index) => (
            <li key={block.id} className="admin-guide-block">
              <div className="admin-guide-block__head">
                <strong>
                  {BLOCK_LABEL[block.type]} #{index + 1}
                </strong>
                <Button size="small" danger type="text" onClick={() => removeBlock(block.id)}>
                  Xóa
                </Button>
              </div>

              {block.type === 'step' && (
                <textarea
                  rows={3}
                  placeholder="Nội dung bước..."
                  value={block.value}
                  onChange={(e) => updateBlock(block.id, e.target.value)}
                />
              )}

              {block.type === 'image' && (
                <div className="admin-guide-block__image">
                  <label className="admin-file">
                    <span>Chọn ảnh</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        void onPickImage(block.id, e.target.files?.[0] || null)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  <input
                    type="url"
                    placeholder="Hoặc dán link ảnh..."
                    value={block.value.startsWith('data:') ? '' : block.value}
                    onChange={(e) => updateBlock(block.id, e.target.value)}
                  />
                  {block.value ? (
                    <img
                      src={block.value}
                      alt={`Preview ${index + 1}`}
                      className="admin-guide-block__preview"
                    />
                  ) : null}
                </div>
              )}

              {block.type === 'youtube' && (
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={block.value}
                  onChange={(e) => updateBlock(block.id, e.target.value)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  const renderQuestionsEditor = () => (
    <div className="admin-guides admin-questions">
      <div className="admin-guides__toolbar">
        <h2>Câu hỏi</h2>
        <div className="admin-guides__actions">
          <Button size="small" onClick={() => addQuestion('letters')}>
            + Điền chữ
          </Button>
          <Button size="small" onClick={() => addQuestion('choice')}>
            + Trắc nghiệm
          </Button>
          <Button size="small" onClick={() => addQuestion('short')}>
            + Đáp án ngắn
          </Button>
        </div>
      </div>

      {form.questions.length === 0 ? (
        <div className="admin-page__empty">Chưa có câu hỏi.</div>
      ) : (
        <ul className="admin-guides__list">
          {form.questions.map((q, index) => (
            <li key={q.id} className="admin-guide-block">
              <div className="admin-guide-block__head">
                <strong>
                  {QUESTION_LABEL[q.type]} #{index + 1}
                </strong>
                <Button size="small" danger type="text" onClick={() => removeQuestion(q.id)}>
                  Xóa
                </Button>
              </div>

              <label className="admin-field">
                <span>Câu hỏi</span>
                <textarea
                  rows={2}
                  placeholder="Nhập đề bài..."
                  value={q.prompt}
                  onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })}
                />
              </label>

              {q.type === 'choice' ? (
                <div className="admin-choice-options">
                  <span className="admin-choice-options__label">Đáp án (chọn đáp án đúng)</span>
                  {(q.options || []).map((opt, oi) => (
                    <div key={`${q.id}-opt-${oi}`} className="admin-choice-options__row">
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={(q.correctIndex ?? 0) === oi}
                        onChange={() => updateQuestion(q.id, { correctIndex: oi })}
                        aria-label={`Đáp án đúng ${oi + 1}`}
                      />
                      <input
                        type="text"
                        placeholder={`Lựa chọn ${oi + 1}`}
                        value={opt}
                        onChange={(e) => updateOption(q.id, oi, e.target.value)}
                      />
                      <Button
                        size="small"
                        type="text"
                        danger
                        disabled={(q.options || []).length <= 2}
                        onClick={() => removeOption(q.id, oi)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <Button size="small" onClick={() => addOption(q.id)}>
                    + Thêm lựa chọn
                  </Button>
                </div>
              ) : (
                <label className="admin-field">
                  <span>{q.type === 'letters' ? 'Đáp án (chữ cái / từ)' : 'Đáp án ngắn'}</span>
                  <input
                    type="text"
                    placeholder={
                      q.type === 'letters' ? 'Ví dụ: APPLE hoặc A,P,P,L,E' : 'Nhập đáp án đúng...'
                    }
                    value={q.answer}
                    onChange={(e) => updateQuestion(q.id, { answer: e.target.value })}
                  />
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <section className="admin-page admin-content">
      <header className="admin-page__header admin-content__header">
        <div>
          <h1>Nội dung</h1>
          <p>Hướng dẫn + câu hỏi theo cấp · tháng · tuần.</p>
        </div>
        <Button type="primary" onClick={openCreate}>
          + Thêm mới
        </Button>
      </header>

      {error && !drawerOpen ? <p className="admin-form__error">{error}</p> : null}

      <Table<GuideItem>
        className="admin-antd-table"
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        locale={{ emptyText: 'Chưa có nội dung. Bấm “Thêm mới” để tạo.' }}
        scroll={{ x: true }}
      />

      <Drawer
        title={drawerMode ? DRAWER_TITLE[drawerMode] : ''}
        placement="right"
        width={drawerWidth}
        open={drawerOpen}
        onClose={closeDrawer}
        destroyOnHidden
        className="admin-drawer admin-drawer--wide"
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
            <div className="admin-view-meta">
              <span>Cấp {viewing.level}</span>
              <span>Tháng {viewing.month}</span>
              <span>Tuần {viewing.week}</span>
              <span>{viewing.guides.length} hướng dẫn</span>
              <span>{(viewing.questions || []).length} câu hỏi</span>
            </div>

            <div className="admin-split">
              <div className="admin-split__pane">
                <h3 className="admin-split__title">Hướng dẫn</h3>
                {viewing.guides.length === 0 ? (
                  <div className="admin-page__empty">Chưa có hướng dẫn.</div>
                ) : (
                  <ol className="admin-view-list">
                    {viewing.guides.map((block, index) => {
                      const embed =
                        block.type === 'youtube' ? youtubeEmbedUrl(block.value) : ''
                      return (
                        <li key={block.id} className="admin-view-block">
                          <div className="admin-view-block__label">
                            {BLOCK_LABEL[block.type]} #{index + 1}
                          </div>
                          {block.type === 'step' && (
                            <p className="admin-view-block__text">
                              {block.value || <em>Trống</em>}
                            </p>
                          )}
                          {block.type === 'image' &&
                            (block.value ? (
                              <img
                                src={block.value}
                                alt={`Ảnh ${index + 1}`}
                                className="admin-view-block__image"
                              />
                            ) : (
                              <p className="admin-view-block__text">
                                <em>Chưa có ảnh</em>
                              </p>
                            ))}
                          {block.type === 'youtube' &&
                            (embed ? (
                              <div className="admin-view-block__video">
                                <iframe
                                  src={embed}
                                  title={`YouTube ${index + 1}`}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            ) : (
                              <p className="admin-view-block__text">
                                {block.value || <em>Chưa có link</em>}
                              </p>
                            ))}
                        </li>
                      )
                    })}
                  </ol>
                )}
              </div>

              <div className="admin-split__pane">
                <h3 className="admin-split__title">Câu hỏi</h3>
                {(viewing.questions || []).length === 0 ? (
                  <div className="admin-page__empty">Chưa có câu hỏi.</div>
                ) : (
                  <ol className="admin-view-list">
                    {(viewing.questions || []).map((q, index) => (
                      <li key={q.id} className="admin-view-block">
                        <div className="admin-view-block__label">
                          {QUESTION_LABEL[q.type]} #{index + 1}
                        </div>
                        <p className="admin-view-block__text">{q.prompt || <em>Trống</em>}</p>
                        {q.type === 'choice' ? (
                          <ul className="admin-view-choices">
                            {(q.options || []).map((opt, oi) => (
                              <li
                                key={`${q.id}-v-${oi}`}
                                className={oi === q.correctIndex ? 'is-correct' : ''}
                              >
                                {opt || <em>Trống</em>}
                                {oi === q.correctIndex ? ' ✓' : ''}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="admin-view-block__answer">
                            Đáp án: <strong>{q.answer || '—'}</strong>
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {(drawerMode === 'create' || drawerMode === 'edit') && (
          <form className="admin-form admin-drawer-body" onSubmit={handleSave} id={formId}>
            <div className="admin-form__row">
              <label className="admin-field">
                <span>Cấp độ</span>
                <select
                  value={form.level}
                  onChange={(e) => setForm((p) => ({ ...p, level: Number(e.target.value) }))}
                >
                  {LEVELS.map((n) => (
                    <option key={n} value={n}>
                      Cấp {n}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Tháng</span>
                <select
                  value={form.month}
                  onChange={(e) => setForm((p) => ({ ...p, month: Number(e.target.value) }))}
                >
                  {MONTHS.map((n) => (
                    <option key={n} value={n}>
                      Tháng {n}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Tuần</span>
                <select
                  value={form.week}
                  onChange={(e) => setForm((p) => ({ ...p, week: Number(e.target.value) }))}
                >
                  {WEEKS.map((n) => (
                    <option key={n} value={n}>
                      Tuần {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="admin-split">
              <div className="admin-split__pane">{renderGuidesEditor()}</div>
              <div className="admin-split__pane">{renderQuestionsEditor()}</div>
            </div>

            {error ? <p className="admin-form__error">{error}</p> : null}
          </form>
        )}
      </Drawer>
    </section>
  )
}

const AdminContent = () => (
  <AntApp>
    <AdminContentInner />
  </AntApp>
)

export default AdminContent
