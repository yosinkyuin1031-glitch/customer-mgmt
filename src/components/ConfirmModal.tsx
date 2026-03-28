'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Variant = 'danger' | 'warning' | 'info'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: Variant
  onConfirm: () => void
  onCancel: () => void
}

const VARIANT_CONFIG: Record<Variant, {
  icon: React.ReactNode
  buttonClass: string
}> = {
  danger: {
    icon: (
      <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
      </svg>
    ),
    buttonClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
  warning: {
    icon: (
      <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
      </svg>
    ),
    buttonClass: 'bg-yellow-600 hover:bg-yellow-700 text-white',
  },
  info: {
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
}

/** 確認モーダル（browser confirm() の代替） */
export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = '実行',
  cancelLabel = 'キャンセル',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const config = VARIANT_CONFIG[variant]

  useEffect(() => {
    if (!isOpen) return
    confirmRef.current?.focus()

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onConfirm, onCancel])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* モーダル本体 */}
      <div className="relative bg-white rounded-xl shadow-lg max-w-sm w-full mx-4 p-6">
        <div className="flex items-start gap-3">
          {/* アイコン */}
          <div className="shrink-0 mt-0.5">{config.icon}</div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-800">{title}</h3>
            <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{message}</p>
          </div>
        </div>
        {/* ボタン */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${config.buttonClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/** useConfirm: 簡単に確認モーダルを使えるフック */
export function useConfirm() {
  const [state, setState] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmLabel: string
    cancelLabel: string
    variant: Variant
    resolve: ((value: boolean) => void) | null
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: '実行',
    cancelLabel: 'キャンセル',
    variant: 'danger',
    resolve: null,
  })

  const confirm = useCallback(
    (options: {
      title: string
      message: string
      confirmLabel?: string
      cancelLabel?: string
      variant?: Variant
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({
          isOpen: true,
          title: options.title,
          message: options.message,
          confirmLabel: options.confirmLabel ?? '実行',
          cancelLabel: options.cancelLabel ?? 'キャンセル',
          variant: options.variant ?? 'danger',
          resolve,
        })
      })
    },
    [],
  )

  const handleConfirm = useCallback(() => {
    state.resolve?.(true)
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }))
  }, [state.resolve])

  const handleCancel = useCallback(() => {
    state.resolve?.(false)
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }))
  }, [state.resolve])

  const ConfirmDialog = (
    <ConfirmModal
      isOpen={state.isOpen}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { confirm, ConfirmDialog }
}
