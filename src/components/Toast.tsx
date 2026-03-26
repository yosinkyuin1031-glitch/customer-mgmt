'use client'

import { useEffect, useState } from 'react'
import { useToast, type Toast as ToastItem } from '@/lib/toast'

const TOAST_STYLES = {
  success: {
    bg: 'bg-green-50 border-green-400',
    icon: (
      <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    text: 'text-green-800',
  },
  error: {
    bg: 'bg-red-50 border-red-400',
    icon: (
      <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    text: 'text-red-800',
  },
  warning: {
    bg: 'bg-yellow-50 border-yellow-400',
    icon: (
      <svg className="w-5 h-5 text-yellow-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
      </svg>
    ),
    text: 'text-yellow-800',
  },
  info: {
    bg: 'bg-blue-50 border-blue-400',
    icon: (
      <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    text: 'text-blue-800',
  },
}

function ToastItem({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const style = TOAST_STYLES[toast.type]

  useEffect(() => {
    // フェードイン
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    // 2.5秒後にフェードアウト開始（合計3秒で削除）
    const t = setTimeout(() => setExiting(true), 2500)
    return () => clearTimeout(t)
  }, [])

  const handleClose = () => {
    setExiting(true)
    setTimeout(onClose, 300)
  }

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm w-full transition-all duration-300 ${style.bg} ${
        visible && !exiting ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
      }`}
      style={{ borderLeftWidth: '4px', borderLeftColor: '#14252A' }}
    >
      {style.icon}
      <p className={`text-sm font-medium flex-1 whitespace-pre-wrap ${style.text}`}>
        {toast.message}
      </p>
      <button
        onClick={handleClose}
        className="text-gray-400 hover:text-gray-600 shrink-0 -mt-0.5"
        aria-label="閉じる"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 items-end">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}
