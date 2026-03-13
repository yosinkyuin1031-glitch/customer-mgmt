'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import type { Slip } from '@/lib/types'
import { saleTabs } from '@/lib/saleTabs'

export default function SlipsPage() {
  const supabase = createClient()
  const [slips, setSlips] = useState<Slip[]>([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const startDate = selectedMonth + '-01'
      const d = new Date(startDate)
      d.setMonth(d.getMonth() + 1)
      d.setDate(0)
      const endDate = d.toISOString().split('T')[0]

      const { data } = await supabase
        .from('cm_slips')
        .select('*')
        .gte('visit_date', startDate)
        .lte('visit_date', endDate)
        .order('visit_date', { ascending: false })

      setSlips(data || [])
      setLoading(false)
    }
    load()
  }, [selectedMonth])

  const totalAmount = slips.reduce((sum, s) => sum + (s.total_price || 0), 0)

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2 border-b">
          {saleTabs.map(tab => (
            <Link key={tab.href} href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                tab.href === '/sales/slips' ? 'bg-[#14252A] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}>{tab.label}</Link>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 text-lg">伝票一覧</h2>
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm" />
        </div>

        <div className="bg-blue-50 rounded-lg p-3 mb-4 flex justify-between items-center">
          <span className="text-sm text-gray-700">{slips.length}件の伝票</span>
          <span className="font-bold text-lg" style={{ color: '#14252A' }}>{totalAmount.toLocaleString()}円</span>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : (
          <>
          <div className="sm:hidden space-y-2">
            {slips.length === 0 ? (
              <p className="text-center py-8 text-gray-400">データがありません</p>
            ) : slips.map(s => (
              <div key={s.id} className="bg-white rounded-xl shadow-sm p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{s.patient_name || '-'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.staff_name || '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">{(s.total_price || 0).toLocaleString()}円</p>
                    {s.base_price > 0 && <p className="text-[10px] text-gray-400">基本 {s.base_price.toLocaleString()}円</p>}
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {new Date(s.visit_date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}
                </p>
              </div>
            ))}
          </div>

          <div className="hidden sm:block bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-3 py-2 text-xs text-gray-500">日付</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">患者名</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">基本</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">オプション</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">合計</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">担当</th>
                  </tr>
                </thead>
                <tbody>
                  {slips.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">データがありません</td></tr>
                  ) : slips.map(s => (
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(s.visit_date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}
                      </td>
                      <td className="px-3 py-2 font-medium">{s.patient_name || '-'}</td>
                      <td className="px-3 py-2 text-right">{s.base_price > 0 ? `${s.base_price.toLocaleString()}円` : '-'}</td>
                      <td className="px-3 py-2 text-right">{s.option_price > 0 ? `${s.option_price.toLocaleString()}円` : '-'}</td>
                      <td className="px-3 py-2 text-right font-medium">{(s.total_price || 0).toLocaleString()}円</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{s.staff_name || '-'}</td>
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
