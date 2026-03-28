'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function SalesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[SalesError]', error)
  }, [error])

  return (
    <div className="px-4 py-8 max-w-lg mx-auto">
      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">売上データの読み込みに失敗しました</h2>
        <p className="text-sm text-gray-500 mb-6">通信状態を確認して再試行してください。</p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 text-white rounded-lg px-4 py-2.5 text-sm font-bold shadow-sm hover:opacity-90"
            style={{ background: '#14252A' }}
          >
            再試行
          </button>
          <Link
            href="/"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 text-center"
          >
            ホームに戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
