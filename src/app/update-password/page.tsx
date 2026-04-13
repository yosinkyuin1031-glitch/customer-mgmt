'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)
  const [noSession, setNoSession] = useState(false)

  useEffect(() => {
    let settled = false

    // 1. Listen for auth events (PASSWORD_RECOVERY from hash fragment / implicit flow)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        settled = true
        setReady(true)
        setNoSession(false)
      }
    })

    // 2. Check if already authenticated (e.g. via PKCE code exchange in /auth/callback)
    const checkSession = async () => {
      // Small delay to allow onAuthStateChange to fire first for hash fragments
      await new Promise(r => setTimeout(r, 1000))
      if (settled) return

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setReady(true)
      } else {
        setNoSession(true)
      }
    }

    checkSession()

    return () => subscription.unsubscribe()
  }, [])

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
      setError('パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。もう一度リセットメールを送信してください。')
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #14252A 0%, #1a3a42 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">パスワード変更</h1>
          <p className="text-gray-300 text-sm mt-1">新しいパスワードを設定してください</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          {success ? (
            <div className="text-center space-y-4">
              <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg">
                パスワードを変更しました。新しいパスワードでログインしてください。
              </div>
              <Link
                href="/login"
                className="block w-full py-3 rounded-xl text-white font-bold text-sm text-center transition-all"
                style={{ background: '#14252A' }}
              >
                ログインへ
              </Link>
            </div>
          ) : noSession ? (
            <div className="text-center space-y-4">
              <div className="bg-yellow-50 text-yellow-700 text-sm p-3 rounded-lg">
                リンクの有効期限が切れて��るか、無効なリンクです。もう一度リセットメールを送信してください。
              </div>
              <Link
                href="/reset-password"
                className="block w-full py-3 rounded-xl text-white font-bold text-sm text-center transition-all"
                style={{ background: '#14252A' }}
              >
                パスワードリセットへ
              </Link>
            </div>
          ) : !ready ? (
            <div className="text-center py-8">
              <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-[#14252A] rounded-full animate-spin" />
              <p className="text-sm text-gray-500 mt-3">認証を確認中...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
          )}
        </div>
      </div>
    </div>
  )
}
