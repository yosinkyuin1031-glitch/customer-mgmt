'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { fetchAllSlips } from '@/lib/fetchAll'
import { saleTabs } from '@/lib/saleTabs'
import { getClinicId } from '@/lib/clinic'
import PatientFilter, { usePatientFilter, filterPatientIds, type PatientForFilter } from '@/components/PatientFilter'

interface PatientLTV {
  id: string
  name: string
  visitCount: number
  ltv: number
  avgPrice: number
  firstVisit: string
  lastVisit: string
  daysSince: number | null
}

interface SlipRow {
  patient_id: string
  patient_name: string
  visit_date: string
  total_price: number
}

interface PatientRow {
  id: string
  name: string
  ltv: number | null
  visit_count: number | null
  first_visit_date: string | null
  last_visit_date: string | null
  gender: string | null
  birth_date: string | null
  visit_motive: string | null
  occupation: string | null
  chief_complaint: string | null
  referral_source: string | null
  prefecture: string | null
}

type PeriodKey = 'all' | '1m' | '3m' | '6m' | '1y' | 'custom'
type ViewMode = 'list' | 'summary'
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

function getCriteriaValue(p: PatientRow, criteria: CriteriaKey): string {
  switch (criteria) {
    case 'referral_source': return p.referral_source || p.visit_motive || '未設定'
    case 'occupation': return p.occupation || '未設定'
    case 'chief_complaint': return p.chief_complaint || '未設定'
    case 'gender': return p.gender || '未設定'
    case 'age': return getAge(p.birth_date)
    case 'prefecture': return p.prefecture || '未設定'
  }
}

function getDateRange(period: PeriodKey, customFrom: string, customTo: string): { from: string | null; to: string | null } {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const to = fmt(today)
  switch (period) {
    case '1m': { const d = new Date(today); d.setMonth(d.getMonth() - 1); return { from: fmt(d), to } }
    case '3m': { const d = new Date(today); d.setMonth(d.getMonth() - 3); return { from: fmt(d), to } }
    case '6m': { const d = new Date(today); d.setMonth(d.getMonth() - 6); return { from: fmt(d), to } }
    case '1y': { const d = new Date(today); d.setFullYear(d.getFullYear() - 1); return { from: fmt(d), to } }
    case 'custom': return { from: customFrom || null, to: customTo || to }
    default: return { from: null, to: null }
  }
}

export default function LtvPage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const [allSlips, setAllSlips] = useState<SlipRow[]>([])
  const [patientData, setPatientData] = useState<PatientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<'ltv' | 'visit_count' | 'days'>('ltv')
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const { filters, setFilters } = usePatientFilter()
  const [viewMode, setViewMode] = useState<ViewMode>('summary')
  const [criteria, setCriteria] = useState<CriteriaKey>('referral_source')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [slips, { data: patients }] = await Promise.all([
        fetchAllSlips(supabase, 'patient_id, patient_name, visit_date, total_price') as Promise<SlipRow[]>,
        supabase
          .from('cm_patients')
          .select('id, name, ltv, visit_count, first_visit_date, last_visit_date, gender, birth_date, visit_motive, occupation, chief_complaint, referral_source, prefecture')
          .eq('clinic_id', clinicId)
      ])
      setPatientData(patients || [])
      setAllSlips(slips || [])
      setLoading(false)
    }
    load()
  }, [])

  const filteredPatientIds = useMemo(() => {
    const patientsForFilter: PatientForFilter[] = patientData.map(p => ({
      id: p.id,
      gender: p.gender || undefined,
      birth_date: p.birth_date,
      visit_motive: p.visit_motive || undefined,
      occupation: p.occupation || undefined,
      chief_complaint: p.chief_complaint || undefined,
    }))
    return filterPatientIds(patientsForFilter, filters)
  }, [patientData, filters])

  const patients = useMemo(() => {
    const isAllPeriod = period === 'all'

    if (isAllPeriod) {
      const slipMap: Record<string, { count: number; revenue: number; first: string; last: string }> = {}
      allSlips.forEach(s => {
        if (!s.patient_id) return
        if (!slipMap[s.patient_id]) {
          slipMap[s.patient_id] = { count: 0, revenue: 0, first: s.visit_date, last: s.visit_date }
        }
        if (s.total_price > 0) {
          slipMap[s.patient_id].count++
          slipMap[s.patient_id].revenue += s.total_price
        }
        if (s.visit_date < slipMap[s.patient_id].first) slipMap[s.patient_id].first = s.visit_date
        if (s.visit_date > slipMap[s.patient_id].last) slipMap[s.patient_id].last = s.visit_date
      })

      const now = Date.now()
      return patientData
        .filter(p => filteredPatientIds.has(p.id) && ((p.ltv && p.ltv > 0) || (slipMap[p.id]?.revenue > 0)))
        .map((p): PatientLTV & { _raw: PatientRow } => {
          const slip = slipMap[p.id]
          const ltvFromSlips = slip?.revenue || 0
          const ltv = Math.max(p.ltv || 0, ltvFromSlips)
          const visitCount = p.visit_count || slip?.count || 0
          const firstVisit = p.first_visit_date || slip?.first || ''
          const lastVisit = p.last_visit_date || slip?.last || ''
          const actualLast = slip?.last && (!lastVisit || slip.last > lastVisit) ? slip.last : lastVisit
          const actualFirst = slip?.first && (!firstVisit || slip.first < firstVisit) ? slip.first : firstVisit

          return {
            id: p.id,
            name: p.name,
            visitCount,
            ltv,
            avgPrice: visitCount > 0 ? Math.round(ltv / visitCount) : 0,
            firstVisit: actualFirst,
            lastVisit: actualLast,
            daysSince: actualLast ? Math.floor((now - new Date(actualLast).getTime()) / (24 * 60 * 60 * 1000)) : null,
            _raw: p,
          }
        })
        .sort((a, b) => b.ltv - a.ltv)
    }

    if (allSlips.length === 0) return []
    const { from, to } = getDateRange(period, customFrom, customTo)

    const patientById: Record<string, PatientRow> = {}
    patientData.forEach(p => { patientById[p.id] = p })

    const filtered = allSlips.filter(s => {
      if (!s.patient_id) return false
      if (from && s.visit_date < from) return false
      if (to && s.visit_date > to) return false
      return true
    })

    const patMap: Record<string, { count: number; revenue: number; first: string; last: string; name: string }> = {}
    filtered.forEach(s => {
      const pid = s.patient_id
      if (!patMap[pid]) {
        patMap[pid] = { count: 0, revenue: 0, first: s.visit_date, last: s.visit_date, name: patientById[pid]?.name || s.patient_name || '不明' }
      }
      if (s.total_price > 0) {
        patMap[pid].count++
        patMap[pid].revenue += s.total_price
      }
      if (s.visit_date < patMap[pid].first) patMap[pid].first = s.visit_date
      if (s.visit_date > patMap[pid].last) patMap[pid].last = s.visit_date
    })

    const now = Date.now()
    return Object.entries(patMap)
      .filter(([id, d]) => d.revenue > 0 && filteredPatientIds.has(id))
      .map(([id, d]): PatientLTV & { _raw: PatientRow } => ({
        id,
        name: d.name,
        visitCount: d.count,
        ltv: d.revenue,
        avgPrice: d.count > 0 ? Math.round(d.revenue / d.count) : 0,
        firstVisit: d.first,
        lastVisit: d.last,
        daysSince: Math.floor((now - new Date(d.last).getTime()) / (24 * 60 * 60 * 1000)),
        _raw: patientById[id] || {} as PatientRow,
      }))
      .sort((a, b) => b.ltv - a.ltv)
  }, [allSlips, patientData, period, customFrom, customTo, filteredPatientIds])

  // === 集計テーブルデータ ===
  const summaryData = useMemo(() => {
    const groups: Record<string, { patients: number; revenue: number }> = {}
    for (const p of patients) {
      const key = getCriteriaValue(p._raw, criteria)
      if (!groups[key]) groups[key] = { patients: 0, revenue: 0 }
      groups[key].patients++
      groups[key].revenue += p.ltv
    }
    return Object.entries(groups)
      .map(([label, data]) => ({
        label,
        patients: data.patients,
        revenue: data.revenue,
        avgLtv: data.patients > 0 ? Math.round(data.revenue / data.patients) : 0,
      }))
      .sort((a, b) => b.avgLtv - a.avgLtv)
  }, [patients, criteria])

  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 50

  useEffect(() => { setCurrentPage(1) }, [patients.length, sortKey])

  const sorted = [...patients].sort((a, b) => {
    if (sortKey === 'ltv') return b.ltv - a.ltv
    if (sortKey === 'visit_count') return b.visitCount - a.visitCount
    return (b.daysSince ?? 0) - (a.daysSince ?? 0)
  })

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE)
  const paginatedSorted = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE + 1
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, sorted.length)

  const totalLTV = patients.reduce((sum, p) => sum + p.ltv, 0)
  const avgLTV = patients.length > 0 ? Math.round(totalLTV / patients.length) : 0

  const periodLabel = (() => {
    const { from, to } = getDateRange(period, customFrom, customTo)
    if (!from) return '全期間'
    return `${from} 〜 ${to}`
  })()

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2 border-b">
          {saleTabs.map(tab => (
            <Link key={tab.href} href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                tab.href === '/sales/ltv' ? 'bg-[#14252A] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}>{tab.label}</Link>
          ))}
        </div>

        <h2 className="font-bold text-gray-800 text-lg mb-3">LTV（顧客生涯価値）分析</h2>

        {/* 期間選択 */}
        <div className="bg-white rounded-xl shadow-sm p-3 mb-4">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-gray-500 mr-1">期間:</span>
            {([
              { key: 'all' as PeriodKey, label: '全期間' },
              { key: '1m' as PeriodKey, label: '1ヶ月' },
              { key: '3m' as PeriodKey, label: '3ヶ月' },
              { key: '6m' as PeriodKey, label: '6ヶ月' },
              { key: '1y' as PeriodKey, label: '1年' },
              { key: 'custom' as PeriodKey, label: 'カスタム' },
            ]).map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  period === p.key ? 'bg-[#14252A] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >{p.label}</button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex gap-2 mt-2 items-center">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
              <span className="text-xs text-gray-400">〜</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>
          )}
          {period !== 'all' && (
            <p className="text-xs text-gray-400 mt-1.5">{periodLabel}</p>
          )}
        </div>

        <PatientFilter filters={filters} onChange={setFilters} filteredCount={patients.length} totalCount={patientData.length} />

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold" style={{ color: '#14252A' }}>{avgLTV.toLocaleString()}<span className="text-xs sm:text-sm">円</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">平均LTV</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-blue-600">{patients.length}<span className="text-xs sm:text-sm">人</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">対象患者数</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-green-600">{totalLTV.toLocaleString()}<span className="text-xs sm:text-sm">円</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">総LTV</p>
          </div>
        </div>

        {/* 表示モード切替 */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setViewMode('summary')}
            className={`px-4 py-2 rounded-lg text-xs font-medium ${viewMode === 'summary' ? 'bg-[#14252A] text-white' : 'bg-gray-100 text-gray-600'}`}>
            集計テーブル
          </button>
          <button onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-xs font-medium ${viewMode === 'list' ? 'bg-[#14252A] text-white' : 'bg-gray-100 text-gray-600'}`}>
            患者一覧
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400 text-sm">読み込み中...</div>
        ) : viewMode === 'summary' ? (
          /* ===== 集計テーブル (CSS売上集計と同じ形式) ===== */
          <div>
            <div className="mb-3">
              <label className="text-xs text-gray-500 mr-2">集計基準</label>
              <select value={criteria} onChange={e => setCriteria(e.target.value as CriteriaKey)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                {CRITERIA_OPTIONS.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* モバイル: カード */}
            <div className="sm:hidden space-y-2">
              {summaryData.map(row => (
                <div key={row.label} className="bg-white rounded-xl shadow-sm p-3">
                  <p className="font-medium text-sm mb-1">{row.label}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-gray-400">カルテ枚数</span><br/><span className="font-bold">{row.patients}</span></div>
                    <div><span className="text-gray-400">売上合計</span><br/><span className="font-bold">&yen;{row.revenue.toLocaleString()}</span></div>
                    <div><span className="text-gray-400">平均LTV</span><br/><span className="font-bold">&yen;{row.avgLtv.toLocaleString()}</span></div>
                  </div>
                </div>
              ))}
              {/* 合計 */}
              <div className="bg-gray-50 rounded-xl shadow-sm p-3 border-t-2 border-gray-300">
                <p className="font-bold text-sm mb-1">合計</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-gray-400">カルテ枚数</span><br/><span className="font-bold">{patients.length}</span></div>
                  <div><span className="text-gray-400">売上合計</span><br/><span className="font-bold">&yen;{totalLTV.toLocaleString()}</span></div>
                  <div><span className="text-gray-400">平均LTV</span><br/><span className="font-bold">&yen;{avgLTV.toLocaleString()}</span></div>
                </div>
              </div>
            </div>

            {/* デスクトップ: テーブル */}
            <div className="hidden sm:block bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">集計項目</th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">カルテ枚数</th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">売上合計</th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">平均LTV</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.map(row => (
                    <tr key={row.label} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2.5">{row.label}</td>
                      <td className="px-4 py-2.5 text-right">{row.patients}</td>
                      <td className="px-4 py-2.5 text-right">&yen;{row.revenue.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-medium">&yen;{row.avgLtv.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                    <td className="px-4 py-2.5">合計</td>
                    <td className="px-4 py-2.5 text-right">{patients.length}</td>
                    <td className="px-4 py-2.5 text-right">&yen;{totalLTV.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">&yen;{avgLTV.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ===== 患者一覧 (既存ビュー) ===== */
          <>
            <div className="flex gap-2 mb-3">
              <span className="text-xs text-gray-500 pt-1">並び替え:</span>
              {[
                { key: 'ltv' as const, label: '総売上' },
                { key: 'visit_count' as const, label: '来院数' },
                { key: 'days' as const, label: '最終来院' },
              ].map(s => (
                <button key={s.key} onClick={() => setSortKey(s.key)}
                  className={`px-3 py-1 rounded text-xs ${sortKey === s.key ? 'bg-[#14252A] text-white' : 'bg-gray-100 text-gray-600'}`}
                >{s.label}</button>
              ))}
            </div>

            <div className="sm:hidden space-y-2">
              {paginatedSorted.map((p, i) => (
                <Link key={p.id} href={`/patients/${p.id}`} className="block bg-white rounded-xl shadow-sm p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs text-gray-400 mr-1">#{startIndex + i}</span>
                      <span className="font-medium text-sm text-blue-600">{p.name}</span>
                    </div>
                    <p className="font-bold text-sm" style={{ color: '#14252A' }}>{p.ltv.toLocaleString()}円</p>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    <span>{p.visitCount}回</span>
                    <span>平均{p.avgPrice.toLocaleString()}円</span>
                    <span>{p.firstVisit}〜</span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="hidden sm:block bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto scroll-hint">
              <table className="w-full text-sm sticky-header">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-3 py-2 text-xs text-gray-500">#</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">患者名</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">来院数</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">総売上</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">平均単価</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">初回</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">最終</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">経過</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSorted.map((p, i) => (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400">{startIndex + i}</td>
                      <td className="px-3 py-2 font-medium">
                        <Link href={`/patients/${p.id}`} className="text-blue-600 hover:underline">{p.name}</Link>
                      </td>
                      <td className="px-3 py-2 text-right">{p.visitCount}回</td>
                      <td className="px-3 py-2 text-right font-medium">{p.ltv.toLocaleString()}円</td>
                      <td className="px-3 py-2 text-right">{p.avgPrice.toLocaleString()}円</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{p.firstVisit}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{p.lastVisit}</td>
                      <td className="px-3 py-2 text-right text-xs">
                        {p.daysSince !== null ? `${p.daysSince}日` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            {sorted.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-between mt-4 px-1">
                <p className="text-xs text-gray-500">全{sorted.length}件中 {startIndex}-{endIndex}件</p>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                    前へ
                  </button>
                  <span className="px-2 py-1.5 text-xs text-gray-500">{currentPage} / {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                    次へ
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
