'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { fetchAllSlips } from '@/lib/fetchAll'
import { saleTabs } from '@/lib/saleTabs'
import { getClinicId } from '@/lib/clinic'

interface AreaData {
  area: string
  patientCount: number
  totalLTV: number
  avgLTV: number
  totalVisits: number
  avgVisits: number
}

type SortKey = 'totalLTV' | 'patientCount' | 'avgLTV' | 'avgVisits'

export default function AreaLtvPage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const [areas, setAreas] = useState<AreaData[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('totalLTV')

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      // Fetch all slips
      const slips = await fetchAllSlips(
        supabase,
        'patient_id, total_price, visit_date'
      ) as { patient_id: string; total_price: number; visit_date: string }[]

      // Fetch patients with city info
      const { data: patients } = await supabase
        .from('cm_patients')
        .select('id, name, city, prefecture')
        .eq('clinic_id', clinicId)

      if (!slips || slips.length === 0 || !patients) {
        setLoading(false)
        return
      }

      // Build patient → area map
      const patientArea: Record<string, string> = {}
      patients.forEach(p => {
        const area = p.city || p.prefecture || '不明'
        patientArea[p.id] = area
      })

      // Aggregate slips by patient first
      const patientSlips: Record<string, { area: string; revenue: number; visits: number }> = {}
      slips.forEach(s => {
        if (!s.patient_id) return
        const area = patientArea[s.patient_id] || '不明'
        if (!patientSlips[s.patient_id]) {
          patientSlips[s.patient_id] = { area, revenue: 0, visits: 0 }
        }
        patientSlips[s.patient_id].revenue += s.total_price || 0
        patientSlips[s.patient_id].visits++
      })

      // Aggregate by area
      const areaMap: Record<string, { patients: Set<string>; totalLTV: number; totalVisits: number }> = {}
      Object.entries(patientSlips).forEach(([pid, data]) => {
        const area = data.area
        if (!areaMap[area]) {
          areaMap[area] = { patients: new Set(), totalLTV: 0, totalVisits: 0 }
        }
        areaMap[area].patients.add(pid)
        areaMap[area].totalLTV += data.revenue
        areaMap[area].totalVisits += data.visits
      })

      const result: AreaData[] = Object.entries(areaMap).map(([area, d]) => ({
        area,
        patientCount: d.patients.size,
        totalLTV: d.totalLTV,
        avgLTV: d.patients.size > 0 ? Math.round(d.totalLTV / d.patients.size) : 0,
        totalVisits: d.totalVisits,
        avgVisits: d.patients.size > 0 ? Math.round((d.totalVisits / d.patients.size) * 10) / 10 : 0,
      }))

      setAreas(result)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sorted = [...areas].sort((a, b) => {
    if (sortKey === 'totalLTV') return b.totalLTV - a.totalLTV
    if (sortKey === 'patientCount') return b.patientCount - a.patientCount
    if (sortKey === 'avgLTV') return b.avgLTV - a.avgLTV
    return b.avgVisits - a.avgVisits
  })

  const maxLTV = sorted.length > 0 ? sorted[0].totalLTV : 1
  const totalPatients = areas.reduce((s, a) => s + a.patientCount, 0)
  const totalLTV = areas.reduce((s, a) => s + a.totalLTV, 0)
  const overallAvgLTV = totalPatients > 0 ? Math.round(totalLTV / totalPatients) : 0

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2 border-b">
          {saleTabs.map(tab => (
            <Link key={tab.href} href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                tab.href === '/sales/area-ltv' ? 'bg-[#14252A] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}>{tab.label}</Link>
          ))}
        </div>

        <h2 className="font-bold text-gray-800 text-lg mb-4">エリア別LTV分析</h2>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold" style={{ color: '#14252A' }}>{areas.length}<span className="text-xs sm:text-sm">エリア</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">対象エリア数</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-blue-600">{totalPatients}<span className="text-xs sm:text-sm">人</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">総患者数</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-green-600">{overallAvgLTV.toLocaleString()}<span className="text-xs sm:text-sm">円</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">全体平均LTV</p>
          </div>
        </div>

        {/* Sort buttons */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <span className="text-xs text-gray-500 pt-1">並び替え:</span>
          {([
            { key: 'totalLTV' as const, label: '総LTV' },
            { key: 'patientCount' as const, label: '患者数' },
            { key: 'avgLTV' as const, label: '平均LTV' },
            { key: 'avgVisits' as const, label: '来院頻度' },
          ]).map(s => (
            <button key={s.key} onClick={() => setSortKey(s.key)}
              className={`px-3 py-1 rounded text-xs ${sortKey === s.key ? 'bg-[#14252A] text-white' : 'bg-gray-100 text-gray-600'}`}
            >{s.label}</button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : (
          <>
            {/* Bar Chart */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">エリア別 総LTVランキング（上位10）</h3>
              <div className="space-y-2">
                {sorted.slice(0, 10).map((a, i) => (
                  <div key={a.area} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-right">{i + 1}</span>
                    <span className="text-xs font-medium w-20 sm:w-28 truncate">{a.area}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                      <div
                        className="h-full rounded flex items-center px-2"
                        style={{
                          width: `${Math.max((a.totalLTV / maxLTV) * 100, 2)}%`,
                          backgroundColor: '#14252A',
                          opacity: 1 - (i * 0.06),
                        }}
                      >
                        <span className="text-[10px] text-white whitespace-nowrap">
                          {a.totalLTV.toLocaleString()}円
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 w-10 text-right">{a.patientCount}人</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-2">
              {sorted.map((a, i) => (
                <div key={a.area} className="bg-white rounded-xl shadow-sm p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs text-gray-400 mr-1">#{i + 1}</span>
                      <span className="font-medium text-sm">{a.area}</span>
                    </div>
                    <p className="font-bold text-sm" style={{ color: '#14252A' }}>{a.totalLTV.toLocaleString()}円</p>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    <span>{a.patientCount}人</span>
                    <span>平均{a.avgLTV.toLocaleString()}円</span>
                    <span>来院{a.avgVisits}回</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-3 py-2 text-xs text-gray-500">#</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-500">エリア</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-500">患者数</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-500">総LTV</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-500">平均LTV</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-500">総来院数</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-500">平均来院</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((a, i) => (
                      <tr key={a.area} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{a.area}</td>
                        <td className="px-3 py-2 text-right">{a.patientCount}人</td>
                        <td className="px-3 py-2 text-right font-medium">{a.totalLTV.toLocaleString()}円</td>
                        <td className="px-3 py-2 text-right">{a.avgLTV.toLocaleString()}円</td>
                        <td className="px-3 py-2 text-right">{a.totalVisits}回</td>
                        <td className="px-3 py-2 text-right">{a.avgVisits}回</td>
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
