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

interface RepeatData {
  month: string
  newPatients: number
  repeatPatients: number
  repeatRate: number
  totalVisits: number
}

export default function RepeatPage() {
  const supabase = createClient()
  const [data, setData] = useState<RepeatData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: visits } = await supabase
        .from('cm_visit_records')
        .select('patient_id, visit_date, visit_number')
        .order('visit_date')

      if (!visits) { setLoading(false); return }

      // 月別にグループ化
      const monthMap: Record<string, { patients: Set<string>, newPatients: Set<string>, totalVisits: number }> = {}
      const firstVisitMonth: Record<string, string> = {}

      // まず各患者の初回来院月を特定
      visits.forEach(v => {
        const month = v.visit_date.slice(0, 7)
        if (!firstVisitMonth[v.patient_id] || month < firstVisitMonth[v.patient_id]) {
          firstVisitMonth[v.patient_id] = month
        }
      })

      visits.forEach(v => {
        const month = v.visit_date.slice(0, 7)
        if (!monthMap[month]) monthMap[month] = { patients: new Set(), newPatients: new Set(), totalVisits: 0 }
        monthMap[month].patients.add(v.patient_id)
        monthMap[month].totalVisits++
        if (firstVisitMonth[v.patient_id] === month) {
          monthMap[month].newPatients.add(v.patient_id)
        }
      })

      const result: RepeatData[] = Object.entries(monthMap)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, d]) => {
          const total = d.patients.size
          const newP = d.newPatients.size
          const repeatP = total - newP
          return {
            month,
            newPatients: newP,
            repeatPatients: repeatP,
            repeatRate: total > 0 ? Math.round((repeatP / total) * 100) : 0,
            totalVisits: d.totalVisits,
          }
        })

      setData(result)
      setLoading(false)
    }
    load()
  }, [])

  const avgRepeatRate = data.length > 0
    ? Math.round(data.reduce((sum, d) => sum + d.repeatRate, 0) / data.length)
    : 0

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2 border-b">
          {saleTabs.map(tab => (
            <Link key={tab.href} href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                tab.href === '/sales/repeat' ? 'bg-[#14252A] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >{tab.label}</Link>
          ))}
        </div>

        <h2 className="font-bold text-gray-800 text-lg mb-4">リピート分析</h2>

        {/* サマリー */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold" style={{ color: '#14252A' }}>{avgRepeatRate}<span className="text-sm">%</span></p>
            <p className="text-xs text-gray-500">平均リピート率</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{data.length}<span className="text-sm">ヶ月</span></p>
            <p className="text-xs text-gray-500">集計期間</p>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 text-xs text-gray-500">月</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">総来院数</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">新規</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">リピート</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">リピート率</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">データがありません</td></tr>
                ) : data.map(d => (
                  <tr key={d.month} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{d.month}</td>
                    <td className="px-3 py-2 text-right">{d.totalVisits}件</td>
                    <td className="px-3 py-2 text-right text-blue-600">{d.newPatients}人</td>
                    <td className="px-3 py-2 text-right text-green-600">{d.repeatPatients}人</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${d.repeatRate}%`, background: '#14252A' }} />
                        </div>
                        <span className="font-medium">{d.repeatRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}
