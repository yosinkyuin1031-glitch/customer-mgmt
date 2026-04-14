'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { getClinicId } from '@/lib/clinic'
import { saleTabs } from '@/lib/saleTabs'
import { fetchAllSlips } from '@/lib/fetchAll'

interface MonthlyData {
  month: string
  newRevenue: number
  existingRevenue: number
  totalRevenue: number
  newCount: number
  existingCount: number
  newRatio: number
}

interface YearlyData {
  year: string
  newRevenue: number
  existingRevenue: number
  totalRevenue: number
  newCount: number
  existingCount: number
  newRatio: number
}

export default function NewExistingPage() {
  const supabase = createClient()
  const [data, setData] = useState<MonthlyData[]>([])
  const [yearlyData, setYearlyData] = useState<YearlyData[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly' | 'compare'>('monthly')
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [compareYear1, setCompareYear1] = useState<string>('')
  const [compareYear2, setCompareYear2] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const slips = await fetchAllSlips(supabase, 'patient_id, visit_date, total_price') as { patient_id: string; visit_date: string; total_price: number }[]

      if (!slips || slips.length === 0) { setLoading(false); return }

      const { data: patients } = await supabase
        .from('cm_patients')
        .select('id, first_visit_date')
        .eq('clinic_id', getClinicId())
      const patientFirstVisit: Record<string, string> = {}
      if (patients) {
        patients.forEach(p => {
          if (p.first_visit_date) {
            patientFirstVisit[p.id] = p.first_visit_date.slice(0, 7)
          }
        })
      }

      slips.forEach(s => {
        if (!s.patient_id) return
        if (patientFirstVisit[s.patient_id]) return
        const month = s.visit_date.slice(0, 7)
        if (!patientFirstVisit[s.patient_id] || month < patientFirstVisit[s.patient_id]) {
          patientFirstVisit[s.patient_id] = month
        }
      })

      const monthMap: Record<string, { newRev: number, existRev: number, newCount: number, existCount: number }> = {}

      slips.forEach(s => {
        const month = s.visit_date.slice(0, 7)
        if (!monthMap[month]) monthMap[month] = { newRev: 0, existRev: 0, newCount: 0, existCount: 0 }
        const amount = s.total_price || 0

        if (s.patient_id && patientFirstVisit[s.patient_id] === month) {
          monthMap[month].newRev += amount
          monthMap[month].newCount++
        } else {
          monthMap[month].existRev += amount
          monthMap[month].existCount++
        }
      })

      const result: MonthlyData[] = Object.entries(monthMap)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, d]) => ({
          month,
          newRevenue: d.newRev,
          existingRevenue: d.existRev,
          totalRevenue: d.newRev + d.existRev,
          newCount: d.newCount,
          existingCount: d.existCount,
          newRatio: (d.newRev + d.existRev) > 0
            ? Math.round((d.newRev / (d.newRev + d.existRev)) * 100)
            : 0,
        }))

      setData(result)

      const yearMap: Record<string, { newRev: number, existRev: number, newCount: number, existCount: number }> = {}
      result.forEach(d => {
        const year = d.month.slice(0, 4)
        if (!yearMap[year]) yearMap[year] = { newRev: 0, existRev: 0, newCount: 0, existCount: 0 }
        yearMap[year].newRev += d.newRevenue
        yearMap[year].existRev += d.existingRevenue
        yearMap[year].newCount += d.newCount
        yearMap[year].existCount += d.existingCount
      })
      const yearResult: YearlyData[] = Object.entries(yearMap)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([year, d]) => ({
          year,
          newRevenue: d.newRev,
          existingRevenue: d.existRev,
          totalRevenue: d.newRev + d.existRev,
          newCount: d.newCount,
          existingCount: d.existCount,
          newRatio: (d.newRev + d.existRev) > 0
            ? Math.round((d.newRev / (d.newRev + d.existRev)) * 100)
            : 0,
        }))
      setYearlyData(yearResult)

      // 対比の初期値
      const years = [...new Set(result.map(d => d.month.slice(0, 4)))].sort((a, b) => b.localeCompare(a))
      if (years.length >= 2) {
        setCompareYear1(years[0])
        setCompareYear2(years[1])
      } else if (years.length === 1) {
        setCompareYear1(years[0])
        setCompareYear2(years[0])
      }

      setLoading(false)
    }
    load()
  }, [])

  const availableYears = [...new Set(data.map(d => d.month.slice(0, 4)))].sort((a, b) => b.localeCompare(a))

  const filteredMonthly = selectedYear === 'all' ? data : data.filter(d => d.month.startsWith(selectedYear))
  const displayData = viewMode === 'yearly' ? yearlyData : filteredMonthly
  const totalNew = displayData.reduce((s, d) => s + d.newRevenue, 0)
  const totalExisting = displayData.reduce((s, d) => s + d.existingRevenue, 0)
  const totalAll = totalNew + totalExisting
  const newRatioTotal = totalAll > 0 ? Math.round((totalNew / totalAll) * 100) : 0

  // 対比用データ
  const compareData1 = data.filter(d => d.month.startsWith(compareYear1))
  const compareData2 = data.filter(d => d.month.startsWith(compareYear2))
  const months = ['01','02','03','04','05','06','07','08','09','10','11','12']

  const getMonthData = (yearData: MonthlyData[], mm: string) =>
    yearData.find(d => d.month.endsWith('-' + mm))

  const sum = (arr: MonthlyData[]) => ({
    newRevenue: arr.reduce((s, d) => s + d.newRevenue, 0),
    existingRevenue: arr.reduce((s, d) => s + d.existingRevenue, 0),
    totalRevenue: arr.reduce((s, d) => s + d.totalRevenue, 0),
    newCount: arr.reduce((s, d) => s + d.newCount, 0),
    existingCount: arr.reduce((s, d) => s + d.existingCount, 0),
  })
  const sum1 = sum(compareData1)
  const sum2 = sum(compareData2)

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2 border-b">
          {saleTabs.map(tab => (
            <Link key={tab.href} href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                tab.href === '/sales/new-existing' ? 'bg-[#14252A] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >{tab.label}</Link>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-bold text-gray-800 text-lg">新規売上 / 既存売上</h2>
          <div className="flex items-center gap-2">
            {viewMode === 'monthly' && (
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded-md text-xs">
                <option value="all">全期間</option>
                {availableYears.map(y => <option key={y} value={y}>{y}年</option>)}
              </select>
            )}
            {viewMode === 'compare' && (
              <>
                <select value={compareYear1} onChange={(e) => setCompareYear1(e.target.value)}
                  className="px-2 py-1 border border-blue-400 rounded-md text-xs bg-blue-50">
                  {availableYears.map(y => <option key={y} value={y}>{y}年</option>)}
                </select>
                <span className="text-xs text-gray-400">vs</span>
                <select value={compareYear2} onChange={(e) => setCompareYear2(e.target.value)}
                  className="px-2 py-1 border border-orange-400 rounded-md text-xs bg-orange-50">
                  {availableYears.map(y => <option key={y} value={y}>{y}年</option>)}
                </select>
              </>
            )}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setViewMode('monthly')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'monthly' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
              >月別</button>
              <button onClick={() => setViewMode('yearly')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'yearly' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
              >年別</button>
              <button onClick={() => setViewMode('compare')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'compare' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
              >対比</button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">読み込み中...</div>
        ) : viewMode === 'compare' ? (
          /* ===== 年対比表示 ===== */
          <div>
            {/* 対比サマリー */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <p className="text-xs text-blue-600 font-medium mb-2">{compareYear1}年</p>
                <p className="text-2xl font-bold text-gray-800">{sum1.totalRevenue.toLocaleString()}円</p>
                <div className="flex gap-3 mt-1 text-xs">
                  <span className="text-blue-600">新規 {sum1.newRevenue.toLocaleString()}円</span>
                  <span className="text-green-600">既存 {sum1.existingRevenue.toLocaleString()}円</span>
                </div>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <p className="text-xs text-orange-600 font-medium mb-2">{compareYear2}年</p>
                <p className="text-2xl font-bold text-gray-800">{sum2.totalRevenue.toLocaleString()}円</p>
                <div className="flex gap-3 mt-1 text-xs">
                  <span className="text-blue-600">新規 {sum2.newRevenue.toLocaleString()}円</span>
                  <span className="text-green-600">既存 {sum2.existingRevenue.toLocaleString()}円</span>
                </div>
              </div>
            </div>

            {/* 差分 */}
            {compareYear1 !== compareYear2 && (() => {
              const diff = sum1.totalRevenue - sum2.totalRevenue
              const pct = sum2.totalRevenue > 0 ? Math.round((diff / sum2.totalRevenue) * 100) : 0
              return (
                <div className={`rounded-xl p-3 mb-4 text-center text-sm font-bold ${diff >= 0 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  前年比 {diff >= 0 ? '+' : ''}{diff.toLocaleString()}円（{diff >= 0 ? '+' : ''}{pct}%）
                </div>
              )
            })()}

            {/* 月別対比テーブル */}
            <div className="sm:hidden space-y-2">
              {months.map(mm => {
                const d1 = getMonthData(compareData1, mm)
                const d2 = getMonthData(compareData2, mm)
                if (!d1 && !d2) return null
                const diff = (d1?.totalRevenue || 0) - (d2?.totalRevenue || 0)
                return (
                  <div key={mm} className="bg-white rounded-xl shadow-sm p-3">
                    <p className="font-medium text-sm mb-2">{parseInt(mm)}月</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-blue-500">{compareYear1}</span><br/>
                        <span className="font-bold">{d1 ? d1.totalRevenue.toLocaleString() + '円' : '-'}</span>
                      </div>
                      <div>
                        <span className="text-orange-500">{compareYear2}</span><br/>
                        <span className="font-bold">{d2 ? d2.totalRevenue.toLocaleString() + '円' : '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">差</span><br/>
                        <span className={`font-bold ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {diff >= 0 ? '+' : ''}{diff.toLocaleString()}円
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="hidden sm:block bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-3 py-2 text-xs text-gray-500">月</th>
                    <th className="text-right px-3 py-2 text-xs text-blue-600">{compareYear1}年 総売上</th>
                    <th className="text-right px-3 py-2 text-xs text-blue-600">新規</th>
                    <th className="text-right px-3 py-2 text-xs text-blue-600">既存</th>
                    <th className="text-right px-3 py-2 text-xs text-orange-600">{compareYear2}年 総売上</th>
                    <th className="text-right px-3 py-2 text-xs text-orange-600">新規</th>
                    <th className="text-right px-3 py-2 text-xs text-orange-600">既存</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">差額</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">前年比</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map(mm => {
                    const d1 = getMonthData(compareData1, mm)
                    const d2 = getMonthData(compareData2, mm)
                    if (!d1 && !d2) return null
                    const t1 = d1?.totalRevenue || 0
                    const t2 = d2?.totalRevenue || 0
                    const diff = t1 - t2
                    const pct = t2 > 0 ? Math.round((diff / t2) * 100) : (t1 > 0 ? 100 : 0)
                    return (
                      <tr key={mm} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{parseInt(mm)}月</td>
                        <td className="px-3 py-2 text-right font-medium">{d1 ? t1.toLocaleString() + '円' : '-'}</td>
                        <td className="px-3 py-2 text-right text-blue-600 text-xs">{d1 ? d1.newRevenue.toLocaleString() : '-'}</td>
                        <td className="px-3 py-2 text-right text-green-600 text-xs">{d1 ? d1.existingRevenue.toLocaleString() : '-'}</td>
                        <td className="px-3 py-2 text-right font-medium">{d2 ? t2.toLocaleString() + '円' : '-'}</td>
                        <td className="px-3 py-2 text-right text-blue-600 text-xs">{d2 ? d2.newRevenue.toLocaleString() : '-'}</td>
                        <td className="px-3 py-2 text-right text-green-600 text-xs">{d2 ? d2.existingRevenue.toLocaleString() : '-'}</td>
                        <td className={`px-3 py-2 text-right font-medium ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {diff >= 0 ? '+' : ''}{diff.toLocaleString()}円
                        </td>
                        <td className={`px-3 py-2 text-right text-xs ${pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {t2 > 0 || t1 > 0 ? `${pct >= 0 ? '+' : ''}${pct}%` : '-'}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <td className="px-3 py-2">合計</td>
                    <td className="px-3 py-2 text-right">{sum1.totalRevenue.toLocaleString()}円</td>
                    <td className="px-3 py-2 text-right text-blue-600 text-xs">{sum1.newRevenue.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-green-600 text-xs">{sum1.existingRevenue.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{sum2.totalRevenue.toLocaleString()}円</td>
                    <td className="px-3 py-2 text-right text-blue-600 text-xs">{sum2.newRevenue.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-green-600 text-xs">{sum2.existingRevenue.toLocaleString()}</td>
                    <td className={`px-3 py-2 text-right ${sum1.totalRevenue - sum2.totalRevenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {sum1.totalRevenue - sum2.totalRevenue >= 0 ? '+' : ''}{(sum1.totalRevenue - sum2.totalRevenue).toLocaleString()}円
                    </td>
                    <td className={`px-3 py-2 text-right text-xs ${sum1.totalRevenue - sum2.totalRevenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {sum2.totalRevenue > 0 ? `${Math.round(((sum1.totalRevenue - sum2.totalRevenue) / sum2.totalRevenue) * 100)}%` : '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
          </div>
        ) : (
          /* ===== 月別・年別表示 ===== */
          <>
            {/* サマリー */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
              <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
                <p className="text-lg sm:text-2xl font-bold text-blue-600">{totalNew.toLocaleString()}<span className="text-xs sm:text-sm">円</span></p>
                <p className="text-[10px] sm:text-xs text-gray-500">新規売上合計</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
                <p className="text-lg sm:text-2xl font-bold text-green-600">{totalExisting.toLocaleString()}<span className="text-xs sm:text-sm">円</span></p>
                <p className="text-[10px] sm:text-xs text-gray-500">既存売上合計</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
                <p className="text-lg sm:text-2xl font-bold" style={{ color: '#14252A' }}>{totalAll.toLocaleString()}<span className="text-xs sm:text-sm">円</span></p>
                <p className="text-[10px] sm:text-xs text-gray-500">総売上</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
                <p className="text-lg sm:text-2xl font-bold text-orange-600">{newRatioTotal}<span className="text-xs sm:text-sm">%</span></p>
                <p className="text-[10px] sm:text-xs text-gray-500">新規比率</p>
              </div>
            </div>

            {/* 新規/既存バー */}
            {totalAll > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
                <div className="flex h-8 rounded-lg overflow-hidden">
                  <div className="bg-blue-500 flex items-center justify-center text-white text-xs font-bold"
                    style={{ width: `${newRatioTotal}%` }}>
                    {newRatioTotal > 10 && `新規 ${newRatioTotal}%`}
                  </div>
                  <div className="bg-green-500 flex items-center justify-center text-white text-xs font-bold"
                    style={{ width: `${100 - newRatioTotal}%` }}>
                    {(100 - newRatioTotal) > 10 && `既存 ${100 - newRatioTotal}%`}
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>新規: {totalNew.toLocaleString()}円</span>
                  <span>既存: {totalExisting.toLocaleString()}円</span>
                </div>
              </div>
            )}

            {/* モバイル: カード表示 */}
            <div className="sm:hidden space-y-2">
              {displayData.length === 0 ? (
                <p className="text-center py-8 text-gray-400">データがありません</p>
              ) : displayData.map(d => {
                const label = 'month' in d ? (d as MonthlyData).month : (d as YearlyData).year + '年'
                const key = 'month' in d ? (d as MonthlyData).month : (d as YearlyData).year
                return (
                  <div key={key} className="bg-white rounded-xl shadow-sm p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-sm">{label}</span>
                      <span className="font-bold text-sm">{d.totalRevenue.toLocaleString()}円</span>
                    </div>
                    <div className="flex h-4 rounded overflow-hidden mb-1">
                      <div className="bg-blue-500" style={{ width: `${d.newRatio}%` }} />
                      <div className="bg-green-500" style={{ width: `${100 - d.newRatio}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span className="text-blue-600">新規 {d.newRevenue.toLocaleString()}円 ({d.newCount}件)</span>
                      <span className="text-green-600">既存 {d.existingRevenue.toLocaleString()}円 ({d.existingCount}件)</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* PC: テーブル表示 */}
            <div className="hidden sm:block bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-3 py-2 text-xs text-gray-500">{viewMode === 'yearly' ? '年' : '月'}</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">新規売上</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">新規件数</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">既存売上</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">既存件数</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">総売上</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">新規比率</th>
                    <th className="px-3 py-2 text-xs text-gray-500 w-32">構成比</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400">データがありません</td></tr>
                  ) : displayData.map(d => {
                    const label = 'month' in d ? (d as MonthlyData).month : (d as YearlyData).year + '年'
                    const key = 'month' in d ? (d as MonthlyData).month : (d as YearlyData).year
                    return (
                      <tr key={key} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{label}</td>
                        <td className="px-3 py-2 text-right text-blue-600">{d.newRevenue.toLocaleString()}円</td>
                        <td className="px-3 py-2 text-right text-blue-600">{d.newCount}件</td>
                        <td className="px-3 py-2 text-right text-green-600">{d.existingRevenue.toLocaleString()}円</td>
                        <td className="px-3 py-2 text-right text-green-600">{d.existingCount}件</td>
                        <td className="px-3 py-2 text-right font-medium">{d.totalRevenue.toLocaleString()}円</td>
                        <td className="px-3 py-2 text-right">{d.newRatio}%</td>
                        <td className="px-3 py-2">
                          <div className="flex h-3 rounded overflow-hidden">
                            <div className="bg-blue-500" style={{ width: `${d.newRatio}%` }} />
                            <div className="bg-green-500" style={{ width: `${100 - d.newRatio}%` }} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
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
