// Driver Portal — Phản hồi & Khiếu nại (optional, đơn giản)
import { useState, useRef } from 'react'
import {
  MessageSquare, Send, CheckCircle, Clock,
  AlertCircle, Upload, X, History, ChevronRight,
} from 'lucide-react'

// ─── Types & Constants ────────────────────────────────────────────────────────
type IssueType = 'wrong_fee' | 'lost_ticket' | 'slot_taken' | 'hard_to_find' | 'other'

interface Ticket {
  code:        string
  type:        IssueType
  typeLabel:   string
  date:        string
  status:      'processing' | 'resolved'
  description: string
}

const ISSUE_OPTS: { val: IssueType; label: string }[] = [
  { val: 'wrong_fee',    label: 'Sai phí'          },
  { val: 'lost_ticket',  label: 'Mất thẻ QR'       },
  { val: 'slot_taken',   label: 'Slot bị chiếm'    },
  { val: 'hard_to_find', label: 'Khó tìm xe'       },
  { val: 'other',        label: 'Khác'              },
]

const MOCK_TICKETS: Ticket[] = [
  {
    code: 'TK-A3F9K', type: 'wrong_fee', typeLabel: 'Sai phí',
    date: '2026-05-28', status: 'resolved',
    description: 'Bị tính giá cao điểm lúc 14:00, trong khi đây là giờ bình thường.',
  },
  {
    code: 'TK-B7X2P', type: 'lost_ticket', typeLabel: 'Mất thẻ QR',
    date: '2026-05-25', status: 'processing',
    description: 'Mất vé QR khi rời xe, nhờ hỗ trợ ra cổng.',
  },
  {
    code: 'TK-C5M8Q', type: 'slot_taken', typeLabel: 'Slot bị chiếm',
    date: '2026-05-20', status: 'resolved',
    description: 'Xe khác đỗ vào slot A-07 mặc dù tôi đã đặt trước hợp lệ.',
  },
]

function fmt(n: number) { return new Intl.NumberFormat('vi-VN').format(n) + ' ₫' }
function genCode()       { return `TK-${Math.random().toString(36).slice(2, 7).toUpperCase()}` }

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DriverFeedback() {
  const [tab,  setTab]  = useState<'form' | 'history'>('form')
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Form state ─────────────────────────────────────────────────────────────
  const [issueType,     setIssueType]     = useState<IssueType>('wrong_fee')
  const [sessionId,     setSessionId]     = useState('')
  const [wrongAmount,   setWrongAmount]   = useState('')
  const [correctAmount, setCorrectAmount] = useState('')
  const [description,   setDescription]  = useState('')
  const [phone,         setPhone]         = useState('')
  const [email,         setEmail]         = useState('')
  const [previewUrl,    setPreviewUrl]    = useState<string | null>(null)
  const [submitted,     setSubmitted]     = useState(false)
  const [ticketCode,    setTicketCode]    = useState('')
  const [tickets,       setTickets]       = useState<Ticket[]>(MOCK_TICKETS)
  const [submitting,    setSubmitting]    = useState(false)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewUrl(URL.createObjectURL(file))
  }

  function clearImage() {
    setPreviewUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit() {
    if (!description.trim()) return
    setSubmitting(true)
    // Giả lập delay gửi
    await new Promise((r) => setTimeout(r, 800))

    const code = genCode()
    const issueLabel = ISSUE_OPTS.find((o) => o.val === issueType)?.label ?? issueType

    setTickets((prev) => [
      {
        code,
        type:        issueType,
        typeLabel:   issueLabel,
        date:        new Date().toISOString().slice(0, 10),
        status:      'processing',
        description: description.trim(),
      },
      ...prev,
    ])

    setTicketCode(code)
    setSubmitted(true)
    setSubmitting(false)
  }

  function handleReset() {
    setSubmitted(false); setTicketCode('')
    setIssueType('wrong_fee'); setSessionId(''); setWrongAmount('')
    setCorrectAmount(''); setDescription(''); setPhone(''); setEmail('')
    clearImage()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-5 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-500" />
          Phản hồi &amp; Khiếu nại
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Gửi phản hồi, chúng tôi xử lý trong 24 giờ
        </p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {([
          { id: 'form',    label: 'Gửi phản hồi',   icon: Send    },
          { id: 'history', label: 'Lịch sử',         icon: History },
        ] as { id: 'form' | 'history'; label: string; icon: React.ElementType }[]).map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {t.id === 'history' && (
                <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                  {tickets.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── TAB: Gửi phản hồi ─────────────────────────────────────────────── */}
      {tab === 'form' && (
        <>
          {submitted ? (
            // Success state
            <div className="bg-white rounded-2xl border-2 border-green-200 shadow-sm p-8 text-center space-y-3">
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
              <h3 className="font-bold text-green-700 text-lg">Đã ghi nhận phản hồi!</h3>
              <p className="text-sm text-gray-500">
                Mã ticket của bạn:
              </p>
              <p className="font-mono font-bold text-2xl text-gray-800 tracking-widest">
                {ticketCode}
              </p>
              <p className="text-xs text-gray-400">
                Chúng tôi sẽ liên hệ trong vòng 24 giờ. Theo dõi tại tab "Lịch sử".
              </p>
              <div className="flex gap-2 justify-center mt-4">
                <button
                  onClick={() => { setTab('history') }}
                  className="text-sm text-blue-600 border border-blue-200 rounded-lg px-4 py-2 hover:bg-blue-50 transition-colors flex items-center gap-1"
                >
                  Xem lịch sử <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleReset}
                  className="text-sm text-gray-600 underline"
                >
                  Gửi phản hồi khác
                </button>
              </div>
            </div>
          ) : (
            // Form
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              {/* Issue type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Loại vấn đề <span className="text-red-400">*</span>
                </label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value as IssueType)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                >
                  {ISSUE_OPTS.map((o) => (
                    <option key={o.val} value={o.val}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Conditional: Sai phí */}
              {issueType === 'wrong_fee' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Thông tin sai phí
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Session ID / Mã vé (nếu nhớ)
                    </label>
                    <input
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="VD: sess-mock-004"
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Số tiền bị tính (₫)
                      </label>
                      <input
                        type="number"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="VD: 16000"
                        value={wrongAmount}
                        onChange={(e) => setWrongAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Số tiền đúng (₫)
                      </label>
                      <input
                        type="number"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="VD: 10000"
                        value={correctAmount}
                        onChange={(e) => setCorrectAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  {wrongAmount && correctAmount && Number(wrongAmount) > Number(correctAmount) && (
                    <p className="text-xs text-amber-600">
                      Chênh lệch: <strong>{fmt(Number(wrongAmount) - Number(correctAmount))}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Mô tả chi tiết <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={4}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  placeholder="Mô tả vấn đề bạn gặp phải, thời gian xảy ra, slot liên quan..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{description.length} ký tự</p>
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Ảnh minh chứng (không bắt buộc)
                </label>
                {previewUrl ? (
                  <div className="relative inline-block">
                    <img
                      src={previewUrl}
                      alt="preview"
                      className="w-32 h-32 object-cover rounded-xl border border-gray-200"
                    />
                    <button
                      onClick={clearImage}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-xl px-5 py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Chọn ảnh (JPEG, PNG)
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">SĐT liên hệ</label>
                  <input
                    type="tel"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="0901 234 567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!description.trim() || submitting}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Đang gửi...
                  </span>
                ) : (
                  <><Send className="w-4 h-4" /> Gửi phản hồi</>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── TAB: Lịch sử ─────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center text-gray-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Chưa có phản hồi nào</p>
            </div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.code}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-gray-800">{t.code}</span>
                    <span className="ml-2 text-sm text-gray-500">{t.typeLabel}</span>
                  </div>
                  <span
                    className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${
                      t.status === 'resolved'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {t.status === 'resolved' ? (
                      <><CheckCircle className="w-3 h-3" /> Đã giải quyết</>
                    ) : (
                      <><Clock className="w-3 h-3" /> Đang xử lý</>
                    )}
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">{t.description}</p>
                <p className="text-xs text-gray-400">
                  Ngày gửi: {new Date(t.date).toLocaleDateString('vi-VN', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                  })}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
