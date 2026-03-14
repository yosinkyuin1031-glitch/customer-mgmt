'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { saleTabs } from '@/lib/saleTabs'
import { getClinicId } from '@/lib/clinic'

interface PatientRow {
  id: string
  name: string
  prefecture: string
  city: string
}

interface CityData {
  city: string
  count: number
  patients: { id: string; name: string }[]
}

interface PrefData {
  prefecture: string
  totalCount: number
  cities: CityData[]
}

export default function MapPage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const [prefData, setPrefData] = useState<PrefData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPref, setExpandedPref] = useState<string | null>(null)
  const [expandedCity, setExpandedCity] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      // Fetch all patients with location info (paginated to avoid 1000 limit)
      const PAGE_SIZE = 1000
      let allPatients: PatientRow[] = []
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('cm_patients')
          .select('id, name, prefecture, city')
          .eq('clinic_id', clinicId)
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)

        if (error || !data) break
        allPatients = allPatients.concat(data as PatientRow[])
        hasMore = data.length === PAGE_SIZE
        offset += PAGE_SIZE
      }

      // Group by prefecture → city
      const prefMap: Record<string, Record<string, { id: string; name: string }[]>> = {}

      allPatients.forEach(p => {
        const pref = p.prefecture || '不明'
        const city = p.city || '不明'
        if (!prefMap[pref]) prefMap[pref] = {}
        if (!prefMap[pref][city]) prefMap[pref][city] = []
        prefMap[pref][city].push({ id: p.id, name: p.name })
      })

      const result: PrefData[] = Object.entries(prefMap)
        .map(([prefecture, cities]) => {
          const cityArr: CityData[] = Object.entries(cities)
            .map(([city, patients]) => ({ city, count: patients.length, patients }))
            .sort((a, b) => b.count - a.count)
          return {
            prefecture,
            totalCount: cityArr.reduce((s, c) => s + c.count, 0),
            cities: cityArr,
          }
        })
        .sort((a, b) => b.totalCount - a.totalCount)

      setPrefData(result)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalPatients = prefData.reduce((s, p) => s + p.totalCount, 0)
  const totalCities = prefData.reduce((s, p) => s + p.cities.length, 0)
  const maxCount = prefData.length > 0 ? prefData[0].totalCount : 1

  // Heatmap color helper
  const getHeatColor = (count: number, max: number) => {
    if (max === 0) return 'rgba(20,37,42,0.05)'
    const ratio = count / max
    if (ratio > 0.7) return 'rgba(20,37,42,0.9)'
    if (ratio > 0.5) return 'rgba(20,37,42,0.7)'
    if (ratio > 0.3) return 'rgba(20,37,42,0.5)'
    if (ratio > 0.15) return 'rgba(20,37,42,0.3)'
    if (ratio > 0.05) return 'rgba(20,37,42,0.15)'
    return 'rgba(20,37,42,0.07)'
  }

  const getTextColor = (count: number, max: number) => {
    const ratio = max > 0 ? count / max : 0
    return ratio > 0.3 ? '#fff' : '#14252A'
  }

  // Concentration metric: top 3 areas as % of total
  const top3 = prefData.slice(0, 3)
  const top3Count = top3.reduce((s, p) => s + p.totalCount, 0)
  const concentrationPct = totalPatients > 0 ? Math.round((top3Count / totalPatients) * 100) : 0

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2 border-b">
          {saleTabs.map(tab => (
            <Link key={tab.href} href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                tab.href === '/sales/map' ? 'bg-[#14252A] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}>{tab.label}</Link>
          ))}
        </div>

        <h2 className="font-bold text-gray-800 text-lg mb-4">地域分布マップ</h2>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold" style={{ color: '#14252A' }}>{totalPatients}<span className="text-xs sm:text-sm">人</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">総患者数</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-blue-600">{prefData.length}<span className="text-xs sm:text-sm">件</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">都道府県数</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-green-600">{totalCities}<span className="text-xs sm:text-sm">件</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">市区町村数</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-orange-500">{concentrationPct}<span className="text-xs sm:text-sm">%</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">上位3地域集中率</p>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : (
          <>
            {/* Heatmap grid - Prefecture level */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">都道府県ヒートマップ</h3>
              <div className="flex flex-wrap gap-1.5">
                {prefData.map(p => (
                  <button
                    key={p.prefecture}
                    onClick={() => {
                      setExpandedPref(expandedPref === p.prefecture ? null : p.prefecture)
                      setExpandedCity(null)
                    }}
                    className="rounded-lg px-2 py-1.5 text-xs font-medium transition-all hover:scale-105"
                    style={{
                      backgroundColor: getHeatColor(p.totalCount, maxCount),
                      color: getTextColor(p.totalCount, maxCount),
                      minWidth: '60px',
                    }}
                  >
                    {p.prefecture}
                    <span className="block text-[10px] opacity-80">{p.totalCount}人</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-400">
                <span>少</span>
                <div className="flex gap-0.5">
                  {[0.07, 0.15, 0.3, 0.5, 0.7, 0.9].map(opacity => (
                    <div key={opacity} className="w-6 h-3 rounded" style={{ backgroundColor: `rgba(20,37,42,${opacity})` }} />
                  ))}
                </div>
                <span>多</span>
              </div>
            </div>

            {/* Expanded prefecture detail */}
            {expandedPref && (
              <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3">
                  {expandedPref} の市区町村分布
                </h3>
                {(() => {
                  const pref = prefData.find(p => p.prefecture === expandedPref)
                  if (!pref) return null
                  const cityMax = pref.cities[0]?.count || 1
                  return (
                    <>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {pref.cities.map(c => (
                          <button
                            key={c.city}
                            onClick={() => setExpandedCity(expandedCity === `${expandedPref}-${c.city}` ? null : `${expandedPref}-${c.city}`)}
                            className="rounded-lg px-2 py-1.5 text-xs font-medium transition-all hover:scale-105"
                            style={{
                              backgroundColor: getHeatColor(c.count, cityMax),
                              color: getTextColor(c.count, cityMax),
                              minWidth: '70px',
                            }}
                          >
                            {c.city}
                            <span className="block text-[10px] opacity-80">{c.count}人</span>
                          </button>
                        ))}
                      </div>

                      {/* Expanded city patient list */}
                      {expandedCity && (() => {
                        const cityName = expandedCity.replace(`${expandedPref}-`, '')
                        const city = pref.cities.find(c => c.city === cityName)
                        if (!city) return null
                        return (
                          <div className="border-t pt-3">
                            <h4 className="text-xs font-bold text-gray-600 mb-2">
                              {expandedPref} {cityName} の患者一覧（{city.count}人）
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
                              {city.patients.map(pt => (
                                <Link
                                  key={pt.id}
                                  href={`/patients/${pt.id}`}
                                  className="text-xs text-blue-600 hover:underline bg-gray-50 rounded px-2 py-1 truncate"
                                >
                                  {pt.name}
                                </Link>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                    </>
                  )
                })()}
              </div>
            )}

            {/* Prefecture → City table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-3 py-2 text-xs text-gray-500">#</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-500">都道府県</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-500">患者数</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-500">市区町村数</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-500">構成比</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-500">上位エリア</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prefData.map((p, i) => (
                      <tr key={p.prefecture} className="border-b hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setExpandedPref(expandedPref === p.prefecture ? null : p.prefecture)
                          setExpandedCity(null)
                        }}
                      >
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{p.prefecture}</td>
                        <td className="px-3 py-2 text-right">{p.totalCount}人</td>
                        <td className="px-3 py-2 text-right">{p.cities.length}</td>
                        <td className="px-3 py-2 text-right">
                          {totalPatients > 0 ? Math.round((p.totalCount / totalPatients) * 100) : 0}%
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 truncate max-w-[200px]">
                          {p.cities.slice(0, 3).map(c => `${c.city}(${c.count})`).join(', ')}
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
