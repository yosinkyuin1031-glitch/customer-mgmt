'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { fetchAllSlips } from '@/lib/fetchAll'
import { saleTabs } from '@/lib/saleTabs'

interface PatientLTV {
  id: string
  name: string
  visitCount: number
  ltv: number
  avgPrice: number
  firstVisit: string
  lastVisit: string
  daysSince: number | null
}

export default function LtvPage() {
  const supabase = createClient()
  const [patients, setPatients] = useState<PatientLTV[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<'ltv' | 'visit_count' | 'days'>('ltv')

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      // cm_slipsから全件取得（1000件制限回避）
      const slips = await fetchAllSlips(supabase, 'patient_id, patient_name, visit_date, total_price') as { patient_id: string; patient_name: string; visit_date: string; total_price: number }[]

      const { data: patientList } = await supabase
        .from('cm_patients')
        .select('id, name')

      if (!slips || slips.length === 0) { setLoading(false); return }

      const nameMap: Record<string, string> = {}
      patientList?.forEach(p => { nameMap[p.id] = p.name })

      // 患者ごとに集計
      const patMap: Record<string, { count: number, revenue: number, first: string, last: string, name: string }> = {}
      slips.forEach(s => {
        const pid = s.patient_id || 'unknown'
        if (!patMap[pid]) {
          patMap[pid] = { count: 0, revenue: 0, first: s.visit_date, last: s.visit_date, name: nameMap[pid] || s.patient_name || '不明' }
        }
        patMap[pid].count++
        patMap[pid].revenue += s.total_price || 0
        if (s.visit_date < patMap[pid].first) patMap[pid].first = s.visit_date
        if (s.visit_date > patMap[pid].last) patMap[pid].last = s.visit_date
      })

      const now = Date.now()
      const result: PatientLTV[] = Object.entries(patMap)
        .filter(([id]) => id !== 'unknown')
        .map(([id, d]) => ({
          id,
          name: d.name,
          visitCount: d.count,
          ltv: d.revenue,
          avgPrice: d.count > 0 ? Math.round(d.revenue / d.count) : 0,
          firstVisit: d.first,
          lastVisit: d.last,
          daysSince: Math.floor((now - new Date(d.last).getTime()) / (24 * 60 * 60 * 1000)),
        }))
        .sort((a, b) => b.ltv - a.ltv)

      setPatients(result)
      setLoading(false)
    }
    load()
  }, [])

  const sorted = [...patients].sort((a, b) => {
    if (sortKey === 'ltv') return b.ltv - a.ltv
    if (sortKey === 'visit_count') return b.visitCount - a.visitCount
    return (b.daysSince ?? 0) - (a.daysSince ?? 0)
  })

  const totalLTV = patients.reduce((sum, p) => sum + p.ltv, 0)
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
            { key: 'days' as const, label: '最終来院' },
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
                  <p className="font-bold text-sm" style={{ color: '#14252A' }}>{p.ltv.toLocaleString()}円</p>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  <span>{p.visitCount}回</span>
                  <span>平均{p.avgPrice.toLocaleString()}円</span>
                  <span>{p.firstVisit}〜</span>
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
                    <td className="px-3 py-2 text-right">{p.visitCount}回</td>
                    <td className="px-3 py-2 text-right font-medium">{p.ltv.toLocaleString()}円</td>
                    <td className="px-3 py-2 text-right">{p.avgPrice.toLocaleString()}円</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{p.firstVisit}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{p.lastVisit}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {p.daysSince !== null ? `${p.daysSince}日` : '-'}
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
