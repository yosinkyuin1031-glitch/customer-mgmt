'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[RootError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">エラーが発生しました</h1>
        <p className="text-sm text-gray-500 mb-1">
          予期しないエラーが発生しました。
        </p>
        <p className="text-sm text-gray-500 mb-6">
          エラーが発生しました。ページを再読み込みしてください。
        </p>
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
