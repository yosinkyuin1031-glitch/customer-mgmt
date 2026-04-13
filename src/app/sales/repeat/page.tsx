'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { saleTabs } from '@/lib/saleTabs'
import { fetchAllSlips } from '@/lib/fetchAll'
import { getClinicId } from '@/lib/clinic'
import PatientFilter, { usePatientFilter, filterPatientIds, type PatientForFilter } from '@/components/PatientFilter'

interface RepeatData {
  month: string
  newPatients: number
  repeatPatients: number
  repeatRate: number
  totalVisits: number
  newVisits: number
  repeatVisits: number
}

interface PatientRepeat {
  id: string
  name: string
  visitCount: number
  totalRevenue: number
  firstVisit: string
  lastVisit: string
}

interface PatientFullRow {
  id: string
  name: string
  gender: string | null
  birth_date: string | null
  visit_motive: string | null
  occupation: string | null
  chief_complaint: string | null
  referral_source: string | null
  prefecture: string | null
  visit_count: number | null
}

type CriteriaKey = 'referral_source' | 'occupation' | 'chief_complaint' | 'gender' | 'age' | 'prefecture'

const CRITERIA_OPTIONS: { key: CriteriaKey; label: string }[] = [
  { key: 'referral_source', label: '来店動機' },
  { key: 'occupation', label: '職業' },
  { key: 'chief_complaint', label: '症状' },
  { key: 'gender', label: '性別' },
  { key: 'age', label: '年代' },
  { key: 'prefecture', label: '地域' },
]

function getAge(birthDate: string | null): string {
  if (!birthDate) return '未設定'
  const age = Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  if (age < 20) return '10代以下'
  if (age < 30) return '20代'
  if (age < 40) return '30代'
  if (age < 50) return '40代'
  if (age < 60) return '50代'
  if (age < 70) return '60代'
  if (age < 80) return '70代'
  return '80代以上'
}

function getCriteriaValues(p: PatientFullRow, criteria: CriteriaKey): string[] {
  switch (criteria) {
    case 'referral_source': return [p.referral_source || p.visit_motive || '未設定']
    case 'occupation': return [p.occupation || '未設定']
    case 'chief_complaint': {
      const raw = p.chief_complaint || ''
      if (!raw) return ['未設定']
      const parts = raw.split(/[,、\s]+/).map(s => s.trim()).filter(Boolean)
      return parts.length > 0 ? parts : ['未設定']
    }
    case 'gender': return [p.gender || '未設定']
    case 'age': return [getAge(p.birth_date)]
    case 'prefecture': return [p.prefecture || '未設定']
  }
}

export default function RepeatPage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const [data, setData] = useState<RepeatData[]>([])
  const [patientRepeats, setPatientRepeats] = useState<PatientRepeat[]>([])
  const [viewMode, setViewMode] = useState<'summary' | 'monthly' | 'patient'>('summary')
  const [period, setPeriod] = useState('month')
  const { filters, setFilters } = usePatientFilter()
  const [patientRawData, setPatientRawData] = useState<PatientForFilter[]>([])
  const [patientFullData, setPatientFullData] = useState<PatientFullRow[]>([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [criteria, setCriteria] = useState<CriteriaKey>('referral_source')

  const years = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i))

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      let queryStart: string
      let queryEnd: string

      if (period === 'day') {
        queryStart = new Date().toISOString().split('T')[0]
        queryEnd = queryStart
      } else if (period === 'month') {
        queryStart = selectedMonth + '-01'
        const d = new Date(queryStart)
        d.setMonth(d.getMonth() + 1)
        d.setDate(0)
        queryEnd = d.toISOString().split('T')[0]
      } else if (period === 'year') {
        queryStart = selectedYear + '-01-01'
        queryEnd = selectedYear + '-12-31'
      } else {
        queryStart = startDate
        queryEnd = endDate
      }

      const allVisits = await fetchAllSlips(supabase, 'patient_id, visit_date, total_price') as { patient_id: string; visit_date: string; total_price: number }[]

      const { data: patients } = await supabase
        .from('cm_patients')
        .select('id, name, gender, birth_date, visit_motive, occupation, chief_complaint, referral_source, prefecture, visit_count')
        .eq('clinic_id', clinicId)

      if (!allVisits || allVisits.length === 0 || !patients) { setData([]); setPatientRepeats([]); setLoading(false); return }

      setPatientRawData(patients.map(p => ({
        id: p.id,
        gender: p.gender || undefined,
        birth_date: p.birth_date,
        visit_motive: p.visit_motive || undefined,
        occupation: p.occupation || undefined,
        chief_complaint: p.chief_complaint || undefined,
      })))
      setPatientFullData(patients)

      const patientNameMap: Record<string, string> = {}
      patients.forEach(p => { patientNameMap[p.id] = p.name })

      const firstVisitMonth: Record<string, string> = {}
      allVisits.forEach(v => {
        const month = v.visit_date.slice(0, 7)
        if (!firstVisitMonth[v.patient_id] || month < firstVisitMonth[v.patient_id]) {
          firstVisitMonth[v.patient_id] = month
        }
      })

      const filteredVisits = allVisits.filter(v => v.visit_date >= queryStart && v.visit_date <= queryEnd)

      const monthMap: Record<string, { patients: Set<string>, newPatients: Set<string>, totalVisits: number, newVisits: number, repeatVisits: number }> = {}

      filteredVisits.forEach(v => {
        const month = v.visit_date.slice(0, 7)
        if (!monthMap[month]) monthMap[month] = { patients: new Set(), newPatients: new Set(), totalVisits: 0, newVisits: 0, repeatVisits: 0 }
        monthMap[month].patients.add(v.patient_id)
        monthMap[month].totalVisits++
        if (firstVisitMonth[v.patient_id] === month) {
          monthMap[month].newPatients.add(v.patient_id)
          monthMap[month].newVisits++
        } else {
          monthMap[month].repeatVisits++
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
            newVisits: d.newVisits,
            repeatVisits: d.repeatVisits,
          }
        })

      setData(result)

      const patMap: Record<string, { count: number, revenue: number, first: string, last: string }> = {}
      filteredVisits.forEach(v => {
        if (!patMap[v.patient_id]) patMap[v.patient_id] = { count: 0, revenue: 0, first: v.visit_date, last: v.visit_date }
        patMap[v.patient_id].count++
        patMap[v.patient_id].revenue += v.total_price || 0
        if (v.visit_date < patMap[v.patient_id].first) patMap[v.patient_id].first = v.visit_date
        if (v.visit_date > patMap[v.patient_id].last) patMap[v.patient_id].last = v.visit_date
      })

      const patRepeats: PatientRepeat[] = Object.entries(patMap)
        .map(([id, d]) => ({
          id,
          name: patientNameMap[id] || '不明',
          visitCount: d.count,
          totalRevenue: d.revenue,
          firstVisit: d.first,
          lastVisit: d.last,
        }))
        .sort((a, b) => b.visitCount - a.visitCount)

      setPatientRepeats(patRepeats)
      setLoading(false)
    }
    load()
  }, [period, selectedMonth, selectedYear, startDate, endDate])

  const allowedIds = useMemo(() => {
    return filterPatientIds(patientRawData, filters)
  }, [patientRawData, filters])

  const filteredPatientRepeats = useMemo(() => {
    return patientRepeats.filter(p => allowedIds.has(p.id))
  }, [patientRepeats, allowedIds])

  // === 集計テーブルデータ（CSS売上集計のリピートタブと同じ形式） ===
  const summaryData = useMemo(() => {
    // patient_id → visit_count マップ（filteredPatientRepeatsから）
    const visitMap: Record<string, number> = {}
    filteredPatientRepeats.forEach(p => { visitMap[p.id] = p.visitCount })

    // patient_id → full row マップ
    const fullMap: Record<string, PatientFullRow> = {}
    patientFullData.forEach(p => { fullMap[p.id] = p })

    // グルーピング（症状は分割して各症状にカウント）
    const groups: Record<string, { patientIds: string[]; totalVisits: number }> = {}
    for (const p of filteredPatientRepeats) {
      const raw = fullMap[p.id]
      if (!raw) continue
      const keys = getCriteriaValues(raw, criteria)
      for (const key of keys) {
        if (!groups[key]) groups[key] = { patientIds: [], totalVisits: 0 }
        groups[key].patientIds.push(p.id)
        groups[key].totalVisits += p.visitCount
      }
    }

    return Object.entries(groups)
      .map(([label, g]) => {
        const count = g.patientIds.length
        const avgRepeat = count > 0 ? +(g.totalVisits / count).toFixed(1) : 0
        // N回目のリテンション率: visit_count >= N の患者数 / count
        const retentions: number[] = []
        for (let n = 2; n <= 10; n++) {
          const retained = g.patientIds.filter(id => (visitMap[id] || 0) >= n).length
          retentions.push(count > 0 ? Math.round((retained / count) * 1000) / 10 : 0)
        }
        return { label, totalVisits: g.totalVisits, patients: count, avgRepeat, retentions }
      })
      .sort((a, b) => b.avgRepeat - a.avgRepeat)
  }, [filteredPatientRepeats, patientFullData, criteria])

  // 全体のリテンション率（合計行用）
  const totalSummary = useMemo(() => {
    const total = filteredPatientRepeats.length
    const totalVisits = filteredPatientRepeats.reduce((s, p) => s + p.visitCount, 0)
    const avgRepeat = total > 0 ? +(totalVisits / total).toFixed(1) : 0
    const retentions: number[] = []
    for (let n = 2; n <= 10; n++) {
      const retained = filteredPatientRepeats.filter(p => p.visitCount >= n).length
      retentions.push(total > 0 ? Math.round((retained / total) * 1000) / 10 : 0)
    }
    return { totalVisits, patients: total, avgRepeat, retentions }
  }, [filteredPatientRepeats])

  const avgRepeatRate = data.length > 0
    ? Math.round(data.reduce((sum, d) => sum + d.repeatRate, 0) / data.length)
    : 0

  const distBuckets = [
    { key: 1, label: '1回' }, { key: 2, label: '2回' }, { key: 3, label: '3回' },
    { key: 4, label: '4回' }, { key: 5, label: '5回' }, { key: 6, label: '6〜9回' }, { key: 10, label: '10回以上' },
  ]

  const countDist: Record<number, number> = {}
  filteredPatientRepeats.forEach(p => {
    const bucket = p.visitCount <= 5 ? p.visitCount : p.visitCount <= 9 ? 6 : 10
    countDist[bucket] = (countDist[bucket] || 0) + 1
  })

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

        {/* 期間選択（CSS売上集計と同じレイアウト） */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 font-medium">集計開始日時</span>
            <input type="date" value={startDate || '2021-04-01'} onChange={e => { setStartDate(e.target.value); setPeriod('custom') }}
              className="px-3 py-2 border border-gray-300 rounded text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 font-medium">集計終了日時</span>
            <input type="date" value={endDate || new Date().toISOString().split('T')[0]} onChange={e => { setEndDate(e.target.value); setPeriod('custom') }}
              className="px-3 py-2 border border-gray-300 rounded text-sm" />
          </div>
        </div>

        {/* タブ（リピート / 月別推移 / 回数別） */}
        <div className="flex gap-0 mb-6 border-b">
          <button onClick={() => setViewMode('summary')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${viewMode === 'summary' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            リピート
          </button>
          <button onClick={() => setViewMode('monthly')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${viewMode === 'monthly' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            月別推移
          </button>
          <button onClick={() => setViewMode('patient')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${viewMode === 'patient' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            回数別
          </button>
        </div>

        <PatientFilter filters={filters} onChange={setFilters} filteredCount={filteredPatientRepeats.length} totalCount={patientRepeats.length} />

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">読み込み中...</div>
        ) : viewMode === 'summary' ? (
          /* ===== 集計テーブル (CSS売上集計リピートタブと完全に同じ形式) ===== */
          <div>
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-1">集計基準</p>
              <select value={criteria} onChange={e => setCriteria(e.target.value as CriteriaKey)}
                className="px-3 py-2 border border-gray-300 rounded text-sm min-w-[160px]">
                {CRITERIA_OPTIONS.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* モバイル: カード */}
            <div className="sm:hidden space-y-2">
              {summaryData.map(row => (
                <div key={row.label} className="bg-white rounded-xl shadow-sm p-3">
                  <p className="font-medium text-sm mb-2">{row.label}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div><span className="text-gray-400">施術回数</span><br/><span className="font-bold">{row.totalVisits}</span></div>
                    <div><span className="text-gray-400">カルテ枚数</span><br/><span className="font-bold">{row.patients}</span></div>
                    <div><span className="text-gray-400">平均リピート</span><br/><span className="font-bold">{row.avgRepeat}</span></div>
                  </div>
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {row.retentions.map((r, i) => (
                      <span key={i} className={`px-1.5 py-0.5 rounded ${r >= 70 ? 'bg-green-100 text-green-700' : r >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                        {i + 2}回目:{r > 0 ? `${r.toFixed(1)}%` : '-'}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="bg-gray-50 rounded-xl shadow-sm p-3 border-t-2 border-gray-300">
                <p className="font-bold text-sm mb-2">合計</p>
                <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                  <div><span className="text-gray-400">施術回数</span><br/><span className="font-bold">{totalSummary.totalVisits}</span></div>
                  <div><span className="text-gray-400">カルテ枚数</span><br/><span className="font-bold">{totalSummary.patients}</span></div>
                  <div><span className="text-gray-400">平均リピート</span><br/><span className="font-bold">{totalSummary.avgRepeat}</span></div>
                </div>
                <div className="flex flex-wrap gap-1 text-[10px]">
                  {totalSummary.retentions.map((r, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-bold">{i + 2}回目:{r.toFixed(1)}%</span>
                  ))}
                </div>
              </div>
            </div>

            {/* デスクトップ: テーブル（CSS売上集計と完全に同じ見た目） */}
            <div className="hidden sm:block border border-gray-300">
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-gray-300 bg-white">
                      <th className="text-left px-3 py-3 font-bold text-gray-800 sticky left-0 bg-white">集計項目</th>
                      <th className="text-left px-3 py-3 font-bold text-gray-800">施術回数</th>
                      <th className="text-left px-3 py-3 font-bold text-gray-800">カルテ枚数</th>
                      <th className="text-left px-3 py-3 font-bold text-gray-800">平均リピート数</th>
                      {Array.from({ length: 9 }, (_, i) => (
                        <th key={i} className="text-left px-3 py-3 font-bold text-gray-800">{i + 2}回目</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.map(row => (
                      <tr key={row.label} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-gray-700 sticky left-0 bg-white">{row.label}</td>
                        <td className="px-3 py-2.5 text-gray-700">{row.totalVisits}</td>
                        <td className="px-3 py-2.5 text-gray-700">{row.patients}</td>
                        <td className="px-3 py-2.5 text-gray-700">{row.avgRepeat}</td>
                        {row.retentions.map((r, i) => (
                          <td key={i} className="px-3 py-2.5 text-gray-700">
                            {r > 0 ? `${r.toFixed(1)}%` : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="border-t border-gray-300 bg-white">
                      <td className="px-3 py-2.5 text-gray-700 sticky left-0 bg-white">合計</td>
                      <td className="px-3 py-2.5 text-gray-700">{totalSummary.totalVisits}</td>
                      <td className="px-3 py-2.5 text-gray-700">{totalSummary.patients}</td>
                      <td className="px-3 py-2.5 text-gray-700">{totalSummary.avgRepeat}</td>
                      {totalSummary.retentions.map((r, i) => (
                        <td key={i} className="px-3 py-2.5 text-gray-700">{r.toFixed(1)}%</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : viewMode === 'patient' ? (
          <>
          {/* 来院回数分布 */}
          {filteredPatientRepeats.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <h3 className="font-bold text-gray-800 text-sm mb-3">来院回数分布</h3>
              <div className="space-y-2">
                {distBuckets.map(b => {
                  const count = countDist[b.key] || 0
                  const maxCount = Math.max(...Object.values(countDist), 1)
                  return (
                    <div key={b.key} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-16 text-right">{b.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 relative">
                        <div className="h-5 rounded-full flex items-center px-2"
                          style={{ width: `${maxCount > 0 ? (count / maxCount * 100) : 0}%`, background: '#14252A', minWidth: count > 0 ? '24px' : '0' }}>
                          {count > 0 && <span className="text-white text-[10px] font-bold">{count}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 w-8">{count}人</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <div className="sm:hidden space-y-2">
            {filteredPatientRepeats.map((p, i) => (
              <Link key={p.id} href={`/patients/${p.id}`} className="block bg-white rounded-xl shadow-sm p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs text-gray-400 mr-1">#{i + 1}</span>
                    <span className="font-medium text-sm text-blue-600">{p.name}</span>
                  </div>
                  <span className="font-bold text-sm" style={{ color: '#14252A' }}>{p.visitCount}回</span>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  <span>{p.totalRevenue.toLocaleString()}円</span>
                  <span>初回{p.firstVisit}</span>
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
                  <th className="text-right px-3 py-2 text-xs text-gray-500">来院回数</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">総売上</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500">初回</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500">最終</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatientRepeats.map((p, i) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Link href={`/patients/${p.id}`} className="text-blue-600 hover:underline font-medium">{p.name}</Link>
                    </td>
                    <td className="px-3 py-2 text-right font-bold">{p.visitCount}回</td>
                    <td className="px-3 py-2 text-right">{p.totalRevenue.toLocaleString()}円</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{p.firstVisit}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{p.lastVisit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          </>
        ) : (
          <>
          {/* 月別推移 */}
          <div className="sm:hidden space-y-2">
            {data.length === 0 ? (
              <p className="text-center py-8 text-gray-400">データがありません</p>
            ) : data.map(d => (
              <div key={d.month} className="bg-white rounded-xl shadow-sm p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-sm">{d.month}</span>
                  <span className="font-bold text-sm" style={{ color: '#14252A' }}>{d.repeatRate}%</span>
                </div>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>来院{d.totalVisits}件</span>
                  <span className="text-blue-600">新規{d.newPatients}人({d.newVisits}件)</span>
                  <span className="text-green-600">既存{d.repeatPatients}人({d.repeatVisits}件)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div className="h-2 rounded-full" style={{ width: `${d.repeatRate}%`, background: '#14252A' }} />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden sm:block bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 text-xs text-gray-500">月</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">総来院数</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">新規人数</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">新規回数</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">既存人数</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">既存回数</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">リピート率</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">データがありません</td></tr>
                ) : data.map(d => (
                  <tr key={d.month} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{d.month}</td>
                    <td className="px-3 py-2 text-right">{d.totalVisits}件</td>
                    <td className="px-3 py-2 text-right text-blue-600">{d.newPatients}人</td>
                    <td className="px-3 py-2 text-right text-blue-400">{d.newVisits}件</td>
                    <td className="px-3 py-2 text-right text-green-600">{d.repeatPatients}人</td>
                    <td className="px-3 py-2 text-right text-green-400">{d.repeatVisits}件</td>
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
          </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
