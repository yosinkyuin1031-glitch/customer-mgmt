'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { getClinicId } from '@/lib/clinic'
import type { Patient, Slip } from '@/lib/types'

interface TodaySlip extends Slip {
  patient?: Patient
}

export default function HomePage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const [todaySlips, setTodaySlips] = useState<TodaySlip[]>([])
  const [recentPatients, setRecentPatients] = useState<Patient[]>([])
  const [stats, setStats] = useState({ totalPatients: 0, monthVisits: 0, todayVisits: 0, todayRevenue: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0]
      const monthStart = today.slice(0, 7) + '-01'

      const [patientsRes, todayRes, monthRes] = await Promise.all([
        supabase.from('cm_patients').select('*').eq('clinic_id', clinicId).eq('status', 'active').order('updated_at', { ascending: false }).limit(5),
        supabase.from('cm_slips').select('*').eq('clinic_id', clinicId).eq('visit_date', today).order('created_at', { ascending: false }),
        supabase.from('cm_slips').select('id, total_price', { count: 'exact' }).eq('clinic_id', clinicId).gte('visit_date', monthStart),
      ])

      const { count: totalPatients } = await supabase.from('cm_patients').select('id', { count: 'exact' }).eq('clinic_id', clinicId)

      setRecentPatients(patientsRes.data || [])
      setTodaySlips(todayRes.data || [])
      const todayRevenue = (todayRes.data || []).reduce((sum: number, s: Slip) => sum + (s.total_price || 0), 0)
      setStats({
        totalPatients: totalPatients || 0,
        monthVisits: monthRes.count || 0,
        todayVisits: todayRes.data?.length || 0,
        todayRevenue,
      })
      setLoading(false)
    }
    load()
  }, [])

  return (
    <AppShell>
      <Header title="顧客管理シート" />
      <div className="px-4 py-4 max-w-lg mx-auto">

        {/* 統計カード */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-3 text-center">
            <p className="text-xl sm:text-2xl font-bold" style={{ color: '#14252A' }}>{stats.totalPatients}</p>
            <p className="text-[10px] sm:text-xs text-gray-500">総患者数</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-3 text-center">
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats.monthVisits}</p>
            <p className="text-[10px] sm:text-xs text-gray-500">今月の施術</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-3 text-center">
            <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.todayVisits}</p>
            <p className="text-[10px] sm:text-xs text-gray-500">本日の施術</p>
          </div>
        </div>

        {/* クイックアクション */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <Link href="/patients/new" className="text-white rounded-xl p-3 text-center font-bold shadow-sm text-xs" style={{ background: '#14252A' }}>
            + 新規患者
          </Link>
          <Link href="/visits/new" className="bg-blue-600 text-white rounded-xl p-3 text-center font-bold shadow-sm text-xs">
            + 施術記録
          </Link>
          <Link href="/visits/quick" className="bg-green-600 text-white rounded-xl p-3 text-center font-bold shadow-sm text-xs">
            一括入力
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : (
          <>
            {/* 本日の施術 */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold text-gray-800">本日の施術</h2>
                {stats.todayRevenue > 0 && (
                  <span className="text-sm font-bold" style={{ color: '#14252A' }}>{stats.todayRevenue.toLocaleString()}円</span>
                )}
              </div>
              {todaySlips.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-2">本日の施術記録はありません</p>
              ) : (
                <div className="space-y-2">
                  {todaySlips.map(s => (
                    <Link key={s.id} href={`/patients/${s.patient_id}`} className="block border border-gray-100 rounded-lg p-3 hover:bg-gray-50">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-sm">{s.patient_name}</p>
                          <p className="text-xs text-gray-500">{s.menu_name}</p>
                        </div>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          {(s.total_price || 0).toLocaleString()}円
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 最近の患者 */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold text-gray-800">最近の患者</h2>
                <Link href="/patients" className="text-xs text-blue-600">すべて見る →</Link>
              </div>
              {recentPatients.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-2">患者データがありません</p>
              ) : (
                <div className="space-y-2">
                  {recentPatients.map(p => (
                    <Link key={p.id} href={`/patients/${p.id}`} className="block border border-gray-100 rounded-lg p-3 hover:bg-gray-50">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-sm">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.chief_complaint?.slice(0, 20)}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {p.status === 'active' ? '通院中' : p.status === 'completed' ? '卒業' : '休止'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
