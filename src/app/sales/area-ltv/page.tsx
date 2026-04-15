'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { saleTabs } from '@/lib/saleTabs'
import { getClinicId } from '@/lib/clinic'
import type { MapMarker } from '@/components/LeafletMap'

const LeafletMap = dynamic(() => import('@/components/LeafletMap'), { ssr: false })

interface AreaData {
  area: string
  prefecture: string
  patientCount: number
  totalLTV: number
  avgLTV: number
  totalVisits: number
  avgVisits: number
  topPatients: { id?: string; name: string; ltv: number }[]
}

type SortKey = 'totalLTV' | 'patientCount' | 'avgLTV' | 'avgVisits'
type ViewMode = 'list' | 'map'

export default function AreaLtvPage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const [areas, setAreas] = useState<AreaData[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('totalLTV')
  const [expandedArea, setExpandedArea] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Map state
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([])
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeDone, setGeocodeDone] = useState(false)
  const [geocodeProgress, setGeocodeProgress] = useState('')

  // Raw patient data for geocoding
  const [rawPatients, setRawPatients] = useState<{ id: string; name: string; prefecture: string; city: string; ltv: number; visit_count: number }[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const PAGE_SIZE = 1000
      let allPatients: { id: string; name: string; city: string; prefecture: string; ltv: number; visit_count: number }[] = []
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('cm_patients')
          .select('id, name, city, prefecture, ltv, visit_count')
          .eq('clinic_id', clinicId)
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)

        if (error || !data) break
        allPatients = allPatients.concat(data)
        hasMore = data.length === PAGE_SIZE
        offset += PAGE_SIZE
      }

      setRawPatients(allPatients)

      if (allPatients.length === 0) {
        setLoading(false)
        return
      }

      // Aggregate by city
      const areaMap: Record<string, {
        prefecture: string
        patients: { id: string; name: string; ltv: number }[]
        totalLTV: number
        totalVisits: number
      }> = {}

      allPatients.forEach(p => {
        const area = p.city || p.prefecture || '不明'
        if (!areaMap[area]) {
          areaMap[area] = { prefecture: p.prefecture || '不明', patients: [], totalLTV: 0, totalVisits: 0 }
        }
        const ltv = p.ltv || 0
        const visits = p.visit_count || 0
        areaMap[area].patients.push({ id: p.id, name: p.name, ltv })
        areaMap[area].totalLTV += ltv
        areaMap[area].totalVisits += visits
      })

      const result: AreaData[] = Object.entries(areaMap).map(([area, d]) => ({
        area,
        prefecture: d.prefecture,
        patientCount: d.patients.length,
        totalLTV: d.totalLTV,
        avgLTV: d.patients.length > 0 ? Math.round(d.totalLTV / d.patients.length) : 0,
        totalVisits: d.totalVisits,
        avgVisits: d.patients.length > 0 ? Math.round((d.totalVisits / d.patients.length) * 10) / 10 : 0,
        topPatients: d.patients.sort((a, b) => b.ltv - a.ltv).slice(0, 5),
      }))

      setAreas(result)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Geocoding for map view
  const geocodeCities = useCallback(async () => {
    const cityMap: Record<string, { prefecture: string; city: string; patients: { id: string; name: string; ltv: number }[] }> = {}
    rawPatients.forEach(p => {
      const pref = p.prefecture || '不明'
      const city = p.city || '不明'
      if (pref === '不明' || city === '不明') return
      const key = `${pref}|${city}`
      if (!cityMap[key]) cityMap[key] = { prefecture: pref, city, patients: [] }
      cityMap[key].patients.push({ id: p.id, name: p.name, ltv: p.ltv || 0 })
    })

    const toGeocode = Object.values(cityMap)
    if (toGeocode.length === 0) {
      setGeocodeDone(true)
      return
    }

    setGeocoding(true)
    setGeocodeProgress(`地図を読み込み中... (0/${toGeocode.length})`)

    const BATCH_SIZE = 20
    const allResults: Record<string, { lat: number; lng: number } | null> = {}

    for (let i = 0; i < toGeocode.length; i += BATCH_SIZE) {
      const batch = toGeocode.slice(i, i + BATCH_SIZE)
      const uniqueCities = batch.map(c => ({ prefecture: c.prefecture, city: c.city }))
      try {
        const res = await fetch('/api/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cities: uniqueCities }),
        })
        if (res.ok) {
          const { results } = await res.json()
          Object.assign(allResults, results)
        }
      } catch (err) {
        console.error('Geocode error:', err)
      }
      setGeocodeProgress(`地図を読み込み中... (${Math.min(i + BATCH_SIZE, toGeocode.length)}/${toGeocode.length})`)
    }

    const markers: MapMarker[] = []
    toGeocode.forEach(city => {
      const key = `${city.prefecture}${city.city}`
      const coords = allResults[key]
      if (!coords) return
      const uniquePatients = Array.from(new Map(city.patients.map(p => [p.id, p])).values())
      const totalLtv = uniquePatients.reduce((s, p) => s + p.ltv, 0)
      markers.push({
        lat: coords.lat, lng: coords.lng,
        label: `${city.prefecture} ${city.city}`,
        count: uniquePatients.length,
        avgLtv: uniquePatients.length > 0 ? Math.round(totalLtv / uniquePatients.length) : 0,
        totalLtv,
        patients: uniquePatients.map(p => ({ name: p.name, ltv: p.ltv })),
      })
    })

    setMapMarkers(markers)
    setGeocoding(false)
    setGeocodeDone(true)
    setGeocodeProgress('')
  }, [rawPatients])

  // Trigger geocoding when switching to map view
  useEffect(() => {
    if (viewMode === 'map' && !geocodeDone && !loading && rawPatients.length > 0) {
      geocodeCities()
    }
  }, [viewMode, geocodeDone, loading, rawPatients, geocodeCities])

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
  const bestAvgArea = [...areas].sort((a, b) => b.avgLTV - a.avgLTV).find(a => a.patientCount >= 3)

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

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 text-lg">エリア分析</h2>
          {/* View mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'list' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'
              }`}
            >一覧</button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'map' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'
              }`}
            >マップ</button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
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
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-sm sm:text-base font-bold text-orange-500 truncate" title={bestAvgArea?.area || ''}>{bestAvgArea?.area || '-'}</p>
            <p className="text-[10px] sm:text-xs text-gray-500">最高平均LTVエリア</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="bg-white rounded-xl shadow-sm p-4 animate-pulse">
              <div className="h-4 w-40 bg-gray-200 rounded mb-3" />
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-3 w-5 bg-gray-200 rounded" />
                    <div className="h-3 w-20 bg-gray-200 rounded" />
                    <div className="flex-1 h-6 bg-gray-100 rounded">
                      <div className="h-6 bg-gray-200 rounded" style={{ width: `${80 - i * 12}%` }} />
                    </div>
                    <div className="h-3 w-10 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : viewMode === 'map' ? (
          /* ===== マップビュー ===== */
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-3">丸の大きさ＝患者数、色＝平均LTV。タップで詳細表示</p>
            {geocoding ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-[#14252A] rounded-full animate-spin mb-3" />
                <p className="text-sm text-gray-500">{geocodeProgress}</p>
              </div>
            ) : mapMarkers.length > 0 ? (
              <LeafletMap markers={mapMarkers} height="500px" />
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-2">住所データが不足しています</p>
                <p className="text-xs text-gray-400">患者の都道府県・市区町村を登録すると地図に表示されます</p>
              </div>
            )}
          </div>
        ) : (
          /* ===== 一覧ビュー ===== */
          <>
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

            {/* Bar Chart */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">
                エリア別 {sortKey === 'totalLTV' ? '総LTV' : sortKey === 'patientCount' ? '患者数' : sortKey === 'avgLTV' ? '平均LTV' : '来院頻度'}ランキング（上位10）
              </h3>
              <div className="space-y-2">
                {sorted.slice(0, 10).map((a, i) => {
                  const value = sortKey === 'totalLTV' ? a.totalLTV : sortKey === 'patientCount' ? a.patientCount : sortKey === 'avgLTV' ? a.avgLTV : a.avgVisits
                  const maxVal = sortKey === 'totalLTV' ? maxLTV : sorted[0]?.[sortKey] || 1
                  const displayValue = sortKey === 'avgVisits' ? `${a.avgVisits}回` : sortKey === 'patientCount' ? `${a.patientCount}人` : `${value.toLocaleString()}円`
                  return (
                    <div key={a.area} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5 text-right">{i + 1}</span>
                      <span className="text-xs font-medium w-20 sm:w-28 truncate" title={a.area}>{a.area}</span>
                      <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full rounded flex items-center px-2"
                          style={{
                            width: `${Math.max((value / maxVal) * 100, 2)}%`,
                            backgroundColor: '#14252A',
                            opacity: 1 - (i * 0.06),
                          }}
                        >
                          <span className="text-[10px] text-white whitespace-nowrap">
                            {displayValue}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 w-10 text-right">{a.patientCount}人</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-2">
              {sorted.map((a, i) => (
                <button key={a.area} onClick={() => setExpandedArea(expandedArea === a.area ? null : a.area)}
                  className="w-full text-left bg-white rounded-xl shadow-sm p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs text-gray-400 mr-1">#{i + 1}</span>
                      <span className="font-medium text-sm">{a.area}</span>
                      <span className="text-[10px] text-gray-400 ml-1">{a.prefecture}</span>
                    </div>
                    <p className="font-bold text-sm" style={{ color: '#14252A' }}>{a.totalLTV.toLocaleString()}円</p>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    <span>{a.patientCount}人</span>
                    <span>平均{a.avgLTV.toLocaleString()}円</span>
                    <span>来院{a.avgVisits}回</span>
                  </div>
                  {expandedArea === a.area && a.topPatients.length > 0 && (
                    <div className="border-t mt-2 pt-2 space-y-1">
                      <p className="text-[10px] text-gray-400">LTV上位</p>
                      {a.topPatients.map((p, j) => (
                        <div key={j} className="flex justify-between text-xs">
                          <span>{p.name}</span>
                          <span className="text-gray-500">{p.ltv.toLocaleString()}円</span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
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
                      <th className="text-left px-3 py-2 text-xs text-gray-500">都道府県</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-500">患者数</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-500">総LTV</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-500">平均LTV</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-500">総来院数</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-500">平均来院</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((a, i) => (
                      <tr key={a.area} className="border-b hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedArea(expandedArea === a.area ? null : a.area)}>
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{a.area}</td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{a.prefecture}</td>
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

            {/* Insights */}
            <div className="bg-blue-50 rounded-xl p-4 mt-4">
              <h3 className="text-sm font-bold text-gray-700 mb-2">分析のポイント</h3>
              <div className="space-y-1 text-xs text-gray-600">
                {bestAvgArea && (
                  <p>- 平均LTV最高エリアは<strong>{bestAvgArea.area}</strong>（{bestAvgArea.avgLTV.toLocaleString()}円 / {bestAvgArea.patientCount}人）</p>
                )}
                {sorted[0] && (
                  <p>- 売上貢献1位は<strong>{sorted[0].area}</strong>（総LTV {sorted[0].totalLTV.toLocaleString()}円）</p>
                )}
                <p className="text-[10px] text-gray-400 mt-2">※ 行をタップすると上位患者を表示</p>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
