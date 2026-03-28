'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function StatsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[StatsError]', error)
  }, [error])

  return (
    <div className="px-4 py-8 max-w-lg mx-auto">
      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-purple-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">統計データの読み込みに失敗しました</h2>
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
