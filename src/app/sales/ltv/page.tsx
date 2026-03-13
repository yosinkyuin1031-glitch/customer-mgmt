'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { saleTabs } from '@/lib/saleTabs'
import type { Patient } from '@/lib/types'

export default function LtvPage() {
  const supabase = createClient()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<'ltv' | 'visit_count' | 'days'>('ltv')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('cm_patients')
        .select('*')
        .gt('visit_count', 0)
        .order('ltv', { ascending: false })
      setPatients(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const sorted = [...patients].sort((a, b) => {
    if (sortKey === 'ltv') return (b.ltv || 0) - (a.ltv || 0)
    if (sortKey === 'visit_count') return (b.visit_count || 0) - (a.visit_count || 0)
    const aDays = a.first_visit_date && a.last_visit_date
      ? Math.max(1, Math.round((new Date(a.last_visit_date).getTime() - new Date(a.first_visit_date).getTime()) / (30 * 24 * 60 * 60 * 1000)))
      : 0
    const bDays = b.first_visit_date && b.last_visit_date
      ? Math.max(1, Math.round((new Date(b.last_visit_date).getTime() - new Date(b.first_visit_date).getTime()) / (30 * 24 * 60 * 60 * 1000)))
      : 0
    return bDays - aDays
  })

  const totalLTV = patients.reduce((sum, p) => sum + (p.ltv || 0), 0)
  const avgLTV = patients.length > 0 ? Math.round(totalLTV / patients.length) : 0

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2 border-b">
          {saleTabs.map(tab => (
            <Link key={tab.href} href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                tab.href === '/sales/ltv' ? 'bg-[#14252A] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}>{tab.label}</Link>
          ))}
        </div>

        <h2 className="font-bold text-gray-800 text-lg mb-4">LTV（顧客生涯価値）分析</h2>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold" style={{ color: '#14252A' }}>{avgLTV.toLocaleString()}<span className="text-xs sm:text-sm">円</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">平均LTV</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-blue-600">{patients.length}<span className="text-xs sm:text-sm">人</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">対象患者数</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-green-600">{totalLTV.toLocaleString()}<span className="text-xs sm:text-sm">円</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">総LTV</p>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <span className="text-xs text-gray-500 pt-1">並び替え:</span>
          {[
            { key: 'ltv' as const, label: '総売上' },
            { key: 'visit_count' as const, label: '来院数' },
            { key: 'days' as const, label: '通院期間' },
          ].map(s => (
            <button key={s.key} onClick={() => setSortKey(s.key)}
              className={`px-3 py-1 rounded text-xs ${sortKey === s.key ? 'bg-[#14252A] text-white' : 'bg-gray-100 text-gray-600'}`}
            >{s.label}</button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : (
          <>
          <div className="sm:hidden space-y-2">
            {sorted.map((p, i) => (
              <Link key={p.id} href={`/patients/${p.id}`} className="block bg-white rounded-xl shadow-sm p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs text-gray-400 mr-1">#{i + 1}</span>
                    <span className="font-medium text-sm text-blue-600">{p.name}</span>
                  </div>
                  <p className="font-bold text-sm" style={{ color: '#14252A' }}>{(p.ltv || 0).toLocaleString()}円</p>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  <span>{p.visit_count || 0}回</span>
                  <span>平均{p.visit_count ? Math.round((p.ltv || 0) / p.visit_count).toLocaleString() : 0}円</span>
                  {p.first_visit_date && <span>{p.first_visit_date}〜</span>}
                </div>
              </Link>
            ))}
          </div>

          <div className="hidden sm:block bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 text-xs text-gray-500">#</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500">患者名</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">来院数</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">総売上</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">平均単価</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500">初回</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500">最終</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">経過</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/patients/${p.id}`} className="text-blue-600 hover:underline">{p.name}</Link>
                    </td>
                    <td className="px-3 py-2 text-right">{p.visit_count || 0}回</td>
                    <td className="px-3 py-2 text-right font-medium">{(p.ltv || 0).toLocaleString()}円</td>
                    <td className="px-3 py-2 text-right">{p.visit_count ? Math.round((p.ltv || 0) / p.visit_count).toLocaleString() : 0}円</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{p.first_visit_date || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{p.last_visit_date || '-'}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {p.days_since_last_visit !== null && p.days_since_last_visit !== undefined ? `${p.days_since_last_visit}日` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
