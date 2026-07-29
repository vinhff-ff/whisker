import { useEffect, useRef, useState } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MessageFilled } from '@ant-design/icons'
import { buildWhiskerSystemPrompt } from '../../data/whiskerSite'
import Button from '../../ui/button'
import Mouse from '../../assets/mouse.png'
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
]

type ChatMessage = {
  id: number
  text: string
  sender: 'bot' | 'user'
}

type ChatSession = {
  chat: {
    sendMessage: (text: string) => Promise<{ response: { text: () => string } }>
  }
  modelName: string
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 1,
  text: 'Xin chào nhà thám hiểm! Mình là Whisker — chuột hamster đội mũ thám hiểm. Hỏi mình về bản đồ, cộng đồng, vòng quay hay cách chơi quiz nhé!',
  sender: 'bot',
}

const QUICK_PROMPTS = [
  'Tuần này làm nhiệm vụ gì?',
  'Cách mở khóa tuần trên bản đồ?',
  'Vòng quay dùng điểm thế nào?',
  'Đăng bài ở cộng đồng ra sao?',
]

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatSession = useRef<ChatSession | null>(null)
  const genAI = useRef<GoogleGenerativeAI | null>(null)

  useEffect(() => {
    const apiKey = String(import.meta.env.VITE_GEMINI_API_KEY || '').trim()
    if (!apiKey) {
      setReady(false)
      return
    }
    genAI.current = new GoogleGenerativeAI(apiKey)
    setReady(true)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const createChatSession = async () => {
    if (!genAI.current) return null

    const systemInstruction = buildWhiskerSystemPrompt()
    let lastError: unknown

    for (const modelName of GEMINI_MODELS) {
      try {
        const model = genAI.current.getGenerativeModel({
          model: modelName,
          systemInstruction,
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1024,
          },
        })
        const chat = model.startChat({ history: [] })
        chatSession.current = { chat, modelName }
        return chatSession.current
      } catch (err) {
        lastError = err
      }
    }

    throw lastError || new Error('Không khởi tạo được model Gemini')
  }

  const sendToGemini = async (userText: string) => {
    let session = chatSession.current
    if (!session) {
      session = await createChatSession()
    }
    if (!session || !genAI.current) {
      throw new Error('Chưa sẵn sàng chat')
    }

    try {
      const result = await session.chat.sendMessage(userText)
      return result.response.text()
    } catch (firstError) {
      const failedModel = session.modelName
      const remaining = GEMINI_MODELS.filter((m) => m !== failedModel)
      let lastError: unknown = firstError

      for (const modelName of remaining) {
        try {
          const model = genAI.current.getGenerativeModel({
            model: modelName,
            systemInstruction: buildWhiskerSystemPrompt(),
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 1024,
            },
          })
          const chat = model.startChat({ history: [] })
          const recent = messages
            .slice(-6)
            .map((m) => `${m.sender === 'user' ? 'Học sinh' : 'Whisker'}: ${m.text}`)
            .join('\n')
          const prompt = recent
            ? `Ngữ cảnh hội thoại trước:\n${recent}\n\nCâu hỏi mới của học sinh: ${userText}`
            : userText
          const result = await chat.sendMessage(prompt)
          chatSession.current = { chat, modelName }
          return result.response.text()
        } catch (err) {
          lastError = err
        }
      }

      throw lastError
    }
  }

  const handleSendMessage = async (presetText?: string) => {
    const text = (presetText ?? inputValue).trim()
    if (!text || loading) return

    const userMessage: ChatMessage = {
      id: Date.now(),
      text,
      sender: 'user',
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setLoading(true)

    try {
      if (!ready || !genAI.current) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text: 'Chưa cấu hình Gemini API key. Thêm VITE_GEMINI_API_KEY vào file .env rồi chạy lại npm run dev nhé!',
            sender: 'bot',
          },
        ])
        return
      }

      const reply = await sendToGemini(text)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: reply || 'Whisker đang suy nghĩ… thử hỏi lại một lần nữa nhé!',
          sender: 'bot',
        },
      ])
    } catch (error) {
      console.error('Gemini error:', error)
      const msg = error instanceof Error ? error.message : 'Không thể kết nối Gemini'
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: `Whisker gặp sự cố: ${msg}. Kiểm tra API key và mạng internet giúp mình nhé!`,
          sender: 'bot',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSendMessage()
    }
  }

  return (
    <>
      <button
        className="chatbot-button"
        onClick={() => setIsOpen((v) => !v)}
        title="Chat với Whisker"
        type="button"
        aria-label="Mở chat Whisker"
      >
        <MessageFilled style={{ fontSize: 24 , color: '#6b3410' }} />
      </button>

      {isOpen ? (
        <div className="chatbot-window" role="dialog" aria-label="Chatbot Whisker">
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <img src={Mouse} alt="" className="chatbot-avatar" />
              <div>
                <h3>Whisker</h3>
                <span className="chatbot-status">
                  {ready ? 'Sẵn sàng thám hiểm' : 'Thiếu API key'}
                </span>
              </div>
            </div>
            <button
              className="chatbot-close"
              onClick={() => setIsOpen(false)}
              type="button"
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`message message-${msg.sender}`}>
                {msg.text}
              </div>
            ))}
            {loading ? (
              <div className="message message-bot loading" aria-label="Đang trả lời">
                <span />
                <span />
                <span />
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot-quick">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={loading}
                onClick={() => void handleSendMessage(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="chatbot-input-area">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Hỏi Whisker bất cứ điều gì..."
              disabled={loading}
              rows={2}
            />
            <Button
              className="btn-wood btn-wood--compact chatbot-send"
              type="button"
              disabled={!inputValue.trim() || loading}
              onClick={() => void handleSendMessage()}
              aria-label="Gửi"
            >
              {loading ? '...' : 'Gửi'}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default Chatbot
