'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください。')
      return
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません。')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。')
      setLoading(false)
    } else {
      window.location.href = '/login'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #14252A 0%, #1a3a42 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">パスワード変更</h1>
          <p className="text-gray-300 text-sm mt-1">新しいパスワードを設定してください</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A] focus:border-transparent"
              placeholder="6文字以上で入力"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード確認</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A] focus:border-transparent"
              placeholder="もう一度入力"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-50"
            style={{ background: '#14252A' }}
          >
            {loading ? '更新中...' : 'パスワードを変更'}
          </button>

          <p className="text-center text-sm text-gray-500 mt-2">
            <Link href="/login" className="text-blue-600 font-medium hover:underline">
              ログインに戻る
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
