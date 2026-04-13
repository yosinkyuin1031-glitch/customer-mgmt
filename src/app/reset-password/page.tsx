'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://customer-mgmt.vercel.app'
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/update-password`,
    })

    if (error) {
      setError('リセットメールの送信に失敗しました。メールアドレスをご確認ください。')
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #14252A 0%, #1a3a42 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">パスワードリセット</h1>
          <p className="text-gray-300 text-sm mt-1">登録メールアドレスを入力してください</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg">
                パスワードリセットメールを送信しました。メールをご確認ください。
              </div>
              <Link
                href="/login"
                className="block w-full py-3 rounded-xl text-white font-bold text-sm text-center transition-all"
                style={{ background: '#14252A' }}
              >
                ログインに戻る
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A] focus:border-transparent"
                  placeholder="example@email.com"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-50"
                style={{ background: '#14252A' }}
              >
                {loading ? '送信中...' : 'リセットメールを送信'}
              </button>

              <p className="text-center text-sm text-gray-500 mt-2">
                <Link href="/login" className="text-blue-600 font-medium hover:underline">
                  ログインに戻る
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
