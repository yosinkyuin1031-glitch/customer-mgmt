'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import type { VisitRecord } from '@/lib/types'

const salesTabs = [
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

export default function RevenuePage() {
  const supabase = createClient()
  const [visits, setVisits] = useState<VisitRecord[]>([])
  const [period, setPeriod] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
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
        startDate = new Date().getFullYear() + '-01-01'
        endDate = new Date().getFullYear() + '-12-31'
      }

      const { data } = await supabase
        .from('cm_visit_records')
        .select('*')
        .gte('visit_date', startDate)
        .lte('visit_date', endDate)
        .order('visit_date')

      setVisits(data || [])
      setLoading(false)
    }
    load()
  }, [period, selectedMonth])

  const totalRevenue = visits.reduce((sum, v) => sum + (v.payment_amount || 0), 0)
  const avgPerVisit = visits.length > 0 ? Math.round(totalRevenue / visits.length) : 0

  // 日別集計
  const dailyRevenue: Record<string, { count: number; amount: number }> = {}
  visits.forEach(v => {
    if (!dailyRevenue[v.visit_date]) dailyRevenue[v.visit_date] = { count: 0, amount: 0 }
    dailyRevenue[v.visit_date].count++
    dailyRevenue[v.visit_date].amount += v.payment_amount || 0
  })

  // 支払方法別
  const methodRevenue: Record<string, number> = {}
  visits.forEach(v => {
    const m = v.payment_method || '不明'
    methodRevenue[m] = (methodRevenue[m] || 0) + (v.payment_amount || 0)
  })

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* サブタブ */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2 border-b">
          {salesTabs.map(tab => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                tab.href === '/sales/revenue' ? 'bg-[#14252A] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <h2 className="font-bold text-gray-800 text-lg mb-4">売上集計</h2>

        {/* 期間選択 */}
        <div className="flex gap-2 mb-4">
          {[
            { key: 'day', label: '本日' },
            { key: 'month', label: '月別' },
            { key: 'year', label: '年間' },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${
                period === p.key ? 'border-[#14252A] bg-[#14252A] text-white' : 'border-gray-200 text-gray-500'
              }`}
            >{p.label}</button>
          ))}
          {period === 'month' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
            />
          )}
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : (
          <>
            {/* サマリー */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-2xl font-bold" style={{ color: '#14252A' }}>{totalRevenue.toLocaleString()}<span className="text-sm">円</span></p>
                <p className="text-xs text-gray-500">売上合計</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{visits.length}<span className="text-sm">件</span></p>
                <p className="text-xs text-gray-500">施術数</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{avgPerVisit.toLocaleString()}<span className="text-sm">円</span></p>
                <p className="text-xs text-gray-500">平均単価</p>
              </div>
            </div>

            {/* 日別一覧 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
              <div className="p-4 border-b">
                <h3 className="font-bold text-gray-800 text-sm">日別売上</h3>
              </div>
              {Object.keys(dailyRevenue).length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">データがありません</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-4 py-2 text-xs text-gray-500">日付</th>
                      <th className="text-right px-4 py-2 text-xs text-gray-500">施術数</th>
                      <th className="text-right px-4 py-2 text-xs text-gray-500">売上</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(dailyRevenue).sort(([a], [b]) => b.localeCompare(a)).map(([date, data]) => (
                      <tr key={date} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">
                          {new Date(date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}
                        </td>
                        <td className="px-4 py-2 text-right">{data.count}件</td>
                        <td className="px-4 py-2 text-right font-medium">{data.amount.toLocaleString()}円</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 支払方法別 */}
            {Object.keys(methodRevenue).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="font-bold text-gray-800 text-sm mb-3">支払方法別</h3>
                <div className="space-y-2">
                  {Object.entries(methodRevenue).sort((a, b) => b[1] - a[1]).map(([method, amount]) => (
                    <div key={method} className="flex justify-between items-center">
                      <span className="text-sm">{method}</span>
                      <span className="text-sm font-medium">{amount.toLocaleString()}円</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
