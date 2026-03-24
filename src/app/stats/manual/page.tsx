'use client'

import { useEffect, useState, useCallback } from 'react'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { getClinicId } from '@/lib/clinic'

interface ManualRow {
  year: number
  month: number
  slots: number | null
  treatments: number | null
  chart_count: number | null
  frequency: number | null
  avg_price: number | null
  new_patients: number | null
  revenue: number | null
  new_revenue: number | null
  existing_revenue: number | null
  ad_cost: number | null
  new_ltv: number | null
  cpa: number | null
  profit_ltv: number | null
  utilization_rate: number | null
  target_revenue: number | null
  memo: string | null
  isNew?: boolean
  isDirty?: boolean
}

const FIELDS: { key: keyof ManualRow; label: string; type: 'int' | 'float' | 'text'; width: string }[] = [
  { key: 'target_revenue', label: '目標売上', type: 'int', width: 'w-24' },
  { key: 'revenue', label: '売上', type: 'int', width: 'w-24' },
  { key: 'new_revenue', label: '新規売上', type: 'int', width: 'w-24' },
  { key: 'existing_revenue', label: '既存売上', type: 'int', width: 'w-24' },
  { key: 'slots', label: '予約枠', type: 'int', width: 'w-16' },
  { key: 'treatments', label: '施術数', type: 'int', width: 'w-16' },
  { key: 'chart_count', label: 'カルテ数', type: 'int', width: 'w-16' },
  { key: 'frequency', label: '頻度', type: 'float', width: 'w-16' },
  { key: 'avg_price', label: '単価', type: 'int', width: 'w-20' },
  { key: 'new_patients', label: '新規数', type: 'int', width: 'w-16' },
  { key: 'ad_cost', label: '広告費', type: 'int', width: 'w-24' },
  { key: 'new_ltv', label: 'LTV', type: 'int', width: 'w-20' },
  { key: 'cpa', label: 'CPA', type: 'int', width: 'w-20' },
  { key: 'profit_ltv', label: '利益LTV', type: 'int', width: 'w-20' },
  { key: 'memo', label: 'メモ', type: 'text', width: 'w-32' },
]

export default function ManualStatsPage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const [rows, setRows] = useState<ManualRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [viewYear, setViewYear] = useState(new Date().getFullYear())

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('cm_monthly_stats')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('year', viewYear)
      .order('month', { ascending: true })

    // Create 12 months, merge with existing data
    const existingMap: Record<number, ManualRow> = {}
    data?.forEach(d => { existingMap[d.month] = { ...d, isDirty: false, isNew: false } })

    const allRows: ManualRow[] = []
    for (let m = 1; m <= 12; m++) {
      if (existingMap[m]) {
        allRows.push(existingMap[m])
      } else {
        allRows.push({
          year: viewYear, month: m,
          slots: null, treatments: null, chart_count: null, frequency: null,
          avg_price: null, new_patients: null, revenue: null, new_revenue: null,
          existing_revenue: null, ad_cost: null, new_ltv: null, cpa: null,
          profit_ltv: null, utilization_rate: null, target_revenue: null, memo: null,
          isNew: true, isDirty: false,
        })
      }
    }
    setRows(allRows)
    setLoading(false)
    setSaved(false)
  }, [viewYear])

  useEffect(() => { loadData() }, [loadData])

  const updateField = (month: number, key: keyof ManualRow, value: string) => {
    setRows(prev => prev.map(r => {
      if (r.month !== month) return r
      const updated = { ...r, isDirty: true }
      if (key === 'memo') {
        updated[key] = value || null
      } else {
        const field = FIELDS.find(f => f.key === key)
        if (field?.type === 'float') {
          (updated as Record<string, unknown>)[key] = value ? parseFloat(value) : null
        } else {
          (updated as Record<string, unknown>)[key] = value ? parseInt(value) : null
        }
      }

      // Auto-calculate derived fields
      if (updated.slots && updated.treatments) {
        updated.utilization_rate = updated.treatments / updated.slots
      }
      if (updated.new_revenue && updated.new_patients && updated.new_patients > 0) {
        updated.new_ltv = Math.round(updated.new_revenue / updated.new_patients)
      }
      if (updated.ad_cost && updated.new_patients && updated.new_patients > 0) {
        updated.cpa = Math.round(updated.ad_cost / updated.new_patients)
      }
      if (updated.new_ltv != null && updated.cpa != null) {
        updated.profit_ltv = updated.new_ltv - updated.cpa
      }
      if (updated.chart_count && updated.treatments && updated.chart_count > 0) {
        updated.frequency = Math.round((updated.treatments / updated.chart_count) * 10) / 10
      }

      return updated
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    const dirtyRows = rows.filter(r => r.isDirty)

    for (const r of dirtyRows) {
      const payload = {
        clinic_id: clinicId,
        year: viewYear,
        month: r.month,
        slots: r.slots,
        treatments: r.treatments,
        chart_count: r.chart_count,
        frequency: r.frequency,
        avg_price: r.avg_price,
        new_patients: r.new_patients,
        revenue: r.revenue,
        new_revenue: r.new_revenue,
        existing_revenue: r.existing_revenue,
        ad_cost: r.ad_cost,
        new_ltv: r.new_ltv,
        cpa: r.cpa,
        profit_ltv: r.profit_ltv,
        utilization_rate: r.utilization_rate,
        target_revenue: r.target_revenue,
        memo: r.memo,
      }

      await supabase.from('cm_monthly_stats').upsert(payload, {
        onConflict: 'clinic_id,year,month',
      })
    }

    setSaving(false)
    setSaved(true)
    loadData()
  }

  const dirtyCount = rows.filter(r => r.isDirty).length

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i)

  const inputClass = "px-1.5 py-1 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#14252A] focus:border-transparent bg-white"

  return (
    <AppShell>
      <Header title="月間統計 手動入力" />
      <div className="px-4 py-4 max-w-6xl mx-auto space-y-4">

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
          過去の統計データを手動で入力できます。来院記録がまだ無い期間の数字を補完する用途です。
          <br />来院記録がある月は、統計ページで自動集計された数字が優先されます。
          <br />LTV・CPA・利益LTV・頻度・稼働率は自動計算されます。
        </div>

        {/* Year selector + save button */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2">
            {years.map(y => (
              <button key={y} onClick={() => setViewYear(y)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  viewYear === y ? 'border-[#14252A] bg-[#14252A] text-white' : 'border-gray-200 text-gray-500 bg-white'
                }`}
              >{y}年</button>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || dirtyCount === 0}
            className="px-6 py-2 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-all"
            style={{ background: '#14252A' }}
          >
            {saving ? '保存中...' : saved ? '保存しました' : `保存する (${dirtyCount}件)`}
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2" style={{ borderColor: '#14252A' }}>
                  <th className="px-2 py-2 text-left text-gray-500 sticky left-0 bg-white z-10 w-12">月</th>
                  {FIELDS.map(f => (
                    <th key={f.key} className="px-1 py-2 text-center text-gray-500">{f.label}</th>
                  ))}
                  <th className="px-1 py-2 text-center text-gray-500">稼働率</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.month} className={`border-b border-gray-100 ${r.isDirty ? 'bg-yellow-50' : ''}`}>
                    <td className="px-2 py-1.5 font-medium text-gray-800 sticky left-0 z-10" style={{ background: r.isDirty ? '#fefce8' : 'white' }}>
                      {r.month}月
                      {r.isDirty && <span className="text-yellow-500 ml-1">*</span>}
                    </td>
                    {FIELDS.map(f => (
                      <td key={f.key} className="px-1 py-1">
                        {f.type === 'text' ? (
                          <input
                            type="text"
                            value={r[f.key] as string || ''}
                            onChange={e => updateField(r.month, f.key, e.target.value)}
                            className={`${inputClass} ${f.width} text-left`}
                            placeholder="-"
                          />
                        ) : (
                          <input
                            type="number"
                            value={r[f.key] != null ? String(r[f.key]) : ''}
                            onChange={e => updateField(r.month, f.key, e.target.value)}
                            className={`${inputClass} ${f.width}`}
                            placeholder="-"
                            step={f.type === 'float' ? '0.1' : '1'}
                          />
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center text-gray-600">
                      {r.utilization_rate != null ? `${Math.round(r.utilization_rate * 100)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom save button for mobile */}
        {dirtyCount > 0 && (
          <div className="sticky bottom-20 z-40">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 text-white rounded-xl font-bold text-sm shadow-lg transition-all active:scale-95"
              style={{ background: '#14252A' }}
            >
              {saving ? '保存中...' : `${dirtyCount}件の変更を保存`}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
