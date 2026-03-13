'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import type { Slip } from '@/lib/types'
import { saleTabs } from '@/lib/saleTabs'

export default function RevenuePage() {
  const supabase = createClient()
  const [slips, setSlips] = useState<Slip[]>([])
  const [period, setPeriod] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      let startDate: string
      let endDate: string

      if (period === 'day') {
        startDate = new Date().toISOString().split('T')[0]
        endDate = startDate
      } else if (period === 'month') {
        startDate = selectedMonth + '-01'
        const d = new Date(startDate)
        d.setMonth(d.getMonth() + 1)
        d.setDate(0)
        endDate = d.toISOString().split('T')[0]
      } else {
        startDate = selectedYear + '-01-01'
        endDate = selectedYear + '-12-31'
      }

      const { data } = await supabase
        .from('cm_slips')
        .select('*')
        .gte('visit_date', startDate)
        .lte('visit_date', endDate)
        .order('visit_date')

      setSlips(data || [])
      setLoading(false)
    }
    load()
  }, [period, selectedMonth, selectedYear])

  const totalRevenue = slips.reduce((sum, s) => sum + (s.total_price || 0), 0)
  const avgPerVisit = slips.length > 0 ? Math.round(totalRevenue / slips.length) : 0

  const dailyRevenue: Record<string, { count: number; amount: number }> = {}
  slips.forEach(s => {
    if (!dailyRevenue[s.visit_date]) dailyRevenue[s.visit_date] = { count: 0, amount: 0 }
    dailyRevenue[s.visit_date].count++
    dailyRevenue[s.visit_date].amount += s.total_price || 0
  })

  const years = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i))

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2 border-b">
          {saleTabs.map(tab => (
            <Link key={tab.href} href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                tab.href === '/sales/revenue' ? 'bg-[#14252A] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}>{tab.label}</Link>
          ))}
        </div>

        <h2 className="font-bold text-gray-800 text-lg mb-4">売上集計</h2>

        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { key: 'day', label: '本日' },
            { key: 'month', label: '月別' },
            { key: 'year', label: '年間' },
          ].map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${
                period === p.key ? 'border-[#14252A] bg-[#14252A] text-white' : 'border-gray-200 text-gray-500'
              }`}>{p.label}</button>
          ))}
          {period === 'month' && (
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm" />
          )}
          {period === 'year' && (
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm">
              {years.map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
              <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
                <p className="text-lg sm:text-2xl font-bold" style={{ color: '#14252A' }}>{totalRevenue.toLocaleString()}<span className="text-xs sm:text-sm">円</span></p>
                <p className="text-[10px] sm:text-xs text-gray-500">売上合計</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
                <p className="text-lg sm:text-2xl font-bold text-blue-600">{slips.length}<span className="text-xs sm:text-sm">件</span></p>
                <p className="text-[10px] sm:text-xs text-gray-500">施術数</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
                <p className="text-lg sm:text-2xl font-bold text-green-600">{avgPerVisit.toLocaleString()}<span className="text-xs sm:text-sm">円</span></p>
                <p className="text-[10px] sm:text-xs text-gray-500">平均単価</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
              <div className="p-4 border-b">
                <h3 className="font-bold text-gray-800 text-sm">日別売上</h3>
              </div>
              {Object.keys(dailyRevenue).length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">データがありません</p>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-3 sm:px-4 py-2 text-xs text-gray-500">日付</th>
                      <th className="text-right px-3 sm:px-4 py-2 text-xs text-gray-500">施術数</th>
                      <th className="text-right px-3 sm:px-4 py-2 text-xs text-gray-500">売上</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(dailyRevenue).sort(([a], [b]) => b.localeCompare(a)).map(([date, data]) => (
                      <tr key={date} className="border-b hover:bg-gray-50">
                        <td className="px-3 sm:px-4 py-2">
                          {new Date(date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}
                        </td>
                        <td className="px-3 sm:px-4 py-2 text-right">{data.count}件</td>
                        <td className="px-3 sm:px-4 py-2 text-right font-medium">{data.amount.toLocaleString()}円</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
