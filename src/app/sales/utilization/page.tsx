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

interface DayUtilization {
  date: string
  visitCount: number
  maxSlots: number
  utilizationRate: number
}

export default function UtilizationPage() {
  const supabase = createClient()
  const [data, setData] = useState<DayUtilization[]>([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [maxSlotsPerDay, setMaxSlotsPerDay] = useState(8) // 1日最大枠数
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const startDate = selectedMonth + '-01'
      const d = new Date(startDate)
      d.setMonth(d.getMonth() + 1)
      d.setDate(0)
      const endDate = d.toISOString().split('T')[0]

      const { data: visits } = await supabase
        .from('cm_visit_records')
        .select('visit_date')
        .gte('visit_date', startDate)
        .lte('visit_date', endDate)

      if (!visits) { setLoading(false); return }

      const dayMap: Record<string, number> = {}
      visits.forEach(v => {
        dayMap[v.visit_date] = (dayMap[v.visit_date] || 0) + 1
      })

      // 月の全日を生成（営業日のみ = 日曜除外）
      const result: DayUtilization[] = []
      const current = new Date(startDate)
      const end = new Date(endDate)
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0]
        const dayOfWeek = current.getDay()
        if (dayOfWeek !== 0) { // 日曜を除外
          const count = dayMap[dateStr] || 0
          result.push({
            date: dateStr,
            visitCount: count,
            maxSlots: maxSlotsPerDay,
            utilizationRate: Math.min(100, Math.round((count / maxSlotsPerDay) * 100)),
          })
        }
        current.setDate(current.getDate() + 1)
      }

      setData(result.reverse())
      setLoading(false)
    }
    load()
  }, [selectedMonth, maxSlotsPerDay])

  const avgRate = data.length > 0 ? Math.round(data.reduce((s, d) => s + d.utilizationRate, 0) / data.length) : 0
  const totalVisits = data.reduce((s, d) => s + d.visitCount, 0)
  const workDays = data.filter(d => d.visitCount > 0).length

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2 border-b">
          {saleTabs.map(tab => (
            <Link key={tab.href} href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                tab.href === '/sales/utilization' ? 'bg-[#14252A] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >{tab.label}</Link>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 text-lg">稼働率分析</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">1日最大枠:</label>
            <input type="number" value={maxSlotsPerDay} onChange={e => setMaxSlotsPerDay(parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center" min={1} max={20} />
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold" style={{ color: '#14252A' }}>{avgRate}<span className="text-sm">%</span></p>
            <p className="text-xs text-gray-500">平均稼働率</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{totalVisits}<span className="text-sm">件</span></p>
            <p className="text-xs text-gray-500">月間施術数</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{workDays}<span className="text-sm">日</span></p>
            <p className="text-xs text-gray-500">稼働日数</p>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 text-xs text-gray-500">日付</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">施術数</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">最大枠</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">稼働率</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400">データがありません</td></tr>
                ) : data.map(d => (
                  <tr key={d.date} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {new Date(d.date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}
                    </td>
                    <td className="px-3 py-2 text-right">{d.visitCount}件</td>
                    <td className="px-3 py-2 text-right text-gray-400">{d.maxSlots}枠</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${d.utilizationRate}%`,
                              background: d.utilizationRate >= 80 ? '#16a34a' : d.utilizationRate >= 50 ? '#14252A' : '#ef4444'
                            }}
                          />
                        </div>
                        <span className={`font-medium ${d.utilizationRate >= 80 ? 'text-green-600' : d.utilizationRate >= 50 ? '' : 'text-red-500'}`}>
                          {d.utilizationRate}%
                        </span>
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
