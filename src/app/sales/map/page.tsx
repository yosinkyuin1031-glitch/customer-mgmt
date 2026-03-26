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

interface PatientRow {
  id: string
  name: string
  prefecture: string
  city: string
  ltv: number
  visit_count: number
}

interface CityData {
  city: string
  prefecture: string
  count: number
  totalLtv: number
  patients: { id: string; name: string; ltv: number }[]
}

interface PrefData {
  prefecture: string
  totalCount: number
  totalLtv: number
  cities: CityData[]
}

export default function MapPage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const [prefData, setPrefData] = useState<PrefData[]>([])
  const [allCities, setAllCities] = useState<CityData[]>([])
  const [loading, setLoading] = useState(true)
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([])
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeProgress, setGeocodeProgress] = useState('')
  const [expandedPref, setExpandedPref] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const PAGE_SIZE = 1000
      let allPatients: PatientRow[] = []
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('cm_patients')
          .select('id, name, prefecture, city, ltv, visit_count')
          .eq('clinic_id', clinicId)
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)
        if (error || !data) break
        allPatients = allPatients.concat(data as PatientRow[])
        hasMore = data.length === PAGE_SIZE
        offset += PAGE_SIZE
      }

      const prefMap: Record<string, Record<string, { id: string; name: string; ltv: number }[]>> = {}
      allPatients.forEach(p => {
        const pref = p.prefecture || '不明'
        const city = p.city || '不明'
        if (!prefMap[pref]) prefMap[pref] = {}
        if (!prefMap[pref][city]) prefMap[pref][city] = []
        prefMap[pref][city].push({ id: p.id, name: p.name, ltv: p.ltv || 0 })
      })

      const cityList: CityData[] = []
      const result: PrefData[] = Object.entries(prefMap)
        .map(([prefecture, cities]) => {
          const cityArr: CityData[] = Object.entries(cities)
            .map(([city, patients]) => {
              const totalLtv = patients.reduce((s, p) => s + p.ltv, 0)
              const cd: CityData = { city, prefecture, count: patients.length, totalLtv, patients }
              cityList.push(cd)
              return cd
            })
            .sort((a, b) => b.count - a.count)
          return {
            prefecture,
            totalCount: cityArr.reduce((s, c) => s + c.count, 0),
            totalLtv: cityArr.reduce((s, c) => s + c.totalLtv, 0),
            cities: cityArr,
          }
        })
        .sort((a, b) => b.totalCount - a.totalCount)

      setPrefData(result)
      setAllCities(cityList)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const geocodeCities = useCallback(async (cities: CityData[]) => {
    const toGeocode = cities.filter(c => c.prefecture !== '不明' && c.city !== '不明')
    if (toGeocode.length === 0) return
    setGeocoding(true)
    setGeocodeProgress(`地図を読み込み中... (0/${toGeocode.length})`)

    const BATCH_SIZE = 20
    const allResults: Record<string, { lat: number; lng: number } | null> = {}

    for (let i = 0; i < toGeocode.length; i += BATCH_SIZE) {
      const batch = toGeocode.slice(i, i + BATCH_SIZE)
      const uniqueCities = Array.from(new Set(batch.map(c => `${c.prefecture}|${c.city}`)))
        .map(key => { const [prefecture, city] = key.split('|'); return { prefecture, city } })
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
    const cityKeys = new Set<string>()
    toGeocode.forEach(city => {
      const key = `${city.prefecture}${city.city}`
      if (cityKeys.has(key)) return
      cityKeys.add(key)
      const coords = allResults[key]
      if (!coords) return
      const cityData = toGeocode.filter(c => c.prefecture === city.prefecture && c.city === city.city)
      const allPats = cityData.flatMap(c => c.patients)
      const uniquePatients = Array.from(new Map(allPats.map(p => [p.id, p])).values())
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
    setGeocodeProgress('')
  }, [])

  useEffect(() => {
    if (!loading && allCities.length > 0 && mapMarkers.length === 0) {
      geocodeCities(allCities)
    }
  }, [loading, allCities, mapMarkers.length, geocodeCities])

  const totalPatients = prefData.reduce((s, p) => s + p.totalCount, 0)

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

        <h2 className="font-bold text-gray-800 text-lg mb-4">地域分布</h2>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : totalPatients === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg mb-2">患者データがありません</p>
            <p className="text-gray-400 text-sm">顧客管理で患者の住所（都道府県・市区町村）を登録すると、ここに地域分布が表示されます</p>
          </div>
        ) : (
          <>
            {/* 地図 */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <p className="text-xs text-gray-400 mb-3">丸の大きさ＝患者数。タップで詳細表示</p>
              {geocoding ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-gray-300 border-t-[#14252A] rounded-full animate-spin mb-3" />
                  <p className="text-sm text-gray-500">{geocodeProgress}</p>
                </div>
              ) : mapMarkers.length > 0 ? (
                <LeafletMap markers={mapMarkers} height="400px" />
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400 mb-2">住所データが不足しています</p>
                  <p className="text-xs text-gray-400">患者の都道府県・市区町村を登録すると地図に表示されます</p>
                </div>
              )}
            </div>

            {/* 地域ランキング */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">地域別ランキング</h3>
              <div className="space-y-2">
                {prefData.filter(p => p.prefecture !== '不明').map((p, i) => {
                  const pct = totalPatients > 0 ? Math.round((p.totalCount / totalPatients) * 100) : 0
                  const isExpanded = expandedPref === p.prefecture
                  return (
                    <div key={p.prefecture}>
                      <button
                        onClick={() => setExpandedPref(isExpanded ? null : p.prefecture)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                          <span className="text-lg font-bold text-gray-300 w-8">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-sm text-gray-800">{p.prefecture}</span>
                              <span className="text-sm font-bold" style={{ color: '#14252A' }}>{p.totalCount}人</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="h-2 rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: '#14252A', minWidth: pct > 0 ? '8px' : '0' }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                          <span className="text-gray-300 text-xs">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </button>

                      {/* 市区町村の展開 */}
                      {isExpanded && (
                        <div className="ml-11 mt-1 mb-2 space-y-1">
                          {p.cities.filter(c => c.city !== '不明').map(c => (
                            <div key={c.city} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg text-xs">
                              <span className="text-gray-700">{c.city}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-gray-800">{c.count}人</span>
                                {c.totalLtv > 0 && (
                                  <span className="text-gray-400">LTV {Math.round(c.totalLtv / c.count).toLocaleString()}円</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {prefData.some(p => p.prefecture === '不明') && (
                <p className="text-[10px] text-gray-400 mt-3 pt-3 border-t">
                  ※ 住所未登録の患者が{prefData.find(p => p.prefecture === '不明')?.totalCount || 0}人います
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
