'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import type { Patient, Slip } from '@/lib/types'

export default function StatsPage() {
  const supabase = createClient()
  const [slips, setSlips] = useState<Slip[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [period, setPeriod] = useState('month')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const now = new Date()
      let startDate: string

      if (period === 'week') {
        const d = new Date(now)
        d.setDate(d.getDate() - 7)
        startDate = d.toISOString().split('T')[0]
      } else if (period === 'month') {
        startDate = now.toISOString().slice(0, 7) + '-01'
      } else {
        startDate = now.getFullYear() + '-01-01'
      }

      const [slipsRes, patientsRes] = await Promise.all([
        supabase.from('cm_slips').select('*').gte('visit_date', startDate).order('visit_date'),
        supabase.from('cm_patients').select('*'),
      ])

      setSlips(slipsRes.data || [])
      setPatients(patientsRes.data || [])
      setLoading(false)
    }
    load()
  }, [period])

  const totalRevenue = slips.reduce((sum, s) => sum + (s.total_price || 0), 0)
  // 通常施術（0円超・50,000円未満）の平均単価
  const normalTreatments = slips.filter(s => (s.total_price || 0) > 0 && (s.total_price || 0) < 50000)
  const normalRevTotal = normalTreatments.reduce((sum, s) => sum + (s.total_price || 0), 0)
  const avgRevenue = normalTreatments.length > 0 ? Math.round(normalRevTotal / normalTreatments.length) : 0
  const uniquePatients = new Set(slips.map(s => s.patient_id)).size

  // 来院経路別
  const referralCounts: Record<string, number> = {}
  patients.forEach(p => {
    if (p.referral_source) {
      referralCounts[p.referral_source] = (referralCounts[p.referral_source] || 0) + 1
    }
  })
  const referralSorted = Object.entries(referralCounts).sort((a, b) => b[1] - a[1])

  // 支払方法別
  const paymentCounts: Record<string, number> = {}
  slips.forEach(s => {
    if (s.payment_method) {
      paymentCounts[s.payment_method] = (paymentCounts[s.payment_method] || 0) + 1
    }
  })

  const statusCounts = {
    active: patients.filter(p => p.status === 'active').length,
    inactive: patients.filter(p => p.status === 'inactive').length,
    completed: patients.filter(p => p.status === 'completed').length,
  }

  return (
    <AppShell>
      <Header title="統計" />
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

        {/* 期間選択 */}
        <div className="flex gap-2">
          {[
            { key: 'week', label: '直近1週間' },
            { key: 'month', label: '今月' },
            { key: 'year', label: '今年' },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                period === p.key ? 'border-[#14252A] bg-[#14252A] text-white' : 'border-gray-200 text-gray-500'
              }`}
            >{p.label}</button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : (
          <>
            {/* メイン指標 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-2xl font-bold" style={{ color: '#14252A' }}>{totalRevenue.toLocaleString()}<span className="text-sm">円</span></p>
                <p className="text-xs text-gray-500">売上合計</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{slips.length}<span className="text-sm">件</span></p>
                <p className="text-xs text-gray-500">施術件数</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{avgRevenue.toLocaleString()}<span className="text-sm">円</span></p>
                <p className="text-xs text-gray-500">施術単価</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-2xl font-bold text-orange-600">{uniquePatients}<span className="text-sm">人</span></p>
                <p className="text-xs text-gray-500">施術患者数</p>
              </div>
            </div>

            {/* 患者ステータス */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-800 text-sm mb-3">患者ステータス</h3>
              <div className="flex gap-3">
                <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-green-700">{statusCounts.active}</p>
                  <p className="text-xs text-green-600">通院中</p>
                </div>
                <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-gray-600">{statusCounts.inactive}</p>
                  <p className="text-xs text-gray-500">休止</p>
                </div>
                <div className="flex-1 bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-blue-700">{statusCounts.completed}</p>
                  <p className="text-xs text-blue-600">卒業</p>
                </div>
              </div>
            </div>

            {/* 来院経路 */}
            {referralSorted.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="font-bold text-gray-800 text-sm mb-3">来院経路</h3>
                <div className="space-y-2">
                  {referralSorted.map(([source, count]) => (
                    <div key={source} className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">{source}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${(count / patients.length) * 100}%`, background: '#14252A' }} />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">{count}人</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 支払方法別 */}
            {Object.keys(paymentCounts).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="font-bold text-gray-800 text-sm mb-3">支払方法</h3>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(paymentCounts).sort((a, b) => b[1] - a[1]).map(([method, count]) => (
                    <div key={method} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-xs text-gray-500">{method}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
