'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { saleTabs } from '@/lib/saleTabs'

interface HourlyData {
  date: string
  totalRevenue: number
  totalMinutes: number
  hourlyRate: number
  visitCount: number
}

export default function HourlyPage() {
  const supabase = createClient()
  const [data, setData] = useState<HourlyData[]>([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const startDate = selectedMonth + '-01'
      const d = new Date(startDate)
      d.setMonth(d.getMonth() + 1)
      d.setDate(0)
      const endDate = d.toISOString().split('T')[0]

      const { data: slips } = await supabase
        .from('cm_slips')
        .select('visit_date, total_price, duration_minutes')
        .gte('visit_date', startDate)
        .lte('visit_date', endDate)

      if (!slips) { setLoading(false); return }

      const dayMap: Record<string, { revenue: number, count: number, minutes: number }> = {}
      slips.forEach(s => {
        if (!dayMap[s.visit_date]) dayMap[s.visit_date] = { revenue: 0, count: 0, minutes: 0 }
        dayMap[s.visit_date].revenue += s.total_price || 0
        dayMap[s.visit_date].count++
        dayMap[s.visit_date].minutes += s.duration_minutes || 30
      })

      const result: HourlyData[] = Object.entries(dayMap)
        .map(([date, d]) => ({
            date,
            totalRevenue: d.revenue,
            totalMinutes: d.minutes,
            hourlyRate: d.minutes > 0 ? Math.round((d.revenue / d.minutes) * 60) : 0,
            visitCount: d.count,
        }))
        .sort((a, b) => b.date.localeCompare(a.date))

      setData(result)
      setLoading(false)
    }
    load()
  }, [selectedMonth])

  const avgHourlyRate = data.length > 0
    ? Math.round(data.reduce((sum, d) => sum + d.hourlyRate, 0) / data.length)
    : 0
  const totalRevenue = data.reduce((sum, d) => sum + d.totalRevenue, 0)

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2 border-b">
          {saleTabs.map(tab => (
            <Link key={tab.href} href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                tab.href === '/sales/hourly' ? 'bg-[#14252A] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >{tab.label}</Link>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 text-lg">時間単価分析</h2>
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm" />
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold" style={{ color: '#14252A' }}>{avgHourlyRate.toLocaleString()}<span className="text-xs sm:text-sm">円/h</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">平均時間単価</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-blue-600">{totalRevenue.toLocaleString()}<span className="text-xs sm:text-sm">円</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">月間売上</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-green-600">{data.reduce((s, d) => s + d.visitCount, 0)}<span className="text-xs sm:text-sm">件</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">月間施術数</p>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : (
          <>
          {/* モバイル: カード表示 */}
          <div className="sm:hidden space-y-2">
            {data.length === 0 ? (
              <p className="text-center py-8 text-gray-400">データがありません</p>
            ) : data.map(d => (
              <div key={d.date} className="bg-white rounded-xl shadow-sm p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">
                    {new Date(d.date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}
                  </span>
                  <span className="font-bold text-sm" style={{ color: '#14252A' }}>{d.hourlyRate.toLocaleString()}円/h</span>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  <span>{d.visitCount}件</span>
                  <span>{d.totalRevenue.toLocaleString()}円</span>
                  <span>{Math.round(d.totalMinutes / 60 * 10) / 10}h</span>
                </div>
              </div>
            ))}
          </div>

          {/* PC: テーブル表示 */}
          <div className="hidden sm:block bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 text-xs text-gray-500">日付</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">施術数</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">売上</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">稼働時間</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">時間単価</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">データがありません</td></tr>
                ) : data.map(d => (
                  <tr key={d.date} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {new Date(d.date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}
                    </td>
                    <td className="px-3 py-2 text-right">{d.visitCount}件</td>
                    <td className="px-3 py-2 text-right font-medium">{d.totalRevenue.toLocaleString()}円</td>
                    <td className="px-3 py-2 text-right">{Math.round(d.totalMinutes / 60 * 10) / 10}h</td>
                    <td className="px-3 py-2 text-right font-bold" style={{ color: '#14252A' }}>{d.hourlyRate.toLocaleString()}円/h</td>
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
