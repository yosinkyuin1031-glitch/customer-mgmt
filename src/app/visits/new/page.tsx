'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { PAYMENT_METHODS } from '@/lib/types'
import type { Patient } from '@/lib/types'

function VisitForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedPatientId = searchParams.get('patient_id') || ''

  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    patient_id: preselectedPatientId,
    visit_date: new Date().toISOString().split('T')[0],
    symptoms: '',
    treatment_content: '',
    body_condition: '',
    improvement: '',
    atmosphere: '普通' as string,
    next_plan: '',
    next_appointment: '',
    payment_amount: '',
    payment_method: '現金' as string,
    notes: '',
  })

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('cm_patients').select('*').eq('status', 'active').order('name')
      setPatients(data || [])
    }
    load()
  }, [])

  const update = (key: string, value: string) => setForm({ ...form, [key]: value })

  const filteredPatients = search
    ? patients.filter(p => p.name.includes(search) || p.furigana?.includes(search))
    : []

  const selectedPatient = patients.find(p => p.id === form.patient_id)

  const handleSave = async () => {
    if (!form.patient_id || !form.visit_date) return
    setSaving(true)

    // 来院回数を取得
    const { count } = await supabase.from('cm_visit_records').select('id', { count: 'exact' }).eq('patient_id', form.patient_id)

    const { error } = await supabase.from('cm_visit_records').insert({
      ...form,
      visit_number: (count || 0) + 1,
      payment_amount: parseInt(form.payment_amount) || 0,
      next_appointment: form.next_appointment || null,
    })

    if (!error) {
      // 患者のupdated_atを更新
      await supabase.from('cm_patients').update({ updated_at: new Date().toISOString() }).eq('id', form.patient_id)
      router.push(`/patients/${form.patient_id}`)
    }
    setSaving(false)
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A] focus:border-transparent"

  return (
    <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

      {/* 患者選択 */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <h3 className="font-bold text-gray-800 text-sm border-b pb-2">患者選択</h3>

        {selectedPatient ? (
          <div className="flex justify-between items-center bg-blue-50 rounded-lg p-3">
            <div>
              <p className="font-bold text-sm">{selectedPatient.name}</p>
              <p className="text-xs text-gray-500">{selectedPatient.chief_complaint}</p>
            </div>
            <button onClick={() => { update('patient_id', ''); setSearch('') }} className="text-xs text-red-500">変更</button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="患者名で検索..."
              className={inputClass}
            />
            {filteredPatients.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 shadow-lg z-10 max-h-40 overflow-y-auto">
                {filteredPatients.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { update('patient_id', p.id); setSearch('') }}
                    className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{p.chief_complaint?.slice(0, 15)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-600 mb-1">施術日</label>
          <input type="date" value={form.visit_date} onChange={(e) => update('visit_date', e.target.value)} className={inputClass} />
        </div>
      </div>

      {/* 施術内容 */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <h3 className="font-bold text-gray-800 text-sm border-b pb-2">施術内容</h3>

        <div>
          <label className="block text-xs text-gray-600 mb-1">本日の症状</label>
          <textarea value={form.symptoms} onChange={(e) => update('symptoms', e.target.value)} className={inputClass} rows={2} placeholder="腰の痛み、右肩の張り..." />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">身体の状態</label>
          <textarea value={form.body_condition} onChange={(e) => update('body_condition', e.target.value)} className={inputClass} rows={2} placeholder="右骨盤の挙上、頚椎の回旋制限..." />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">施術内容</label>
          <textarea value={form.treatment_content} onChange={(e) => update('treatment_content', e.target.value)} className={inputClass} rows={2} placeholder="骨盤矯正、頚椎アジャスト..." />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">改善・変化</label>
          <textarea value={form.improvement} onChange={(e) => update('improvement', e.target.value)} className={inputClass} rows={2} placeholder="可動域改善、痛み軽減..." />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">反応・雰囲気</label>
          <div className="flex gap-2">
            {['良好', '普通', 'やや悪い', '悪い'].map(a => (
              <button
                key={a}
                onClick={() => update('atmosphere', a)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                  form.atmosphere === a
                    ? a === '良好' ? 'bg-green-100 border-green-500 text-green-700' :
                      a === '普通' ? 'bg-gray-100 border-gray-500 text-gray-700' :
                      'bg-red-100 border-red-500 text-red-700'
                    : 'border-gray-200 text-gray-400'
                }`}
              >{a}</button>
            ))}
          </div>
        </div>
      </div>

      {/* 次回・会計 */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <h3 className="font-bold text-gray-800 text-sm border-b pb-2">次回予定・会計</h3>

        <div>
          <label className="block text-xs text-gray-600 mb-1">次回の方針</label>
          <textarea value={form.next_plan} onChange={(e) => update('next_plan', e.target.value)} className={inputClass} rows={2} placeholder="次回は上半身中心に..." />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">次回予約日</label>
          <input type="date" value={form.next_appointment} onChange={(e) => update('next_appointment', e.target.value)} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">施術料金（円）</label>
            <input type="number" value={form.payment_amount} onChange={(e) => update('payment_amount', e.target.value)} className={inputClass} placeholder="8000" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">支払方法</label>
            <select value={form.payment_method} onChange={(e) => update('payment_method', e.target.value)} className={inputClass}>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">メモ</label>
          <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} className={inputClass} rows={2} placeholder="特記事項" />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !form.patient_id}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50"
      >
        {saving ? '保存中...' : '施術記録を保存'}
      </button>
    </div>
  )
}

export default function NewVisitPage() {
  return (
    <AppShell>
      <Header title="施術記録" />
      <Suspense fallback={<p className="text-center py-8 text-gray-400">読み込み中...</p>}>
        <VisitForm />
      </Suspense>
    </AppShell>
  )
}
