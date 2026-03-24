'use client'

import { useEffect, useState, useCallback } from 'react'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { fetchAllSlips } from '@/lib/fetchAll'
import { getClinicId } from '@/lib/clinic'

interface MonthlyCalc {
  year: number
  month: number
  revenue: number
  newRevenue: number
  existingRevenue: number
  treatments: number
  chartCount: number
  frequency: number
  newPatients: number
  avgPrice: number
  adCost: number
  slots: number | null
  utilizationRate: number | null
  newLtv: number
  cpa: number
  profitLtv: number
}

export default function StatsPage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const [monthlyData, setMonthlyData] = useState<MonthlyCalc[]>([])
  const [loading, setLoading] = useState(true)
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [editingSlots, setEditingSlots] = useState<{ month: number; value: string } | null>(null)
  const [savingSlots, setSavingSlots] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)

    // 1. Fetch all slips
    const allSlips = await fetchAllSlips(supabase, 'patient_id, visit_date, total_price') as {
      patient_id: string; visit_date: string; total_price: number
    }[]

    // 2. Fetch ad costs
    const { data: adCosts } = await supabase
      .from('cm_ad_costs')
      .select('month, cost')
      .eq('clinic_id', clinicId)

    // 3. Fetch slots from cm_monthly_stats (manually entered)
    const { data: savedStats } = await supabase
      .from('cm_monthly_stats')
      .select('year, month, slots, target_revenue')
      .eq('clinic_id', clinicId)

    // Build first visit date per patient (for new/existing detection)
    const firstVisitDate: Record<string, string> = {}
    allSlips.forEach(s => {
      if (s.patient_id && (!firstVisitDate[s.patient_id] || s.visit_date < firstVisitDate[s.patient_id])) {
        firstVisitDate[s.patient_id] = s.visit_date
      }
    })

    // Build ad cost per month
    const adCostByMonth: Record<string, number> = {}
    adCosts?.forEach(ac => {
      adCostByMonth[ac.month] = (adCostByMonth[ac.month] || 0) + (ac.cost || 0)
    })

    // Build slots per month from saved stats
    const slotsMap: Record<string, number | null> = {}
    savedStats?.forEach(s => {
      slotsMap[`${s.year}-${String(s.month).padStart(2, '0')}`] = s.slots
    })

    // Group slips by month
    const monthBuckets: Record<string, typeof allSlips> = {}
    allSlips.forEach(s => {
      const key = s.visit_date.slice(0, 7) // YYYY-MM
      if (!monthBuckets[key]) monthBuckets[key] = []
      monthBuckets[key].push(s)
    })

    // Calculate each month
    const results: MonthlyCalc[] = []
    const allMonthKeys = new Set([...Object.keys(monthBuckets), ...Object.keys(adCostByMonth)])

    allMonthKeys.forEach(monthKey => {
      const [y, m] = monthKey.split('-').map(Number)
      const slips = monthBuckets[monthKey] || []

      // Revenue
      const revenue = slips.reduce((sum, s) => sum + (s.total_price || 0), 0)

      // New vs existing
      let newRevenue = 0
      let existingRevenue = 0
      const newPatientIds = new Set<string>()
      const allPatientIds = new Set<string>()

      slips.forEach(s => {
        const amount = s.total_price || 0
        if (s.patient_id) {
          allPatientIds.add(s.patient_id)
          const firstMonth = firstVisitDate[s.patient_id]?.slice(0, 7)
          if (firstMonth === monthKey) {
            newRevenue += amount
            newPatientIds.add(s.patient_id)
          } else {
            existingRevenue += amount
          }
        } else {
          existingRevenue += amount
        }
      })

      const treatments = slips.length
      const chartCount = allPatientIds.size
      const frequency = chartCount > 0 ? treatments / chartCount : 0
      const newPatients = newPatientIds.size

      // Average price (normal treatments: 0 < price < 50000)
      const normalSlips = slips.filter(s => (s.total_price || 0) > 0 && (s.total_price || 0) < 50000)
      const normalTotal = normalSlips.reduce((sum, s) => sum + (s.total_price || 0), 0)
      const avgPrice = normalSlips.length > 0 ? Math.round(normalTotal / normalSlips.length) : 0

      // Ad cost
      const adCost = adCostByMonth[monthKey] || 0

      // Slots & utilization
      const slots = slotsMap[monthKey] ?? null
      const utilizationRate = slots && slots > 0 ? treatments / slots : null

      // LTV, CPA, profit LTV
      const newLtv = newPatients > 0 ? Math.round(newRevenue / newPatients) : 0
      const cpa = newPatients > 0 && adCost > 0 ? Math.round(adCost / newPatients) : 0
      const profitLtv = newLtv - cpa

      results.push({
        year: y, month: m, revenue, newRevenue, existingRevenue,
        treatments, chartCount, frequency, newPatients, avgPrice,
        adCost, slots, utilizationRate, newLtv, cpa, profitLtv,
      })
    })

    results.sort((a, b) => a.year - b.year || a.month - b.month)
    setMonthlyData(results)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Save slots to cm_monthly_stats
  const saveSlots = async (month: number, slotsValue: number) => {
    setSavingSlots(true)
    await supabase.from('cm_monthly_stats').upsert({
      clinic_id: clinicId,
      year: viewYear,
      month,
      slots: slotsValue,
    }, { onConflict: 'clinic_id,year,month' })
    setSavingSlots(false)
    setEditingSlots(null)
    loadData()
  }

  const years = [...new Set(monthlyData.map(d => d.year))].sort()
  const currentYearData = monthlyData.filter(d => d.year === viewYear)
  const prevYearData = monthlyData.filter(d => d.year === viewYear - 1)
  const getPrev = (month: number) => prevYearData.find(d => d.month === month)

  const yearSum = (data: MonthlyCalc[], field: keyof MonthlyCalc) =>
    data.reduce((sum, d) => sum + ((d[field] as number) || 0), 0)

  const totalRevenue = yearSum(currentYearData, 'revenue')
  const totalTreatments = yearSum(currentYearData, 'treatments')
  const totalNewPatients = yearSum(currentYearData, 'newPatients')
  const totalAdCost = yearSum(currentYearData, 'adCost')
  const prevTotalRevenue = yearSum(prevYearData, 'revenue')

  const yoyPct = prevTotalRevenue > 0
    ? Math.round(((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100) : null

  const fmt = (n: number | null | undefined) => n != null ? n.toLocaleString() : '-'
  const fmtPct = (n: number | null | undefined) => n != null ? `${Math.round(n * 100)}%` : '-'

  const maxRevenue = Math.max(...currentYearData.map(d => d.revenue), 1)

  return (
    <AppShell>
      <Header title="月間統計" />
      <div className="px-4 py-4 max-w-4xl mx-auto space-y-4">

        {/* Year selector */}
        <div className="flex gap-2 items-center flex-wrap">
          {years.map(y => (
            <button key={y} onClick={() => setViewYear(y)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                viewYear === y ? 'border-[#14252A] bg-[#14252A] text-white' : 'border-gray-200 text-gray-500 bg-white'
              }`}
            >{y}年</button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : currentYearData.length === 0 ? (
          <p className="text-gray-400 text-center py-8">{viewYear}年のデータがありません</p>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl shadow-sm p-4 text-center border-t-4" style={{ borderTopColor: '#14252A' }}>
                <p className="text-xs text-gray-400 mb-1">年間売上</p>
                <p className="text-xl font-bold" style={{ color: '#14252A' }}>{fmt(totalRevenue)}<span className="text-xs font-normal text-gray-400 ml-0.5">円</span></p>
                {yoyPct !== null && (
                  <p className={`text-xs mt-1 font-medium ${yoyPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    前年比 {yoyPct >= 0 ? '+' : ''}{yoyPct}%
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
                {currentYearData.map(d => {
                  const prev = getPrev(d.month)
                  const pct = (d.revenue / maxRevenue) * 100
                  const prevPct = prev ? (prev.revenue / maxRevenue) * 100 : 0
                  return (
                    <div key={d.month} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-8 text-right">{d.month}月</span>
                      <div className="flex-1">
                        {prev && (
                          <div className="w-full bg-gray-100 rounded-full h-3 mb-1">
                            <div className="h-3 rounded-full bg-gray-300 transition-all" style={{ width: `${prevPct}%` }} />
                          </div>
                        )}
                        <div className="w-full bg-gray-100 rounded-full h-4">
                          <div className="h-4 rounded-full transition-all" style={{ width: `${pct}%`, background: '#14252A' }} />
                        </div>
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-24 text-right">{fmt(d.revenue)}</span>
                    </div>
                  )
                })}
              </div>
              {prevYearData.length > 0 && (
                <div className="flex gap-4 mt-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded" style={{ background: '#14252A' }} />{viewYear}年</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded bg-gray-300" />{viewYear - 1}年</span>
                </div>
              )}
            </div>

            {/* Auto-calculated notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              売上・施術数・新規数・LTV・CPAは来院記録から自動集計。広告費は「営業データ &gt; 広告費入力」から取得。
              <br />予約枠のみ、テーブルの「枠」列をタップして入力してください。
            </div>

            {/* Monthly detail table */}
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2" style={{ borderColor: '#14252A' }}>
                    <th className="px-2 py-2 text-left text-gray-500 sticky left-0 bg-white z-10">月</th>
                    <th className="px-2 py-2 text-right text-gray-500">稼働率</th>
                    <th className="px-2 py-2 text-right text-gray-500">枠</th>
                    <th className="px-2 py-2 text-right text-gray-500">施術数</th>
                    <th className="px-2 py-2 text-right text-gray-500">カルテ</th>
                    <th className="px-2 py-2 text-right text-gray-500">頻度</th>
                    <th className="px-2 py-2 text-right text-gray-500">単価</th>
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
                  {currentYearData.map(d => {
                    const prev = getPrev(d.month)
                    const revDiff = prev ? d.revenue - prev.revenue : null
                    return (
                      <tr key={d.month} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-2 py-2.5 font-medium text-gray-800 sticky left-0 bg-white z-10">{d.month}月</td>
                        <td className="px-2 py-2.5 text-right">{fmtPct(d.utilizationRate)}</td>
                        <td className="px-2 py-2.5 text-right">
                          {editingSlots?.month === d.month ? (
                            <div className="flex items-center gap-1 justify-end">
                              <input
                                type="number"
                                value={editingSlots.value}
                                onChange={e => setEditingSlots({ month: d.month, value: e.target.value })}
                                className="w-14 px-1 py-0.5 border border-blue-400 rounded text-xs text-right"
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && editingSlots.value) {
                                    saveSlots(d.month, parseInt(editingSlots.value))
                                  } else if (e.key === 'Escape') {
                                    setEditingSlots(null)
                                  }
                                }}
                              />
                              <button
                                onClick={() => editingSlots.value && saveSlots(d.month, parseInt(editingSlots.value))}
                                disabled={savingSlots}
                                className="text-blue-600 font-bold"
                              >OK</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingSlots({ month: d.month, value: String(d.slots || '') })}
                              className={`${d.slots ? 'text-gray-700' : 'text-gray-300'} hover:text-blue-600 transition-colors`}
                              title="クリックして予約枠を入力"
                            >
                              {d.slots || '---'}
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-right">{fmt(d.treatments)}</td>
                        <td className="px-2 py-2.5 text-right">{fmt(d.chartCount)}</td>
                        <td className="px-2 py-2.5 text-right">{d.frequency > 0 ? d.frequency.toFixed(1) : '-'}</td>
                        <td className="px-2 py-2.5 text-right">{fmt(d.avgPrice)}</td>
                        <td className="px-2 py-2.5 text-right font-medium text-blue-600">{fmt(d.newPatients)}</td>
                        <td className="px-2 py-2.5 text-right font-bold">
                          {fmt(d.revenue)}
                          {revDiff !== null && (
                            <span className={`block text-[10px] ${revDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {revDiff >= 0 ? '+' : ''}{fmt(revDiff)}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-right text-green-700">{fmt(d.newRevenue)}</td>
                        <td className="px-2 py-2.5 text-right text-gray-600">{fmt(d.existingRevenue)}</td>
                        <td className="px-2 py-2.5 text-right text-orange-600">{d.adCost > 0 ? fmt(d.adCost) : '-'}</td>
                        <td className="px-2 py-2.5 text-right text-purple-600">{d.newLtv > 0 ? fmt(d.newLtv) : '-'}</td>
                        <td className="px-2 py-2.5 text-right">{d.cpa > 0 ? fmt(d.cpa) : '-'}</td>
                        <td className="px-2 py-2.5 text-right font-medium" style={{ color: d.profitLtv > 0 ? '#14252A' : d.profitLtv < 0 ? '#ef4444' : '#9ca3af' }}>
                          {d.newLtv > 0 || d.cpa > 0 ? fmt(d.profitLtv) : '-'}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Year total */}
                  <tr className="border-t-2 font-bold bg-gray-50" style={{ borderColor: '#14252A' }}>
                    <td className="px-2 py-2.5 sticky left-0 bg-gray-50 z-10">合計</td>
                    <td className="px-2 py-2.5 text-right">-</td>
                    <td className="px-2 py-2.5 text-right">-</td>
                    <td className="px-2 py-2.5 text-right">{fmt(totalTreatments)}</td>
                    <td className="px-2 py-2.5 text-right">-</td>
                    <td className="px-2 py-2.5 text-right">-</td>
                    <td className="px-2 py-2.5 text-right">-</td>
                    <td className="px-2 py-2.5 text-right text-blue-600">{fmt(totalNewPatients)}</td>
                    <td className="px-2 py-2.5 text-right">{fmt(totalRevenue)}</td>
                    <td className="px-2 py-2.5 text-right text-green-700">{fmt(yearSum(currentYearData, 'newRevenue'))}</td>
                    <td className="px-2 py-2.5 text-right text-gray-600">{fmt(yearSum(currentYearData, 'existingRevenue'))}</td>
                    <td className="px-2 py-2.5 text-right text-orange-600">{totalAdCost > 0 ? fmt(totalAdCost) : '-'}</td>
                    <td className="px-2 py-2.5 text-right">-</td>
                    <td className="px-2 py-2.5 text-right">-</td>
                    <td className="px-2 py-2.5 text-right">-</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Year-over-year comparison */}
            {prevYearData.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="font-bold text-gray-800 text-sm mb-3">前年比較 ({viewYear - 1}年 vs {viewYear}年)</h3>
                <div className="space-y-3">
                  {[
                    { label: '売上', cur: totalRevenue, prev: prevTotalRevenue, unit: '円' },
                    { label: '施術回数', cur: totalTreatments, prev: yearSum(prevYearData, 'treatments'), unit: '回' },
                    { label: '新規数', cur: totalNewPatients, prev: yearSum(prevYearData, 'newPatients'), unit: '人' },
                    { label: '広告費', cur: totalAdCost, prev: yearSum(prevYearData, 'adCost'), unit: '円' },
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
