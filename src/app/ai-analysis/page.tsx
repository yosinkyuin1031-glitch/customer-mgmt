'use client'

import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/AppShell'
import Header from '@/components/Header'
import { createClient } from '@/lib/supabase/client'
import { fetchAllSlips } from '@/lib/fetchAll'
import { getClinicId } from '@/lib/clinic'

interface StatsForAI {
  year: number
  month: number
  revenue: number
  newRevenue: number
  existingRevenue: number
  treatments: number
  chartCount: number
  newPatients: number
  avgPrice: number
  adCost: number
  repeat2Rate: number | null
  repeat6Rate: number | null
  couponPurchaseRate: number | null
  utilizationRate: number | null
  targetRevenue: number | null
}

export default function AIAnalysisPage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const [statsData, setStatsData] = useState<StatsForAI[]>([])
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [allSlips, adCostsRes, savedStatsRes, couponRes] = await Promise.all([
      fetchAllSlips(supabase, 'patient_id, visit_date, total_price') as Promise<{
        patient_id: string; visit_date: string; total_price: number
      }[]>,
      supabase.from('cm_ad_costs').select('month, cost').eq('clinic_id', clinicId),
      supabase.from('cm_monthly_stats').select('year, month, slots, target_revenue').eq('clinic_id', clinicId),
      supabase.from('cm_coupon_books').select('patient_id, purchase_date').eq('clinic_id', clinicId),
    ])

    const adCosts = adCostsRes.data || []
    const savedStats = savedStatsRes.data || []
    const couponBooks = couponRes.data || []

    const firstVisitDate: Record<string, string> = {}
    allSlips.forEach(s => {
      if (s.patient_id && (!firstVisitDate[s.patient_id] || s.visit_date < firstVisitDate[s.patient_id])) {
        firstVisitDate[s.patient_id] = s.visit_date
      }
    })

    const patientTotalVisits: Record<string, number> = {}
    allSlips.forEach(s => {
      if (s.patient_id) patientTotalVisits[s.patient_id] = (patientTotalVisits[s.patient_id] || 0) + 1
    })

    const couponPatientIds = new Set(couponBooks.map(c => c.patient_id))
    const adCostByMonth: Record<string, number> = {}
    adCosts.forEach(ac => { adCostByMonth[ac.month] = (adCostByMonth[ac.month] || 0) + (ac.cost || 0) })

    const slotsMap: Record<string, number | null> = {}
    const targetMap: Record<string, number | null> = {}
    savedStats.forEach(s => {
      const key = `${s.year}-${String(s.month).padStart(2, '0')}`
      slotsMap[key] = s.slots
      targetMap[key] = s.target_revenue
    })

    const monthBuckets: Record<string, typeof allSlips> = {}
    allSlips.forEach(s => {
      const key = s.visit_date.slice(0, 7)
      if (!monthBuckets[key]) monthBuckets[key] = []
      monthBuckets[key].push(s)
    })

    const results: StatsForAI[] = []
    const allMonthKeys = new Set([...Object.keys(monthBuckets), ...Object.keys(adCostByMonth)])

    allMonthKeys.forEach(monthKey => {
      const [y, m] = monthKey.split('-').map(Number)
      const slips = monthBuckets[monthKey] || []

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

      const revenue = slips.reduce((sum, s) => sum + (s.total_price || 0), 0)
      const treatments = slips.length
      const chartCount = allPatientIds.size
      const newPatients = newPatientIds.size
      const normalSlips = slips.filter(s => (s.total_price || 0) > 0 && (s.total_price || 0) < 50000)
      const normalTotal = normalSlips.reduce((sum, s) => sum + (s.total_price || 0), 0)
      const avgPrice = normalSlips.length > 0 ? Math.round(normalTotal / normalSlips.length) : 0
      const adCost = adCostByMonth[monthKey] || 0
      const slots = slotsMap[monthKey] ?? null
      const utilizationRate = slots && slots > 0 ? treatments / slots : null
      const targetRevenue = targetMap[monthKey] ?? null

      let repeat2Count = 0
      let repeat6Count = 0
      let couponPurchaseCount = 0
      newPatientIds.forEach(pid => {
        const totalVisits = patientTotalVisits[pid] || 0
        if (totalVisits >= 2) repeat2Count++
        if (totalVisits >= 6) repeat6Count++
        if (couponPatientIds.has(pid)) couponPurchaseCount++
      })

      results.push({
        year: y, month: m, revenue, newRevenue, existingRevenue,
        treatments, chartCount, newPatients, avgPrice, adCost,
        repeat2Rate: newPatients > 0 ? repeat2Count / newPatients : null,
        repeat6Rate: newPatients > 0 ? repeat6Count / newPatients : null,
        couponPurchaseRate: newPatients > 0 ? couponPurchaseCount / newPatients : null,
        utilizationRate, targetRevenue,
      })
    })

    results.sort((a, b) => a.year - b.year || a.month - b.month)
    // 直近12ヶ月のデータのみ送信
    const recent = results.slice(-12)
    setStatsData(recent)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const runAnalysis = async () => {
    if (statsData.length === 0) return
    setAnalyzing(true)
    setError('')
    setAnalysis('')

    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, statsData }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'エラーが発生しました')
      } else {
        setAnalysis(data.analysis)
      }
    } catch {
      setError('通信エラーが発生しました')
    }
    setAnalyzing(false)
  }

  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-base font-bold text-gray-800 mt-6 mb-2 border-b pb-1">{line.replace('### ', '')}</h3>
      }
      if (line.startsWith('## ')) {
        return <h2 key={i} className="text-lg font-bold text-gray-800 mt-6 mb-2">{line.replace('## ', '')}</h2>
      }
      if (line.startsWith('- **')) {
        const match = line.match(/^- \*\*(.+?)\*\*[:：]?\s*(.*)$/)
        if (match) {
          return <li key={i} className="ml-4 mb-1 text-sm text-gray-700"><span className="font-bold">{match[1]}</span>{match[2] ? `：${match[2]}` : ''}</li>
        }
      }
      if (line.startsWith('- ')) {
        return <li key={i} className="ml-4 mb-1 text-sm text-gray-700">{line.replace('- ', '')}</li>
      }
      if (line.trim() === '') return <div key={i} className="h-2" />
      return <p key={i} className="text-sm text-gray-700 leading-relaxed">{line}</p>
    })
  }

  return (
    <AppShell>
      <Header title="AI経営アドバイス" />
      <div className="px-4 py-4 max-w-3xl mx-auto space-y-4">

        {loading ? (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
              <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-3 bg-gray-200 rounded" style={{ width: `${90 - i * 10}%` }} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* データ概要 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-800 text-sm mb-3">分析対象データ</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-gray-800">{statsData.length}</p>
                  <p className="text-[10px] text-gray-500">ヶ月分</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-lg font-bold" style={{ color: '#14252A' }}>
                    {statsData.reduce((s, d) => s + d.revenue, 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-gray-500">合計売上(円)</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-blue-600">
                    {statsData.reduce((s, d) => s + d.treatments, 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-gray-500">合計施術数</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-green-600">
                    {statsData.reduce((s, d) => s + d.newPatients, 0)}
                  </p>
                  <p className="text-[10px] text-gray-500">合計新規数</p>
                </div>
              </div>
              {statsData.length > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  {statsData[0].year}年{statsData[0].month}月 〜 {statsData[statsData.length - 1].year}年{statsData[statsData.length - 1].month}月
                </p>
              )}
            </div>

            {/* 分析実行ボタン */}
            <button
              onClick={runAnalysis}
              disabled={analyzing || statsData.length === 0}
              className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50 transition-all"
              style={{ background: analyzing ? '#6b7280' : '#14252A' }}
            >
              {analyzing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  AI分析中...（30秒ほどお待ちください）
                </span>
              ) : analysis ? 'もう一度分析する' : 'AIに経営アドバイスを聞く'}
            </button>

            {/* エラー */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* 分析結果 */}
            {analysis && (
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800">AI経営アドバイス</h3>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">AI生成</span>
                </div>
                <div>{renderMarkdown(analysis)}</div>
                <p className="text-[10px] text-gray-400 mt-6 border-t pt-3">
                  ※ AIによる分析結果です。実際の経営判断は、ご自身の状況を踏まえて総合的にご判断ください。
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
