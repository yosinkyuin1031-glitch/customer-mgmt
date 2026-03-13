'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setEmail(user.email || '')
    }
    load()
  }, [])

  return (
    <AppShell>
      <Header title="設定" />
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-bold text-gray-800 text-sm mb-3">アカウント情報</h3>
          <p className="text-sm text-gray-600">ログイン: {email}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-bold text-gray-800 text-sm mb-3">院情報</h3>
          <div className="space-y-1 text-sm text-gray-600">
            <p>大口神経整体院</p>
            <p>大阪市住吉区長居</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-bold text-gray-800 text-sm mb-3">データ</h3>
          <p className="text-xs text-gray-400">患者データ・施術記録はSupabaseに安全に保存されています。</p>
        </div>
      </div>
    </AppShell>
  )
}
