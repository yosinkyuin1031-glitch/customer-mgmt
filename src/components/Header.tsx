'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function Header({ title }: { title: string }) {
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    const checkDemo = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email?.startsWith('demo@')) {
        setIsDemo(true)
      }
    }
    checkDemo()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <>
      {isDemo && (
        <div className="bg-amber-500 text-white text-center text-xs py-2 px-4 font-bold">
          デモモードで閲覧中 — 本番利用は<a href="/signup" className="underline ml-1">アカウント登録</a>してください
        </div>
      )}
      <header className="sticky top-0 z-40 text-white px-4 py-3 flex justify-between items-center" style={{ background: '#14252A' }}>
        <h1 className="text-lg font-bold">{title}</h1>
        <button onClick={handleLogout} className="text-xs text-gray-300 hover:text-white">
          ログアウト
        </button>
      </header>
    </>
  )
}
