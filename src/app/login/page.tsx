'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません')
      setLoading(false)
    } else {
      window.location.href = '/'
    }
  }

  const handleDemoLogin = async () => {
    setDemoLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email: 'demo@clinicapps.jp',
      password: 'demo1234',
    })

    if (error) {
      setError('デモアカウントへのログインに失敗しました。しばらくしてからお試しください。')
      setDemoLoading(false)
      return
    }

    // デモデータ生成APIを呼ぶ
    try {
      await fetch('/api/demo/seed', { method: 'POST' })
    } catch {
      // シード失敗してもログイン自体は続行
    }

    window.location.href = '/'
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('demo') === 'true') {
      handleDemoLogin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #14252A 0%, #1a3a42 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">顧客管理シート</h1>
          <p className="text-gray-300 text-sm mt-1">治療院向け顧客管理システム</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A] focus:border-transparent"
              placeholder="パスワードを入力"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-50"
            style={{ background: '#14252A' }}
          >
            {loading ? 'ログイン中...' : 'サインイン'}
          </button>

          <p className="text-center text-sm text-gray-500 mt-2">
            アカウントをお持ちでない方は{' '}
            <Link href="/signup" className="text-blue-600 font-medium hover:underline">
              アカウントを作成
            </Link>
          </p>

          <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '24px', paddingTop: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>デモ体験はこちら</p>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={demoLoading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
              style={{ backgroundColor: '#0ea5e9' }}
            >
              {demoLoading ? 'デモログイン中...' : 'デモアカウントでログイン'}
            </button>
          </div>
        </form>

        <div className="flex justify-center gap-4 mt-4 text-xs text-gray-400">
          <Link href="/terms" className="hover:text-gray-200 transition-colors">
            利用規約
          </Link>
          <span>|</span>
          <Link href="/privacy" className="hover:text-gray-200 transition-colors">
            プライバシーポリシー
          </Link>
        </div>
      </div>
    </div>
  )
}
