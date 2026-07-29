import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type FormEvent,
  } from 'react'
  import { useNavigate } from 'react-router-dom'
  import { Drawer, message } from 'antd'
  import Button from '../../ui/button'
  import { useAuth } from '../../service/AuthGate'
  
  type CommunityComment = {
    id: string
    author: string
    content: string
    createdAt: number
  }
  
  type CommunityPost = {
    id: string
    author: string
    content: string
    image?: string
    createdAt: number
    liked: boolean
    likeCount: number
    comments: CommunityComment[]
  }
  
  const STORAGE_KEY = 'community_demo_posts_v1'
  
  function loadPosts(): CommunityPost[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as CommunityPost[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  
  function savePosts(posts: CommunityPost[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
  }
  
  function uid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }
  
  function timeAgo(ts: number) {
    const diff = Math.max(0, Date.now() - ts)
    const min = Math.floor(diff / 60000)
    if (min < 1) return 'Vừa xong'
    if (min < 60) return `${min} phút trước`
    const hour = Math.floor(min / 60)
    if (hour < 24) return `${hour} giờ trước`
    const day = Math.floor(hour / 24)
    return `${day} ngày trước`
  }
  
  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Không đọc được ảnh.'))
      reader.readAsDataURL(file)
    })
  }
  
  const CommunityPage = () => {
    const navigate = useNavigate()
    const { profile } = useAuth()
    const authorName = profile?.displayName || profile?.username || 'Ẩn danh'
  
    const [posts, setPosts] = useState<CommunityPost[]>([])
    const [content, setContent] = useState('')
    const [imageData, setImageData] = useState<string | null>(null)
    const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
    const [openComments, setOpenComments] = useState<Record<string, boolean>>({})
    const [isMobile, setIsMobile] = useState(false)
    const [composerOpen, setComposerOpen] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
  
    useEffect(() => {
      setPosts(loadPosts())
    }, [])
  
    useEffect(() => {
      if (posts.length > 0 || localStorage.getItem(STORAGE_KEY)) {
        savePosts(posts)
      }
    }, [posts])
  
    useEffect(() => {
      const mq = window.matchMedia('(max-width: 640px)')
      const sync = () => setIsMobile(mq.matches)
      sync()
      mq.addEventListener('change', sync)
      return () => mq.removeEventListener('change', sync)
    }, [])
  
    const sortedPosts = useMemo(
      () => [...posts].sort((a, b) => b.createdAt - a.createdAt),
      [posts],
    )
  
    const handlePickImage = async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const dataUrl = await readFileAsDataUrl(file)
        setImageData(dataUrl)
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Không đọc được ảnh.')
      } finally {
        e.target.value = ''
      }
    }
  
    const clearImage = () => {
      setImageData(null)
    }
  
    const resetComposer = () => {
      setContent('')
      setImageData(null)
    }
  
    const handleSubmitPost = (e: FormEvent) => {
      e.preventDefault()
      const trimmed = content.trim()
      if (!trimmed && !imageData) {
        message.warning('Nhập nội dung hoặc chọn ảnh trước khi đăng.')
        return
      }
      const newPost: CommunityPost = {
        id: uid(),
        author: authorName,
        content: trimmed,
        image: imageData || undefined,
        createdAt: Date.now(),
        liked: false,
        likeCount: 0,
        comments: [],
      }
      setPosts((prev) => [newPost, ...prev])
      resetComposer()
      setComposerOpen(false)
      message.success('Đã đăng bài.')
    }
  
    const toggleLike = (postId: string) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                liked: !p.liked,
                likeCount: p.liked ? p.likeCount - 1 : p.likeCount + 1,
              }
            : p,
        ),
      )
    }
  
    const toggleComments = (postId: string) => {
      setOpenComments((prev) => ({ ...prev, [postId]: !prev[postId] }))
    }
  
    const setCommentDraft = (postId: string, value: string) => {
      setCommentDrafts((prev) => ({ ...prev, [postId]: value }))
    }
  
    const submitComment = (postId: string) => {
      const draft = (commentDrafts[postId] || '').trim()
      if (!draft) return
      const newComment: CommunityComment = {
        id: uid(),
        author: authorName,
        content: draft,
        createdAt: Date.now(),
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p,
        ),
      )
      setCommentDraft(postId, '')
    }
  
    const deletePost = (postId: string) => {
      setPosts((prev) => prev.filter((p) => p.id !== postId))
    }
  
    const renderComposerForm = () => (
      <form className="community-composer" onSubmit={handleSubmitPost}>
        <div className="community-composer__head">
          <span className="community-composer__avatar">
            {authorName.charAt(0).toUpperCase()}
          </span>
          <span className="community-composer__name">{authorName}</span>
        </div>
  
        <textarea
          className="community-composer__input"
          placeholder="Bạn đang nghĩ gì?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
        />
  
        {imageData ? (
          <div className="community-composer__preview">
            <img src={imageData} alt="Ảnh xem trước" />
            <button
              type="button"
              className="community-composer__preview-remove"
              onClick={clearImage}
              aria-label="Bỏ ảnh"
            >
              ✕
            </button>
          </div>
        ) : null}
  
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => void handlePickImage(e)}
          hidden
        />
  
        <div className="community-composer__actions">
          <Button
            className="btn-wood btn-wood--compact community-composer__image-btn"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            Thêm ảnh
          </Button>
          <Button
            className="btn-wood btn-wood--compact community-composer__submit"
            type="submit"
          >
            Đăng bài
          </Button>
        </div>
      </form>
    )
  
    const renderPost = (post: CommunityPost) => (
      <article className="community-card" key={post.id}>
        <div className="community-card__head">
          <span className="community-card__avatar">
            {post.author.charAt(0).toUpperCase()}
          </span>
          <div className="community-card__meta">
            <strong>{post.author}</strong>
            <span>{timeAgo(post.createdAt)}</span>
          </div>
          <button
            type="button"
            className="community-card__delete"
            onClick={() => deletePost(post.id)}
            aria-label="Xoá bài"
            title="Xoá bài"
          >
            ✕
          </button>
        </div>
  
        {post.content ? (
          <p className="community-card__content">{post.content}</p>
        ) : null}
  
        {post.image ? (
          <div className="community-card__image">
            <img src={post.image} alt="" />
          </div>
        ) : null}
  
        <div className="community-card__actions">
          <button
            type="button"
            className={`community-card__like${post.liked ? ' is-liked' : ''}`}
            onClick={() => toggleLike(post.id)}
          >
            <span aria-hidden>{post.liked ? '♥' : '♡'}</span>
            {post.likeCount > 0 ? post.likeCount : 'Thích'}
          </button>
          <button
            type="button"
            className="community-card__comment-toggle"
            onClick={() => toggleComments(post.id)}
          >
            💬 {post.comments.length > 0 ? post.comments.length : 'Bình luận'}
          </button>
        </div>
  
        {openComments[post.id] ? (
          <div className="community-comments">
            {post.comments.length === 0 ? (
              <p className="community-comments__empty">Chưa có bình luận nào.</p>
            ) : (
              post.comments.map((c) => (
                <div className="community-comments__item" key={c.id}>
                  <span className="community-comments__avatar">
                    {c.author.charAt(0).toUpperCase()}
                  </span>
                  <div className="community-comments__bubble">
                    <strong>{c.author}</strong>
                    <p>{c.content}</p>
                  </div>
                </div>
              ))
            )}
  
            <div className="community-comments__form">
              <input
                type="text"
                placeholder="Viết bình luận..."
                value={commentDrafts[post.id] || ''}
                onChange={(e) => setCommentDraft(post.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitComment(post.id)
                }}
              />
              <Button
                className="btn-wood btn-wood--compact community-comments__send"
                type="button"
                onClick={() => submitComment(post.id)}
                aria-label="Gửi bình luận"
              >
                Gửi
              </Button>
            </div>
          </div>
        ) : null}
      </article>
    )
  
    return (
      <section className="community-page">
        <div className="community-page__topbar">
          <Button
            className="btn-wood btn-wood--compact community-page__back"
            type="button"
            onClick={() => navigate('/')}
          >
            Quay lại
          </Button>
        </div>
  
        <div className="community-page__content">
          {!isMobile ? (
            <div className="community-page__left">{renderComposerForm()}</div>
          ) : null}
  
          <div className="community-page__right">
            <div className="community-feed">
              {sortedPosts.length === 0 ? (
                <div className="community-feed__empty">
                  Chưa có bài đăng nào. Hãy là người đầu tiên!
                </div>
              ) : (
                sortedPosts.map(renderPost)
              )}
            </div>
          </div>
        </div>
  
        {isMobile ? (
          <Button
            className="btn-wood btn-wood--compact community-page__fab"
            type="button"
            onClick={() => setComposerOpen(true)}
            aria-label="Đăng bài mới"
          >
            +
          </Button>
        ) : null}
  
        <Drawer
          title="Đăng bài mới"
          placement="bottom"
          height="auto"
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          destroyOnHidden
          className="community-composer-drawer"
        >
          {renderComposerForm()}
        </Drawer>
      </section>
    )
  }
  
  export default CommunityPage