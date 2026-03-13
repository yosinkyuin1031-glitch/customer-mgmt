'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'

const saleTabs = [
  { href: '/sales', label: '概要' },
  { href: '/patients', label: '顧客管理' },
  { href: '/sales/revenue', label: '売上集計' },
  { href: '/sales/slips', label: '伝票一覧' },
  { href: '/sales/ltv', label: 'LTV' },
  { href: '/sales/repeat', label: 'リピート' },
  { href: '/sales/hourly', label: '時間単価' },
  { href: '/sales/utilization', label: '稼働率' },
  { href: '/sales/cross', label: 'クロス集計' },
]

interface PatientLTV {
  id: string
  name: string
  first_visit: string
  last_visit: string
  visit_count: number
  total_revenue: number
  avg_per_visit: number
  months_active: number
}

export default function LtvPage() {
  const supabase = createClient()
  const [ltvData, setLtvData] = useState<PatientLTV[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<'total_revenue' | 'visit_count' | 'months_active'>('total_revenue')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: patients } = await supabase.from('cm_patients').select('id, name')
      const { data: visits } = await supabase.from('cm_visit_records').select('patient_id, visit_date, payment_amount')

      if (!patients || !visits) { setLoading(false); return }

      const patientMap: Record<string, PatientLTV> = {}
      patients.forEach(p => {
        patientMap[p.id] = {
          id: p.id, name: p.name,
          first_visit: '', last_visit: '',
          visit_count: 0, total_revenue: 0, avg_per_visit: 0, months_active: 0,
        }
      })

      visits.forEach(v => {
        const p = patientMap[v.patient_id]
        if (!p) return
        p.visit_count++
        p.total_revenue += v.payment_amount || 0
        if (!p.first_visit || v.visit_date < p.first_visit) p.first_visit = v.visit_date
        if (!p.last_visit || v.visit_date > p.last_visit) p.last_visit = v.visit_date
      })

      const result = Object.values(patientMap).filter(p => p.visit_count > 0).map(p => {
        p.avg_per_visit = p.visit_count > 0 ? Math.round(p.total_revenue / p.visit_count) : 0
        if (p.first_visit && p.last_visit) {
          const diff = new Date(p.last_visit).getTime() - new Date(p.first_visit).getTime()
          p.months_active = Math.max(1, Math.round(diff / (30 * 24 * 60 * 60 * 1000)))
        }
        return p
      })

      setLtvData(result)
      setLoading(false)
    }
    load()
  }, [])

  const sorted = [...ltvData].sort((a, b) => b[sortKey] - a[sortKey])
  const totalLTV = ltvData.reduce((sum, p) => sum + p.total_revenue, 0)
  const avgLTV = ltvData.length > 0 ? Math.round(totalLTV / ltvData.length) : 0

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2 border-b">
          {saleTabs.map(tab => (
            <Link key={tab.href} href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                tab.href === '/sales/ltv' ? 'bg-[#14252A] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >{tab.label}</Link>
          ))}
        </div>

        <h2 className="font-bold text-gray-800 text-lg mb-4">LTV（顧客生涯価値）分析</h2>

        {/* サマリー */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold" style={{ color: '#14252A' }}>{avgLTV.toLocaleString()}<span className="text-xs sm:text-sm">円</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">平均LTV</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-blue-600">{ltvData.length}<span className="text-xs sm:text-sm">人</span></p>
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
            { key: 'total_revenue' as const, label: '総売上' },
            { key: 'visit_count' as const, label: '来院数' },
            { key: 'months_active' as const, label: '通院期間' },
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
          {/* モバイル: カード表示 */}
          <div className="sm:hidden space-y-2">
            {sorted.map((p, i) => (
              <Link key={p.id} href={`/patients/${p.id}`} className="block bg-white rounded-xl shadow-sm p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs text-gray-400 mr-1">#{i + 1}</span>
                    <span className="font-medium text-sm text-blue-600">{p.name}</span>
                  </div>
                  <p className="font-bold text-sm" style={{ color: '#14252A' }}>{p.total_revenue.toLocaleString()}円</p>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  <span>{p.visit_count}回</span>
                  <span>平均{p.avg_per_visit.toLocaleString()}円</span>
                  <span>{p.months_active}ヶ月</span>
                </div>
              </Link>
            ))}
          </div>

          {/* PC: テーブル表示 */}
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
                  <th className="text-right px-3 py-2 text-xs text-gray-500">通院月数</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500">初回</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500">最終</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/patients/${p.id}`} className="text-blue-600 hover:underline">{p.name}</Link>
                    </td>
                    <td className="px-3 py-2 text-right">{p.visit_count}回</td>
                    <td className="px-3 py-2 text-right font-medium">{p.total_revenue.toLocaleString()}円</td>
                    <td className="px-3 py-2 text-right">{p.avg_per_visit.toLocaleString()}円</td>
                    <td className="px-3 py-2 text-right">{p.months_active}ヶ月</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{p.first_visit}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{p.last_visit}</td>
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
