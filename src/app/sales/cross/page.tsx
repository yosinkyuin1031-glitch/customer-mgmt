'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { saleTabs } from '@/lib/saleTabs'
import { fetchAllSlips } from '@/lib/fetchAll'

type CrossAxis = 'referral_source' | 'gender' | 'occupation' | 'staff_name'
const axisOptions: { key: CrossAxis, label: string }[] = [
  { key: 'referral_source', label: '来院経路' },
  { key: 'gender', label: '性別' },
  { key: 'occupation', label: '職業' },
  { key: 'staff_name', label: '担当者' },
]

interface CrossResult {
  label: string
  count: number
  revenue: number
  avgRevenue: number
}

export default function CrossPage() {
  const supabase = createClient()
  const [rowAxis, setRowAxis] = useState<CrossAxis>('referral_source')
  const [results, setResults] = useState<CrossResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const startDate = selectedMonth + '-01'
      const d = new Date(startDate)
      d.setMonth(d.getMonth() + 1)
      d.setDate(0)
      const endDate = d.toISOString().split('T')[0]

      // 来院経路・性別・職業は患者テーブル、支払方法・反応は施術記録テーブル
      const patientFields: CrossAxis[] = ['referral_source', 'gender', 'occupation']

      if (patientFields.includes(rowAxis)) {
        const slips = await fetchAllSlips(supabase, 'patient_id, total_price', {
          gte: ['visit_date', startDate],
          lte: ['visit_date', endDate],
        }) as { patient_id: string; total_price: number }[]

        if (!slips || slips.length === 0) { setLoading(false); return }

        // 患者情報を取得
        const patientIds = [...new Set(slips.map(s => s.patient_id).filter(Boolean))]
        const { data: patientsData } = await supabase
          .from('cm_patients')
          .select('id, referral_source, gender, occupation')
          .in('id', patientIds)

        const patientMap: Record<string, Record<string, string>> = {}
        patientsData?.forEach(p => { patientMap[p.id] = p })

        const map: Record<string, { count: number, revenue: number }> = {}
        slips.forEach(s => {
          const patient = s.patient_id ? patientMap[s.patient_id] : null
          const key = (patient?.[rowAxis] as string) || '不明'
          if (!map[key]) map[key] = { count: 0, revenue: 0 }
          map[key].count++
          map[key].revenue += s.total_price || 0
        })

        setResults(Object.entries(map).map(([label, d]) => ({
          label,
          count: d.count,
          revenue: d.revenue,
          avgRevenue: d.count > 0 ? Math.round(d.revenue / d.count) : 0,
        })).sort((a, b) => b.revenue - a.revenue))
      } else {
        // staff_name で集計
        const slips = await fetchAllSlips(supabase, 'staff_name, total_price', {
          gte: ['visit_date', startDate],
          lte: ['visit_date', endDate],
        }) as { staff_name: string; total_price: number }[]

        if (!slips || slips.length === 0) { setLoading(false); return }

        const map: Record<string, { count: number, revenue: number }> = {}
        slips.forEach(s => {
          const key = s.staff_name || '不明'
          if (!map[key]) map[key] = { count: 0, revenue: 0 }
          map[key].count++
          map[key].revenue += s.total_price || 0
        })

        setResults(Object.entries(map).map(([label, d]) => ({
          label,
          count: d.count,
          revenue: d.revenue,
          avgRevenue: d.count > 0 ? Math.round(d.revenue / d.count) : 0,
        })).sort((a, b) => b.revenue - a.revenue))
      }

      setLoading(false)
    }
    load()
  }, [rowAxis, selectedMonth])

  const totalCount = results.reduce((s, r) => s + r.count, 0)
  const totalRevenue = results.reduce((s, r) => s + r.revenue, 0)

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2 border-b">
          {saleTabs.map(tab => (
            <Link key={tab.href} href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                tab.href === '/sales/cross' ? 'bg-[#14252A] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >{tab.label}</Link>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 text-lg">クロス集計</h2>
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm" />
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          <span className="text-xs text-gray-500 pt-1">集計軸:</span>
          {axisOptions.map(a => (
            <button key={a.key} onClick={() => setRowAxis(a.key)}
              className={`px-3 py-1 rounded text-xs font-medium ${
                rowAxis === a.key ? 'bg-[#14252A] text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >{a.label}</button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : (
          <>
          {/* モバイル: カード表示 */}
          <div className="sm:hidden space-y-2">
            {results.length === 0 ? (
              <p className="text-center py-8 text-gray-400">データがありません</p>
            ) : results.map(r => (
              <div key={r.label} className="bg-white rounded-xl shadow-sm p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-sm">{r.label}</span>
                  <span className="font-bold text-sm">{r.revenue.toLocaleString()}円</span>
                </div>
                <div className="flex gap-3 text-xs text-gray-500 mb-1">
                  <span>{r.count}件</span>
                  <span>{totalCount > 0 ? Math.round(r.count / totalCount * 100) : 0}%</span>
                  <span>平均{r.avgRevenue.toLocaleString()}円</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="h-2 rounded-full" style={{ width: `${totalCount > 0 ? (r.count / totalCount * 100) : 0}%`, background: '#14252A' }} />
                </div>
              </div>
            ))}
            {results.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3 font-bold text-sm flex justify-between">
                <span>合計 {totalCount}件</span>
                <span>{totalRevenue.toLocaleString()}円</span>
              </div>
            )}
          </div>

          {/* PC: テーブル表示 */}
          <div className="hidden sm:block bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 text-xs text-gray-500">
                    {axisOptions.find(a => a.key === rowAxis)?.label}
                  </th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">件数</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">構成比</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">売上</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">平均単価</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">データがありません</td></tr>
                ) : results.map(r => (
                  <tr key={r.label} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{r.label}</td>
                    <td className="px-3 py-2 text-right">{r.count}件</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 bg-gray-200 rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${totalCount > 0 ? (r.count / totalCount * 100) : 0}%`, background: '#14252A' }} />
                        </div>
                        <span>{totalCount > 0 ? Math.round(r.count / totalCount * 100) : 0}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{r.revenue.toLocaleString()}円</td>
                    <td className="px-3 py-2 text-right">{r.avgRevenue.toLocaleString()}円</td>
                  </tr>
                ))}
                {/* 合計行 */}
                <tr className="bg-gray-50 font-bold">
                  <td className="px-3 py-2">合計</td>
                  <td className="px-3 py-2 text-right">{totalCount}件</td>
                  <td className="px-3 py-2 text-right">100%</td>
                  <td className="px-3 py-2 text-right">{totalRevenue.toLocaleString()}円</td>
                  <td className="px-3 py-2 text-right">{totalCount > 0 ? Math.round(totalRevenue / totalCount).toLocaleString() : 0}円</td>
                </tr>
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
