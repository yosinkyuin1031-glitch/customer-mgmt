'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { getClinicId } from '@/lib/clinic'

interface MonthlyStat {
  year: number
  month: number
  utilization_rate: number | null
  slots: number | null
  treatments: number | null
  chart_count: number | null
  frequency: number | null
  avg_price: number | null
  new_patients: number | null
  revenue: number | null
  new_revenue: number | null
  existing_revenue: number | null
  ad_cost: number | null
  new_ltv: number | null
  cpa: number | null
  profit_ltv: number | null
  target_revenue: number | null
}

export default function StatsPage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const [stats, setStats] = useState<MonthlyStat[]>([])
  const [loading, setLoading] = useState(true)
  const [viewYear, setViewYear] = useState(new Date().getFullYear())

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('cm_monthly_stats')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('year', { ascending: true })
        .order('month', { ascending: true })
      setStats(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const years = [...new Set(stats.map(s => s.year))].sort()
  const currentYearStats = stats.filter(s => s.year === viewYear)
  const prevYearStats = stats.filter(s => s.year === viewYear - 1)

  const getPrev = (month: number) => prevYearStats.find(s => s.month === month)

  // Year totals
  const yearTotal = (field: keyof MonthlyStat) =>
    currentYearStats.reduce((sum, s) => sum + ((s[field] as number) || 0), 0)
  const prevYearTotal = (field: keyof MonthlyStat) =>
    prevYearStats.reduce((sum, s) => sum + ((s[field] as number) || 0), 0)

  const totalRevenue = yearTotal('revenue')
  const totalTreatments = yearTotal('treatments')
  const totalNewPatients = yearTotal('new_patients')
  const totalAdCost = yearTotal('ad_cost')
  const prevTotalRevenue = prevYearTotal('revenue')

  const yoyChange = prevTotalRevenue > 0
    ? Math.round(((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100)
    : null

  const fmt = (n: number | null | undefined) => n != null ? n.toLocaleString() : '-'
  const fmtPct = (n: number | null | undefined) => n != null ? `${Math.round(n * 100)}%` : '-'

  // Max revenue for bar chart scaling
  const maxRevenue = Math.max(...currentYearStats.map(s => s.revenue || 0), 1)

  return (
    <AppShell>
      <Header title="月間統計" />
      <div className="px-4 py-4 max-w-4xl mx-auto space-y-4">

        {/* Year selector */}
        <div className="flex gap-2 items-center">
          {years.map(y => (
            <button
              key={y}
              onClick={() => setViewYear(y)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                viewYear === y ? 'border-[#14252A] bg-[#14252A] text-white' : 'border-gray-200 text-gray-500 bg-white'
              }`}
            >{y}年</button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : currentYearStats.length === 0 ? (
          <p className="text-gray-400 text-center py-8">{viewYear}年のデータがありません</p>
        ) : (
          <>
            {/* Year summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl shadow-sm p-4 text-center border-t-4" style={{ borderTopColor: '#14252A' }}>
                <p className="text-xs text-gray-400 mb-1">年間売上</p>
                <p className="text-xl font-bold" style={{ color: '#14252A' }}>{fmt(totalRevenue)}<span className="text-xs font-normal text-gray-400 ml-0.5">円</span></p>
                {yoyChange !== null && (
                  <p className={`text-xs mt-1 font-medium ${yoyChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    前年比 {yoyChange >= 0 ? '+' : ''}{yoyChange}%
                  </p>
                )}
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center border-t-4 border-t-blue-500">
                <p className="text-xs text-gray-400 mb-1">施術回数</p>
                <p className="text-xl font-bold text-blue-600">{fmt(totalTreatments)}<span className="text-xs font-normal text-gray-400 ml-0.5">回</span></p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center border-t-4 border-t-green-500">
                <p className="text-xs text-gray-400 mb-1">新規数</p>
                <p className="text-xl font-bold text-green-600">{fmt(totalNewPatients)}<span className="text-xs font-normal text-gray-400 ml-0.5">人</span></p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center border-t-4 border-t-orange-500">
                <p className="text-xs text-gray-400 mb-1">広告費</p>
                <p className="text-xl font-bold text-orange-600">{fmt(totalAdCost)}<span className="text-xs font-normal text-gray-400 ml-0.5">円</span></p>
              </div>
            </div>

            {/* Revenue bar chart */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-800 text-sm mb-3">月別売上推移</h3>
              <div className="space-y-2">
                {currentYearStats.map(s => {
                  const prev = getPrev(s.month)
                  const pct = ((s.revenue || 0) / maxRevenue) * 100
                  const prevPct = prev ? ((prev.revenue || 0) / maxRevenue) * 100 : 0
                  return (
                    <div key={s.month} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-8 text-right">{s.month}月</span>
                      <div className="flex-1 relative">
                        {prev && (
                          <div className="w-full bg-gray-100 rounded-full h-3 mb-1">
                            <div className="h-3 rounded-full bg-gray-300 transition-all" style={{ width: `${prevPct}%` }} />
                          </div>
                        )}
                        <div className="w-full bg-gray-100 rounded-full h-4">
                          <div className="h-4 rounded-full transition-all" style={{ width: `${pct}%`, background: '#14252A' }} />
                        </div>
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-20 text-right">{fmt(s.revenue)}</span>
                    </div>
                  )
                })}
              </div>
              {prevYearStats.length > 0 && (
                <div className="flex gap-4 mt-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded" style={{ background: '#14252A' }} />{viewYear}年</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded bg-gray-300" />{viewYear - 1}年</span>
                </div>
              )}
            </div>

            {/* Monthly detail table */}
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2" style={{ borderColor: '#14252A' }}>
                    <th className="px-2 py-2 text-left text-gray-500 sticky left-0 bg-white">月</th>
                    <th className="px-2 py-2 text-right text-gray-500">稼働率</th>
                    <th className="px-2 py-2 text-right text-gray-500">施術数</th>
                    <th className="px-2 py-2 text-right text-gray-500">カルテ数</th>
                    <th className="px-2 py-2 text-right text-gray-500">頻度</th>
                    <th className="px-2 py-2 text-right text-gray-500">新規</th>
                    <th className="px-2 py-2 text-right text-gray-500">売上</th>
                    <th className="px-2 py-2 text-right text-gray-500">新規売上</th>
                    <th className="px-2 py-2 text-right text-gray-500">既存売上</th>
                    <th className="px-2 py-2 text-right text-gray-500">広告費</th>
                    <th className="px-2 py-2 text-right text-gray-500">LTV</th>
                    <th className="px-2 py-2 text-right text-gray-500">CPA</th>
                    <th className="px-2 py-2 text-right text-gray-500">利益LTV</th>
                  </tr>
                </thead>
                <tbody>
                  {currentYearStats.map(s => {
                    const prev = getPrev(s.month)
                    const revDiff = prev && prev.revenue && s.revenue
                      ? s.revenue - prev.revenue : null
                    return (
                      <tr key={s.month} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-2 py-2.5 font-medium text-gray-800 sticky left-0 bg-white">{s.month}月</td>
                        <td className="px-2 py-2.5 text-right">{fmtPct(s.utilization_rate)}</td>
                        <td className="px-2 py-2.5 text-right">{fmt(s.treatments)}</td>
                        <td className="px-2 py-2.5 text-right">{fmt(s.chart_count)}</td>
                        <td className="px-2 py-2.5 text-right">{s.frequency != null ? s.frequency.toFixed(1) : '-'}</td>
                        <td className="px-2 py-2.5 text-right font-medium text-blue-600">{fmt(s.new_patients)}</td>
                        <td className="px-2 py-2.5 text-right font-bold">
                          {fmt(s.revenue)}
                          {revDiff !== null && (
                            <span className={`block text-[10px] ${revDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {revDiff >= 0 ? '+' : ''}{fmt(revDiff)}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-right text-green-700">{fmt(s.new_revenue)}</td>
                        <td className="px-2 py-2.5 text-right text-gray-600">{fmt(s.existing_revenue)}</td>
                        <td className="px-2 py-2.5 text-right text-orange-600">{fmt(s.ad_cost)}</td>
                        <td className="px-2 py-2.5 text-right text-purple-600">{fmt(s.new_ltv)}</td>
                        <td className="px-2 py-2.5 text-right">{fmt(s.cpa)}</td>
                        <td className="px-2 py-2.5 text-right font-medium" style={{ color: (s.profit_ltv || 0) > 0 ? '#14252A' : '#ef4444' }}>{fmt(s.profit_ltv)}</td>
                      </tr>
                    )
                  })}
                  {/* Year total row */}
                  <tr className="border-t-2 font-bold bg-gray-50" style={{ borderColor: '#14252A' }}>
                    <td className="px-2 py-2.5 sticky left-0 bg-gray-50">合計</td>
                    <td className="px-2 py-2.5 text-right">-</td>
                    <td className="px-2 py-2.5 text-right">{fmt(totalTreatments)}</td>
                    <td className="px-2 py-2.5 text-right">-</td>
                    <td className="px-2 py-2.5 text-right">-</td>
                    <td className="px-2 py-2.5 text-right text-blue-600">{fmt(totalNewPatients)}</td>
                    <td className="px-2 py-2.5 text-right">{fmt(totalRevenue)}</td>
                    <td className="px-2 py-2.5 text-right text-green-700">{fmt(yearTotal('new_revenue'))}</td>
                    <td className="px-2 py-2.5 text-right text-gray-600">{fmt(yearTotal('existing_revenue'))}</td>
                    <td className="px-2 py-2.5 text-right text-orange-600">{fmt(totalAdCost)}</td>
                    <td className="px-2 py-2.5 text-right">-</td>
                    <td className="px-2 py-2.5 text-right">-</td>
                    <td className="px-2 py-2.5 text-right">-</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Year-over-year comparison */}
            {prevYearStats.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="font-bold text-gray-800 text-sm mb-3">前年比較 ({viewYear - 1}年 vs {viewYear}年)</h3>
                <div className="space-y-3">
                  {[
                    { label: '売上', cur: totalRevenue, prev: prevTotalRevenue, unit: '円' },
                    { label: '施術回数', cur: totalTreatments, prev: prevYearTotal('treatments'), unit: '回' },
                    { label: '新規数', cur: totalNewPatients, prev: prevYearTotal('new_patients'), unit: '人' },
                    { label: '広告費', cur: totalAdCost, prev: prevYearTotal('ad_cost'), unit: '円' },
                  ].map(item => {
                    const diff = item.prev > 0 ? Math.round(((item.cur - item.prev) / item.prev) * 100) : null
                    return (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{item.label}</span>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-800">{fmt(item.cur)}{item.unit}</span>
                          <span className="text-xs text-gray-400 mx-2">vs</span>
                          <span className="text-xs text-gray-500">{fmt(item.prev)}{item.unit}</span>
                          {diff !== null && (
                            <span className={`ml-2 text-xs font-bold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              ({diff >= 0 ? '+' : ''}{diff}%)
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
