'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function MasterError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[MasterError]', error)
  }, [error])

  return (
    <div className="px-4 py-8 max-w-lg mx-auto">
      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">マスタデータの読み込みに失敗しました</h2>
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
