'use client'

import { useEffect, useState, useCallback } from 'react'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { fetchAllSlips } from '@/lib/fetchAll'
import { getClinicId } from '@/lib/clinic'

interface PatientInfo {
  id: string
  name: string
  birth_date: string | null
  gender: string
  referral_source: string
  chief_complaint: string
  occupation: string
  visit_motive: string
}

interface MonthBreakdown {
  newPatientList: { name: string; age: number | null; gender: string; referral: string; complaint: string; occupation: string; motive: string; revenue: number }[]
  existingPatientList: { name: string; age: number | null; gender: string; complaint: string; visits: number; revenue: number }[]
  referralCounts: Record<string, number>
  ageCounts: Record<string, number>
  genderCounts: Record<string, number>
  complaintCounts: Record<string, number>
}

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
  repeat2Count: number
  repeat2Rate: number | null
  repeat6Count: number
  repeat6Rate: number | null
  couponPurchaseCount: number
  couponPurchaseRate: number | null
  targetRevenue: number | null
  breakdown: MonthBreakdown
}

function calcAge(birthDate: string | null, refDate: Date): number | null {
  if (!birthDate) return null
  const b = new Date(birthDate)
  let age = refDate.getFullYear() - b.getFullYear()
  const m = refDate.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && refDate.getDate() < b.getDate())) age--
  return age
}

function ageGroup(age: number | null): string {
  if (age === null) return '不明'
  if (age < 20) return '10代以下'
  if (age < 30) return '20代'
  if (age < 40) return '30代'
  if (age < 50) return '40代'
  if (age < 60) return '50代'
  if (age < 70) return '60代'
  return '70代以上'
}

export default function StatsPage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const [monthlyData, setMonthlyData] = useState<MonthlyCalc[]>([])
  const [loading, setLoading] = useState(true)
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null)
  const [editingSlots, setEditingSlots] = useState<{ month: number; value: string } | null>(null)
  const [editingTarget, setEditingTarget] = useState<{ month: number; value: string } | null>(null)
  const [savingSlots, setSavingSlots] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)

    // Fetch all data in parallel
    const [allSlips, adCostsRes, savedStatsRes, patientsRes, couponRes] = await Promise.all([
      fetchAllSlips(supabase, 'patient_id, visit_date, total_price') as Promise<{
        patient_id: string; visit_date: string; total_price: number
      }[]>,
      supabase.from('cm_ad_costs').select('month, cost').eq('clinic_id', clinicId),
      supabase.from('cm_monthly_stats').select('year, month, slots, target_revenue').eq('clinic_id', clinicId),
      supabase.from('cm_patients').select('id, name, birth_date, gender, referral_source, chief_complaint, occupation, visit_motive').eq('clinic_id', clinicId),
      supabase.from('cm_coupon_books').select('patient_id, purchase_date').eq('clinic_id', clinicId),
    ])

    const adCosts = adCostsRes.data || []
    const savedStats = savedStatsRes.data || []
    const patients = (patientsRes.data || []) as PatientInfo[]
    const couponBooks = couponRes.data || []

    // Patient lookup
    const patientMap: Record<string, PatientInfo> = {}
    patients.forEach(p => { patientMap[p.id] = p })

    // First visit date per patient
    const firstVisitDate: Record<string, string> = {}
    allSlips.forEach(s => {
      if (s.patient_id && (!firstVisitDate[s.patient_id] || s.visit_date < firstVisitDate[s.patient_id])) {
        firstVisitDate[s.patient_id] = s.visit_date
      }
    })

    // Per-patient total visit count (all time) for repeat rate calculation
    const patientTotalVisits: Record<string, number> = {}
    allSlips.forEach(s => {
      if (s.patient_id) {
        patientTotalVisits[s.patient_id] = (patientTotalVisits[s.patient_id] || 0) + 1
      }
    })

    // Coupon book owners (patient IDs who have purchased coupon books)
    const couponPatientIds = new Set(couponBooks.map(c => c.patient_id))

    // Ad cost & slots maps
    const adCostByMonth: Record<string, number> = {}
    adCosts.forEach(ac => { adCostByMonth[ac.month] = (adCostByMonth[ac.month] || 0) + (ac.cost || 0) })

    const slotsMap: Record<string, number | null> = {}
    const targetMap: Record<string, number | null> = {}
    savedStats.forEach(s => {
      const key = `${s.year}-${String(s.month).padStart(2, '0')}`
      slotsMap[key] = s.slots
      targetMap[key] = s.target_revenue
    })

    // Group slips by month
    const monthBuckets: Record<string, typeof allSlips> = {}
    allSlips.forEach(s => {
      const key = s.visit_date.slice(0, 7)
      if (!monthBuckets[key]) monthBuckets[key] = []
      monthBuckets[key].push(s)
    })

    // Calculate each month
    const results: MonthlyCalc[] = []
    const allMonthKeys = new Set([...Object.keys(monthBuckets), ...Object.keys(adCostByMonth)])

    allMonthKeys.forEach(monthKey => {
      const [y, m] = monthKey.split('-').map(Number)
      const slips = monthBuckets[monthKey] || []
      const refDate = new Date(y, m - 1, 15) // mid-month for age calc

      let newRevenue = 0
      let existingRevenue = 0
      const newPatientIds = new Set<string>()
      const allPatientIds = new Set<string>()
      const patientRevenue: Record<string, number> = {}
      const patientVisits: Record<string, number> = {}

      slips.forEach(s => {
        const amount = s.total_price || 0
        if (s.patient_id) {
          allPatientIds.add(s.patient_id)
          patientRevenue[s.patient_id] = (patientRevenue[s.patient_id] || 0) + amount
          patientVisits[s.patient_id] = (patientVisits[s.patient_id] || 0) + 1
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
      const frequency = chartCount > 0 ? treatments / chartCount : 0
      const newPatients = newPatientIds.size
      const normalSlips = slips.filter(s => (s.total_price || 0) > 0 && (s.total_price || 0) < 50000)
      const normalTotal = normalSlips.reduce((sum, s) => sum + (s.total_price || 0), 0)
      const avgPrice = normalSlips.length > 0 ? Math.round(normalTotal / normalSlips.length) : 0
      const adCost = adCostByMonth[monthKey] || 0
      const slots = slotsMap[monthKey] ?? null
      const utilizationRate = slots && slots > 0 ? treatments / slots : null
      const newLtv = newPatients > 0 ? Math.round(newRevenue / newPatients) : 0
      const cpa = newPatients > 0 && adCost > 0 ? Math.round(adCost / newPatients) : 0
      const profitLtv = newLtv - cpa
      const targetRevenue = targetMap[monthKey] ?? null

      // Repeat rates: count new patients who have >= 2 or >= 6 total visits
      let repeat2Count = 0
      let repeat6Count = 0
      let couponPurchaseCount = 0
      newPatientIds.forEach(pid => {
        const totalVisits = patientTotalVisits[pid] || 0
        if (totalVisits >= 2) repeat2Count++
        if (totalVisits >= 6) repeat6Count++
        if (couponPatientIds.has(pid)) couponPurchaseCount++
      })
      const repeat2Rate = newPatients > 0 ? repeat2Count / newPatients : null
      const repeat6Rate = newPatients > 0 ? repeat6Count / newPatients : null
      const couponPurchaseRate = newPatients > 0 ? couponPurchaseCount / newPatients : null

      // Build breakdown
      const referralCounts: Record<string, number> = {}
      const ageCounts: Record<string, number> = {}
      const genderCounts: Record<string, number> = {}
      const complaintCounts: Record<string, number> = {}

      const newPatientList = [...newPatientIds].map(pid => {
        const p = patientMap[pid]
        const age = p ? calcAge(p.birth_date, refDate) : null
        const gender = p?.gender || '不明'
        const referral = p?.referral_source || '不明'
        const complaint = p?.chief_complaint || '不明'
        const occupation = p?.occupation || '不明'
        const motive = p?.visit_motive || ''

        referralCounts[referral] = (referralCounts[referral] || 0) + 1
        ageCounts[ageGroup(age)] = (ageCounts[ageGroup(age)] || 0) + 1
        genderCounts[gender] = (genderCounts[gender] || 0) + 1
        if (complaint && complaint !== '不明') {
          complaint.split(/[、,\s]+/).forEach(c => {
            const trimmed = c.trim()
            if (trimmed) complaintCounts[trimmed] = (complaintCounts[trimmed] || 0) + 1
          })
        }

        return {
          name: p?.name || pid.slice(0, 8),
          age, gender, referral, complaint, occupation, motive,
          revenue: patientRevenue[pid] || 0,
        }
      }).sort((a, b) => b.revenue - a.revenue)

      const existingPatientList = [...allPatientIds]
        .filter(pid => !newPatientIds.has(pid))
        .map(pid => {
          const p = patientMap[pid]
          const age = p ? calcAge(p.birth_date, refDate) : null
          return {
            name: p?.name || pid.slice(0, 8),
            age, gender: p?.gender || '不明',
            complaint: p?.chief_complaint || '',
            visits: patientVisits[pid] || 0,
            revenue: patientRevenue[pid] || 0,
          }
        }).sort((a, b) => b.revenue - a.revenue)

      results.push({
        year: y, month: m, revenue, newRevenue, existingRevenue,
        treatments, chartCount, frequency, newPatients, avgPrice,
        adCost, slots, utilizationRate, newLtv, cpa, profitLtv,
        repeat2Count, repeat2Rate, repeat6Count, repeat6Rate,
        couponPurchaseCount, couponPurchaseRate, targetRevenue,
        breakdown: { newPatientList, existingPatientList, referralCounts, ageCounts, genderCounts, complaintCounts },
      })
    })

    results.sort((a, b) => a.year - b.year || a.month - b.month)
    setMonthlyData(results)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const saveSlots = async (month: number, slotsValue: number) => {
    setSavingSlots(true)
    await supabase.from('cm_monthly_stats').upsert({
      clinic_id: clinicId, year: viewYear, month, slots: slotsValue,
    }, { onConflict: 'clinic_id,year,month' })
    setSavingSlots(false)
    setEditingSlots(null)
    loadData()
  }

  const saveTarget = async (month: number, targetValue: number) => {
    setSavingSlots(true)
    await supabase.from('cm_monthly_stats').upsert({
      clinic_id: clinicId, year: viewYear, month, target_revenue: targetValue,
    }, { onConflict: 'clinic_id,year,month' })
    setSavingSlots(false)
    setEditingTarget(null)
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

  // Year-level breakdowns (aggregate all months)
  const yearReferralCounts: Record<string, number> = {}
  const yearAgeCounts: Record<string, number> = {}
  const yearComplaintCounts: Record<string, number> = {}
  currentYearData.forEach(d => {
    Object.entries(d.breakdown.referralCounts).forEach(([k, v]) => { yearReferralCounts[k] = (yearReferralCounts[k] || 0) + v })
    Object.entries(d.breakdown.ageCounts).forEach(([k, v]) => { yearAgeCounts[k] = (yearAgeCounts[k] || 0) + v })
    Object.entries(d.breakdown.complaintCounts).forEach(([k, v]) => { yearComplaintCounts[k] = (yearComplaintCounts[k] || 0) + v })
  })

  const BarChart = ({ data, color }: { data: Record<string, number>; color: string }) => {
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1])
    const max = sorted.length > 0 ? sorted[0][1] : 1
    const total = sorted.reduce((s, [, v]) => s + v, 0)
    return (
      <div className="space-y-1.5">
        {sorted.map(([label, count]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-xs text-gray-600 w-20 truncate text-right">{label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-3">
              <div className="h-3 rounded-full transition-all" style={{ width: `${(count / max) * 100}%`, background: color }} />
            </div>
            <span className="text-xs font-medium text-gray-700 w-16 text-right">{count}人 ({Math.round((count / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    )
  }

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

            {/* Year-level new patient analysis */}
            <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
              <h3 className="font-bold text-gray-800 text-sm">年間 新規患者分析（{totalNewPatients}人）</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-2">来院経路</p>
                  <BarChart data={yearReferralCounts} color="#14252A" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-2">年齢層</p>
                  <BarChart data={yearAgeCounts} color="#2196F3" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-2">主訴</p>
                  <BarChart data={yearComplaintCounts} color="#4CAF50" />
                </div>
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

            {/* Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              全項目は来院記録から自動集計。広告費は「営業データ &gt; 広告費入力」から取得。各月の行をタップすると新規・既存の内訳が見れます。
            </div>

            {/* Monthly detail table */}
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2" style={{ borderColor: '#14252A' }}>
                    <th className="px-2 py-2 text-left text-gray-500 sticky left-0 bg-white z-10">月</th>
                    <th className="px-2 py-2 text-right text-gray-500">稼働率</th>
                    <th className="px-2 py-2 text-right text-gray-500">枠</th>
                    <th className="px-2 py-2 text-right text-gray-500">施術</th>
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
                    <th className="px-2 py-2 text-right text-gray-500">2回リピ</th>
                    <th className="px-2 py-2 text-right text-gray-500">6回リピ</th>
                    <th className="px-2 py-2 text-right text-gray-500">券購入率</th>
                    <th className="px-2 py-2 text-right text-gray-500">目標</th>
                    <th className="px-2 py-2 text-right text-gray-500">目標差</th>
                  </tr>
                </thead>
                <tbody>
                  {currentYearData.map(d => {
                    const prev = getPrev(d.month)
                    const revDiff = prev ? d.revenue - prev.revenue : null
                    const isExpanded = expandedMonth === d.month
                    return (
                      <>
                        <tr key={d.month}
                          className={`border-b border-gray-100 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                          onClick={() => setExpandedMonth(isExpanded ? null : d.month)}
                        >
                          <td className="px-2 py-2.5 font-medium text-gray-800 sticky left-0 z-10" style={{ background: isExpanded ? '#eff6ff' : 'white' }}>
                            <span className="mr-1 text-gray-400">{isExpanded ? '▼' : '▶'}</span>{d.month}月
                          </td>
                          <td className="px-2 py-2.5 text-right">{fmtPct(d.utilizationRate)}</td>
                          <td className="px-2 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                            {editingSlots?.month === d.month ? (
                              <div className="flex items-center gap-1 justify-end">
                                <input type="number" value={editingSlots.value}
                                  onChange={e => setEditingSlots({ month: d.month, value: e.target.value })}
                                  className="w-14 px-1 py-0.5 border border-blue-400 rounded text-xs text-right" autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && editingSlots.value) saveSlots(d.month, parseInt(editingSlots.value))
                                    else if (e.key === 'Escape') setEditingSlots(null)
                                  }}
                                />
                                <button onClick={() => editingSlots.value && saveSlots(d.month, parseInt(editingSlots.value))}
                                  disabled={savingSlots} className="text-blue-600 font-bold">OK</button>
                              </div>
                            ) : (
                              <button onClick={() => setEditingSlots({ month: d.month, value: String(d.slots || '') })}
                                className={`${d.slots ? 'text-gray-700' : 'text-gray-300'} hover:text-blue-600`}>
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
                          <td className="px-2 py-2.5 text-right">
                            {d.repeat2Rate !== null ? (
                              <span className={d.repeat2Rate >= 0.7 ? 'text-green-600 font-medium' : d.repeat2Rate < 0.5 ? 'text-red-500' : ''}>
                                {d.repeat2Count}人 ({Math.round(d.repeat2Rate * 100)}%)
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            {d.repeat6Rate !== null ? (
                              <span className={d.repeat6Rate >= 0.5 ? 'text-green-600 font-medium' : d.repeat6Rate < 0.3 ? 'text-red-500' : ''}>
                                {d.repeat6Count}人 ({Math.round(d.repeat6Rate * 100)}%)
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            {d.couponPurchaseRate !== null ? (
                              <span className={d.couponPurchaseRate >= 0.4 ? 'text-green-600 font-medium' : ''}>
                                {d.couponPurchaseCount}人 ({Math.round(d.couponPurchaseRate * 100)}%)
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-2 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                            {editingTarget?.month === d.month ? (
                              <div className="flex items-center gap-1 justify-end">
                                <input type="number" value={editingTarget.value}
                                  onChange={e => setEditingTarget({ month: d.month, value: e.target.value })}
                                  className="w-20 px-1 py-0.5 border border-blue-400 rounded text-xs text-right" autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && editingTarget.value) saveTarget(d.month, parseInt(editingTarget.value))
                                    else if (e.key === 'Escape') setEditingTarget(null)
                                  }}
                                />
                                <button onClick={() => editingTarget.value && saveTarget(d.month, parseInt(editingTarget.value))}
                                  disabled={savingSlots} className="text-blue-600 font-bold">OK</button>
                              </div>
                            ) : (
                              <button onClick={() => setEditingTarget({ month: d.month, value: String(d.targetRevenue || '') })}
                                className={`${d.targetRevenue ? 'text-gray-700' : 'text-gray-300'} hover:text-blue-600`}>
                                {d.targetRevenue ? fmt(d.targetRevenue) : '---'}
                              </button>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-right font-medium">
                            {d.targetRevenue ? (
                              <span className={d.revenue >= d.targetRevenue ? 'text-green-600' : 'text-red-500'}>
                                {d.revenue >= d.targetRevenue ? '+' : ''}{fmt(d.revenue - d.targetRevenue)}
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                        {/* Expanded detail */}
                        {isExpanded && (
                          <tr key={`${d.month}-detail`}>
                            <td colSpan={20} className="p-0">
                              <div className="bg-gray-50 px-4 py-4 space-y-4 border-b-2 border-blue-200">
                                {/* New patients detail */}
                                {d.breakdown.newPatientList.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-bold text-green-700 mb-2">新規患者 ({d.breakdown.newPatientList.length}人)</h4>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs bg-white rounded-lg overflow-hidden">
                                        <thead>
                                          <tr className="bg-green-50">
                                            <th className="px-2 py-1.5 text-left text-gray-600">氏名</th>
                                            <th className="px-2 py-1.5 text-center text-gray-600">年齢</th>
                                            <th className="px-2 py-1.5 text-center text-gray-600">性別</th>
                                            <th className="px-2 py-1.5 text-left text-gray-600">来院経路</th>
                                            <th className="px-2 py-1.5 text-left text-gray-600">主訴</th>
                                            <th className="px-2 py-1.5 text-left text-gray-600">職業</th>
                                            <th className="px-2 py-1.5 text-left text-gray-600">来院動機</th>
                                            <th className="px-2 py-1.5 text-right text-gray-600">売上</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {d.breakdown.newPatientList.map((p, idx) => (
                                            <tr key={idx} className="border-t border-gray-100">
                                              <td className="px-2 py-1.5 font-medium">{p.name}</td>
                                              <td className="px-2 py-1.5 text-center">{p.age !== null ? `${p.age}歳` : '-'}</td>
                                              <td className="px-2 py-1.5 text-center">{p.gender}</td>
                                              <td className="px-2 py-1.5">{p.referral || '-'}</td>
                                              <td className="px-2 py-1.5 max-w-[120px] truncate">{p.complaint || '-'}</td>
                                              <td className="px-2 py-1.5">{p.occupation || '-'}</td>
                                              <td className="px-2 py-1.5 max-w-[100px] truncate">{p.motive || '-'}</td>
                                              <td className="px-2 py-1.5 text-right font-medium">{fmt(p.revenue)}円</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>

                                    {/* Mini charts for this month's new patients */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                                      {Object.keys(d.breakdown.referralCounts).length > 0 && (
                                        <div className="bg-white rounded-lg p-3">
                                          <p className="text-[10px] text-gray-500 font-medium mb-1.5">来院経路</p>
                                          <BarChart data={d.breakdown.referralCounts} color="#14252A" />
                                        </div>
                                      )}
                                      {Object.keys(d.breakdown.ageCounts).length > 0 && (
                                        <div className="bg-white rounded-lg p-3">
                                          <p className="text-[10px] text-gray-500 font-medium mb-1.5">年齢層</p>
                                          <BarChart data={d.breakdown.ageCounts} color="#2196F3" />
                                        </div>
                                      )}
                                      {Object.keys(d.breakdown.complaintCounts).length > 0 && (
                                        <div className="bg-white rounded-lg p-3">
                                          <p className="text-[10px] text-gray-500 font-medium mb-1.5">主訴</p>
                                          <BarChart data={d.breakdown.complaintCounts} color="#4CAF50" />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Existing patients detail */}
                                {d.breakdown.existingPatientList.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-bold text-blue-700 mb-2">既存患者 ({d.breakdown.existingPatientList.length}人)</h4>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs bg-white rounded-lg overflow-hidden">
                                        <thead>
                                          <tr className="bg-blue-50">
                                            <th className="px-2 py-1.5 text-left text-gray-600">氏名</th>
                                            <th className="px-2 py-1.5 text-center text-gray-600">年齢</th>
                                            <th className="px-2 py-1.5 text-center text-gray-600">性別</th>
                                            <th className="px-2 py-1.5 text-left text-gray-600">主訴</th>
                                            <th className="px-2 py-1.5 text-right text-gray-600">来院数</th>
                                            <th className="px-2 py-1.5 text-right text-gray-600">売上</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {d.breakdown.existingPatientList.slice(0, 20).map((p, idx) => (
                                            <tr key={idx} className="border-t border-gray-100">
                                              <td className="px-2 py-1.5 font-medium">{p.name}</td>
                                              <td className="px-2 py-1.5 text-center">{p.age !== null ? `${p.age}歳` : '-'}</td>
                                              <td className="px-2 py-1.5 text-center">{p.gender}</td>
                                              <td className="px-2 py-1.5 max-w-[150px] truncate">{p.complaint || '-'}</td>
                                              <td className="px-2 py-1.5 text-right">{p.visits}回</td>
                                              <td className="px-2 py-1.5 text-right font-medium">{fmt(p.revenue)}円</td>
                                            </tr>
                                          ))}
                                          {d.breakdown.existingPatientList.length > 20 && (
                                            <tr><td colSpan={6} className="px-2 py-1.5 text-center text-gray-400">
                                              ...他{d.breakdown.existingPatientList.length - 20}人
                                            </td></tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
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
                    <td className="px-2 py-2.5 text-right">
                      {(() => {
                        const total2 = yearSum(currentYearData, 'repeat2Count')
                        return totalNewPatients > 0 ? `${total2}人 (${Math.round((total2 / totalNewPatients) * 100)}%)` : '-'
                      })()}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      {(() => {
                        const total6 = yearSum(currentYearData, 'repeat6Count')
                        return totalNewPatients > 0 ? `${total6}人 (${Math.round((total6 / totalNewPatients) * 100)}%)` : '-'
                      })()}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      {(() => {
                        const totalC = yearSum(currentYearData, 'couponPurchaseCount')
                        return totalNewPatients > 0 ? `${totalC}人 (${Math.round((totalC / totalNewPatients) * 100)}%)` : '-'
                      })()}
                    </td>
                    <td className="px-2 py-2.5 text-right">{fmt(yearSum(currentYearData, 'targetRevenue'))}</td>
                    <td className="px-2 py-2.5 text-right">
                      {(() => {
                        const totalTarget = yearSum(currentYearData, 'targetRevenue')
                        if (!totalTarget) return '-'
                        const diff = totalRevenue - totalTarget
                        return <span className={diff >= 0 ? 'text-green-600' : 'text-red-500'}>{diff >= 0 ? '+' : ''}{fmt(diff)}</span>
                      })()}
                    </td>
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
