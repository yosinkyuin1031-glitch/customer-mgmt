'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function PatientsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[PatientsError]', error)
  }, [error])

  return (
    <div className="px-4 py-8 max-w-lg mx-auto">
      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">患者データの読み込みに失敗しました</h2>
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
