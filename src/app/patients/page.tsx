'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import type { Patient } from '@/lib/types'

export default function PatientsPage() {
  const supabase = createClient()
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      let query = supabase.from('cm_patients').select('*').order('updated_at', { ascending: false })
      if (statusFilter) query = query.eq('status', statusFilter)
      const { data } = await query
      setPatients(data || [])
      setLoading(false)
    }
    load()
  }, [statusFilter])

  const filtered = search
    ? patients.filter(p =>
        p.name.includes(search) ||
        p.furigana?.includes(search) ||
        p.phone?.includes(search) ||
        p.chief_complaint?.includes(search)
      )
    : patients

  return (
    <AppShell>
      <Header title="患者一覧" />
      <div className="px-4 py-4 max-w-lg mx-auto">
        <Link href="/patients/new" className="block w-full text-white rounded-xl p-3 text-center font-bold text-sm mb-4" style={{ background: '#14252A' }}>
          + 新規患者登録
        </Link>

        {/* 検索・フィルタ */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="名前・電話・主訴で検索"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">全て</option>
            <option value="active">通院中</option>
            <option value="inactive">休止</option>
            <option value="completed">卒業</option>
          </select>
        </div>

        <p className="text-xs text-gray-500 mb-2">{filtered.length}件</p>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-400 text-center py-8">患者が見つかりません</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => (
              <Link key={p.id} href={`/patients/${p.id}`} className="block bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-800">{p.name}</p>
                    {p.furigana && <p className="text-xs text-gray-400">{p.furigana}</p>}
                    <p className="text-xs text-gray-500 mt-1">{p.chief_complaint}</p>
                    {p.phone && <p className="text-xs text-gray-400 mt-0.5">TEL: {p.phone}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      p.status === 'active' ? 'bg-green-100 text-green-700' :
                      p.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {p.status === 'active' ? '通院中' : p.status === 'completed' ? '卒業' : '休止'}
                    </span>
                    {p.referral_source && (
                      <span className="text-xs text-gray-400">{p.referral_source}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
