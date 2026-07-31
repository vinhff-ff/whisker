import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons'
import { App as AntApp, Button, Drawer, Space, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  createEmptyBlock,
  createEmptyQuestion,
  createGuide,
  deleteGuide,
  fileToDataUrl,
  getProofRequiredBlockIds,
  listGuides,
  syncMonthDescription,
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
  monthDescription: string
  weekDescription: string
  tasksTitle: string
  outputsTitle: string
  guides: GuideBlock[]
  questions: GuideQuestion[]
}

type DrawerMode = 'create' | 'edit' | 'view' | null

const emptyForm = (): FormState => ({
  level: 1,
  month: 0,
  week: 0,
  monthDescription: '',
  weekDescription: '',
  tasksTitle: '',
  outputsTitle: '',
  guides: [],
  questions: [],
})

const LEVELS = [1, 2, 3, 4]
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const WEEKS = [1, 2, 3, 4]

const BLOCK_LABEL: Record<GuideBlockType, string> = {
  task: 'Nhiệm vụ',
  output: 'Output',
  key: 'Key',
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

function blocksOfType(guides: GuideBlock[], type: GuideBlockType) {
  return guides.filter((g) => g.type === type)
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

  const monthSelected = form.month > 0
  const weekSelected = form.week > 0

  const taskBlocks = useMemo(
    () => blocksOfType(form.guides, 'task'),
    [form.guides],
  )
  const outputBlocks = useMemo(
    () => blocksOfType(form.guides, 'output'),
    [form.guides],
  )
  const keyBlocks = useMemo(
    () => blocksOfType(form.guides, 'key'),
    [form.guides],
  )

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
      monthDescription: item.monthDescription || '',
      weekDescription: item.weekDescription || '',
      tasksTitle: item.tasksTitle || '',
      outputsTitle: item.outputsTitle || '',
      guides: item.guides.map((g) => ({ ...g })),
      questions: (item.questions || []).map((q) => ({
        ...q,
        options: q.options ? [...q.options] : undefined,
      })),
    })
    setError('')
  }

  const findMonthDescription = (level: number, month: number) => {
    const hit = items.find(
      (g) =>
        g.level === level &&
        g.month === month &&
        (g.monthDescription || '').trim(),
    )
    return hit?.monthDescription || ''
  }

  const onLevelChange = (level: number) => {
    setForm((prev) => {
      const monthDescription =
        prev.month > 0 ? findMonthDescription(level, prev.month) : prev.monthDescription
      return { ...prev, level, monthDescription }
    })
  }

  const onMonthChange = (month: number) => {
    setForm((prev) => ({
      ...prev,
      month,
      week: 0,
      weekDescription: '',
      tasksTitle: '',
      outputsTitle: '',
      guides: [],
      questions: [],
      monthDescription:
        month > 0 ? findMonthDescription(prev.level, month) : '',
    }))
  }

  const onWeekChange = (week: number) => {
    setForm((prev) => ({
      ...prev,
      week,
      ...(week <= 0
        ? {
            weekDescription: '',
            tasksTitle: '',
            outputsTitle: '',
            guides: [],
            questions: [],
          }
        : {}),
    }))
  }

  const addBlock = (type: 'task' | 'output' | 'key') => {
    setForm((prev) => ({
      ...prev,
      guides: [...prev.guides, createEmptyBlock(type)],
    }))
  }

  const updateBlock = (id: string, patch: Partial<GuideBlock>) => {
    setForm((prev) => ({
      ...prev,
      guides: prev.guides.map((g) => (g.id === id ? { ...g, ...patch } : g)),
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

  const onPickTaskImage = async (blockId: string, file: File | null) => {
    if (!file) return
    setError('')
    try {
      const base64 = await fileToDataUrl(file)
      updateBlock(blockId, { imageValue: base64 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đọc được ảnh.')
    }
  }

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!form.month) {
      setError('Hãy chọn tháng.')
      return
    }
    if (!form.week) {
      setError('Hãy chọn tuần.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const guides = form.guides.map((block) => ({
        ...block,
        value: block.value.trim(),
        imageValue: (block.imageValue || '').trim(),
        youtubeValue: (block.youtubeValue || '').trim(),
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
        monthDescription: form.monthDescription.trim(),
        weekDescription: form.weekDescription.trim(),
        tasksTitle: form.tasksTitle.trim(),
        outputsTitle: form.outputsTitle.trim(),
        guides,
        questions,
      }

      if (drawerMode === 'edit' && editingId) {
        await updateGuide(editingId, payload)
        await syncMonthDescription(
          payload.level,
          payload.month,
          payload.monthDescription,
          editingId,
        )
        message.success('Đã cập nhật nội dung.')
      } else {
        const id = await createGuide(payload)
        await syncMonthDescription(
          payload.level,
          payload.month,
          payload.monthDescription,
          id,
        )
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
      title: 'Nội dung',
      key: 'guides',
      render: (_, item) => {
        const tasks = getProofRequiredBlockIds(item.guides).length
        const outputs = blocksOfType(item.guides || [], 'output').length
        const keys = blocksOfType(item.guides || [], 'key').length
        return `${tasks} NV · ${outputs} Out · ${keys} Key`
      },
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

  const renderTaskEditor = () => (
    <div className="admin-guides">
      <div className="admin-guides__toolbar">
        <h2>Nhiệm vụ</h2>
        <div className="admin-guides__actions">
          <Button size="small" onClick={() => addBlock('task')}>
            + Nhiệm vụ
          </Button>
        </div>
      </div>

      <label className="admin-field">
        <span>Tiêu đề mục Nhiệm vụ</span>
        <input
          type="text"
          placeholder="Ví dụ: Nhiệm vụ tuần này..."
          value={form.tasksTitle}
          onChange={(e) =>
            setForm((p) => ({ ...p, tasksTitle: e.target.value }))
          }
        />
      </label>

      {taskBlocks.length === 0 ? (
        <div className="admin-page__empty">Chưa có nhiệm vụ.</div>
      ) : (
        <ul className="admin-guides__list">
          {taskBlocks.map((block, index) => (
            <li key={block.id} className="admin-guide-block">
              <div className="admin-guide-block__head">
                <strong>
                  {BLOCK_LABEL.task} #{index + 1}
                </strong>
                <Button
                  size="small"
                  danger
                  type="text"
                  onClick={() => removeBlock(block.id)}
                >
                  Xóa
                </Button>
              </div>

              <label className="admin-field">
                <span>Mô tả nhiệm vụ</span>
                <textarea
                  rows={3}
                  placeholder="Mô tả nhiệm vụ..."
                  value={block.value}
                  onChange={(e) =>
                    updateBlock(block.id, { value: e.target.value })
                  }
                />
              </label>

              <div className="admin-guide-block__demo">
                <span className="admin-guide-block__demo-title">
                  Demo minh họa (tuỳ chọn)
                </span>

                <div className="admin-guide-block__image">
                  <strong>Ảnh demo</strong>
                  <label className="admin-file">
                    <span>Chọn ảnh</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        void onPickTaskImage(
                          block.id,
                          e.target.files?.[0] || null,
                        )
                        e.target.value = ''
                      }}
                    />
                  </label>
                  <input
                    type="url"
                    placeholder="Hoặc dán link ảnh..."
                    value={
                      (block.imageValue || '').startsWith('data:')
                        ? ''
                        : block.imageValue || ''
                    }
                    onChange={(e) =>
                      updateBlock(block.id, { imageValue: e.target.value })
                    }
                  />
                  {block.imageValue ? (
                    <div className="admin-guide-block__preview-wrap">
                      <img
                        src={block.imageValue}
                        alt={`Ảnh demo nhiệm vụ ${index + 1}`}
                        className="admin-guide-block__preview"
                      />
                      <Button
                        size="small"
                        type="text"
                        danger
                        onClick={() =>
                          updateBlock(block.id, { imageValue: '' })
                        }
                      >
                        Xóa ảnh
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="admin-guide-block__yt">
                  <strong>Link YouTube demo</strong>
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={block.youtubeValue || ''}
                    onChange={(e) =>
                      updateBlock(block.id, { youtubeValue: e.target.value })
                    }
                  />
                  {block.youtubeValue ? (
                    <Button
                      size="small"
                      type="text"
                      danger
                      onClick={() =>
                        updateBlock(block.id, { youtubeValue: '' })
                      }
                    >
                      Xóa link YT
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  const renderOutputEditor = () => (
    <div className="admin-guides">
      <div className="admin-guides__toolbar">
        <h2>Yêu cầu đầu ra</h2>
        <div className="admin-guides__actions">
          <Button size="small" onClick={() => addBlock('output')}>
            + Đầu ra
          </Button>
        </div>
      </div>

      <label className="admin-field">
        <span>Tiêu đề mục Yêu cầu đầu ra</span>
        <input
          type="text"
          placeholder="Ví dụ: Sản phẩm cần nộp..."
          value={form.outputsTitle}
          onChange={(e) =>
            setForm((p) => ({ ...p, outputsTitle: e.target.value }))
          }
        />
      </label>

      {outputBlocks.length === 0 ? (
        <div className="admin-page__empty">Chưa có yêu cầu đầu ra.</div>
      ) : (
        <ul className="admin-guides__list">
          {outputBlocks.map((block, index) => (
            <li key={block.id} className="admin-guide-block">
              <div className="admin-guide-block__head">
                <strong>
                  {BLOCK_LABEL.output} #{index + 1}
                </strong>
                <Button
                  size="small"
                  danger
                  type="text"
                  onClick={() => removeBlock(block.id)}
                >
                  Xóa
                </Button>
              </div>
              <textarea
                rows={2}
                placeholder="Nội dung yêu cầu đầu ra..."
                value={block.value}
                onChange={(e) =>
                  updateBlock(block.id, { value: e.target.value })
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  const renderSimpleBlocksEditor = (
    type: 'key',
    title: string,
    placeholder: string,
  ) => {
    const list = keyBlocks
    return (
      <div className="admin-guides">
        <div className="admin-guides__toolbar">
          <h2>{title}</h2>
          <div className="admin-guides__actions">
            <Button size="small" onClick={() => addBlock(type)}>
              + {title}
            </Button>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="admin-page__empty">Chưa có {title.toLowerCase()}.</div>
        ) : (
          <ul className="admin-guides__list">
            {list.map((block, index) => (
              <li key={block.id} className="admin-guide-block">
                <div className="admin-guide-block__head">
                  <strong>
                    {BLOCK_LABEL[type]} #{index + 1}
                  </strong>
                  <Button
                    size="small"
                    danger
                    type="text"
                    onClick={() => removeBlock(block.id)}
                  >
                    Xóa
                  </Button>
                </div>
                <textarea
                  rows={2}
                  placeholder={placeholder}
                  value={block.value}
                  onChange={(e) =>
                    updateBlock(block.id, { value: e.target.value })
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

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
                <Button
                  size="small"
                  danger
                  type="text"
                  onClick={() => removeQuestion(q.id)}
                >
                  Xóa
                </Button>
              </div>

              <label className="admin-field">
                <span>Câu hỏi</span>
                <textarea
                  rows={2}
                  placeholder="Nhập đề bài..."
                  value={q.prompt}
                  onChange={(e) =>
                    updateQuestion(q.id, { prompt: e.target.value })
                  }
                />
              </label>

              {q.type === 'choice' ? (
                <div className="admin-choice-options">
                  <span className="admin-choice-options__label">
                    Đáp án (chọn đáp án đúng)
                  </span>
                  {(q.options || []).map((opt, oi) => (
                    <div
                      key={`${q.id}-opt-${oi}`}
                      className="admin-choice-options__row"
                    >
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={(q.correctIndex ?? 0) === oi}
                        onChange={() =>
                          updateQuestion(q.id, { correctIndex: oi })
                        }
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
                  <span>
                    {q.type === 'letters'
                      ? 'Đáp án (chữ cái / từ)'
                      : 'Đáp án ngắn'}
                  </span>
                  <input
                    type="text"
                    placeholder={
                      q.type === 'letters'
                        ? 'Ví dụ: APPLE hoặc A,P,P,L,E'
                        : 'Nhập đáp án đúng...'
                    }
                    value={q.answer}
                    onChange={(e) =>
                      updateQuestion(q.id, { answer: e.target.value })
                    }
                  />
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  const renderViewMedia = (block: GuideBlock, index: number) => (
    <>
      {block.imageValue ? (
        <img
          src={block.imageValue}
          alt={`Ảnh demo ${index + 1}`}
          className="admin-view-block__image"
        />
      ) : null}
      {block.youtubeValue
        ? (() => {
            const embed = youtubeEmbedUrl(block.youtubeValue)
            if (embed) {
              return (
                <div className="admin-view-block__video">
                  <iframe
                    src={embed}
                    title={`YouTube demo ${index + 1}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )
            }
            return (
              <p className="admin-view-block__text">{block.youtubeValue}</p>
            )
          })()
        : null}
    </>
  )

  const renderViewSection = (
    title: string,
    blocks: GuideBlock[],
    withMedia = false,
  ) => (
    <div className="admin-split__pane" style={{ marginBottom: 16 }}>
      <h3 className="admin-split__title">{title}</h3>
      {blocks.length === 0 ? (
        <div className="admin-page__empty">Chưa có.</div>
      ) : (
        <ol className="admin-view-list">
          {blocks.map((block, index) => (
            <li key={block.id} className="admin-view-block">
              <div className="admin-view-block__label">
                {BLOCK_LABEL[block.type] || block.type} #{index + 1}
              </div>
              <p className="admin-view-block__text">
                {block.value || <em>Trống</em>}
              </p>
              {withMedia ? renderViewMedia(block, index) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  )

  return (
    <section className="admin-page admin-content">
      <header className="admin-page__header admin-content__header">
        <div>
          <h1>Nội dung</h1>
          <p>Tháng → mô tả tháng → tuần → nhiệm vụ / output / key + câu hỏi.</p>
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
              <Button
                type="primary"
                loading={saving}
                onClick={() => void handleSave()}
              >
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
              <span>{(viewing.questions || []).length} câu hỏi</span>
            </div>

            {viewing.monthDescription ? (
              <div className="admin-view-desc">
                <h3 className="admin-split__title">Mô tả tháng</h3>
                <p className="admin-view-block__text">{viewing.monthDescription}</p>
              </div>
            ) : null}

            {viewing.weekDescription ? (
              <div className="admin-view-desc">
                <h3 className="admin-split__title">Mô tả tuần</h3>
                <p className="admin-view-block__text">{viewing.weekDescription}</p>
              </div>
            ) : null}

            {renderViewSection(
              viewing.tasksTitle?.trim()
                ? `Nhiệm vụ · ${viewing.tasksTitle}`
                : 'Nhiệm vụ',
              [
                ...blocksOfType(viewing.guides || [], 'task'),
                ...blocksOfType(viewing.guides || [], 'step'),
              ],
              true,
            )}
            {renderViewSection(
              viewing.outputsTitle?.trim()
                ? `Yêu cầu đầu ra · ${viewing.outputsTitle}`
                : 'Yêu cầu đầu ra',
              blocksOfType(viewing.guides || [], 'output'),
            )}
            {renderViewSection(
              'Key',
              blocksOfType(viewing.guides || [], 'key'),
            )}

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
                      <p className="admin-view-block__text">
                        {q.prompt || <em>Trống</em>}
                      </p>
                      {q.type === 'choice' ? (
                        <ul className="admin-view-choices">
                          {(q.options || []).map((opt, oi) => (
                            <li
                              key={`${q.id}-v-${oi}`}
                              className={
                                oi === q.correctIndex ? 'is-correct' : ''
                              }
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
        ) : null}

        {(drawerMode === 'create' || drawerMode === 'edit') && (
          <form
            className="admin-form admin-drawer-body"
            onSubmit={handleSave}
            id={formId}
          >
            <div className="admin-form__row">
              <label className="admin-field">
                <span>Cấp độ</span>
                <select
                  value={form.level}
                  onChange={(e) => onLevelChange(Number(e.target.value))}
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
                  value={form.month || ''}
                  onChange={(e) =>
                    onMonthChange(Number(e.target.value) || 0)
                  }
                >
                  <option value="">Chọn tháng...</option>
                  {MONTHS.map((n) => (
                    <option key={n} value={n}>
                      Tháng {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {monthSelected ? (
              <>
                <label className="admin-field">
                  <span>Mô tả tháng</span>
                  <textarea
                    rows={3}
                    placeholder="Giới thiệu / mô tả cho tháng này..."
                    value={form.monthDescription}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        monthDescription: e.target.value,
                      }))
                    }
                  />
                </label>

                <label className="admin-field">
                  <span>Tuần</span>
                  <select
                    value={form.week || ''}
                    onChange={(e) =>
                      onWeekChange(Number(e.target.value) || 0)
                    }
                  >
                    <option value="">Chọn tuần...</option>
                    {WEEKS.map((n) => (
                      <option key={n} value={n}>
                        Tuần {n}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}

            {monthSelected && weekSelected ? (
              <>
                <label className="admin-field">
                  <span>Mô tả tuần</span>
                  <textarea
                    rows={3}
                    placeholder="Mô tả cho tuần này..."
                    value={form.weekDescription}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        weekDescription: e.target.value,
                      }))
                    }
                  />
                </label>

                <div className="admin-split">
                  <div className="admin-split__pane">
                    {renderTaskEditor()}
                    {renderOutputEditor()}
                    {renderSimpleBlocksEditor('key', 'Key', 'Nội dung key...')}
                  </div>
                  <div className="admin-split__pane">
                    {renderQuestionsEditor()}
                  </div>
                </div>
              </>
            ) : null}

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
