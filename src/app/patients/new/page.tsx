'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { REFERRAL_SOURCES } from '@/lib/types'

export default function NewPatientPage() {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', furigana: '', birth_date: '', gender: '男性',
    phone: '', email: '', address: '', occupation: '',
    referral_source: '', chief_complaint: '', medical_history: '', notes: '',
  })

  const update = (key: string, value: string) => setForm({ ...form, [key]: value })

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    const { error } = await supabase.from('cm_patients').insert({
      ...form,
      status: 'active',
    })
    if (!error) {
      router.push('/patients')
    }
    setSaving(false)
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A] focus:border-transparent"

  return (
    <AppShell>
      <Header title="新規患者登録" />
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-800 text-sm border-b pb-2">基本情報</h3>

          <div>
            <label className="block text-xs text-gray-600 mb-1">氏名 *</label>
            <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} className={inputClass} placeholder="大口 太郎" />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">ふりがな</label>
            <input type="text" value={form.furigana} onChange={(e) => update('furigana', e.target.value)} className={inputClass} placeholder="おおぐち たろう" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">生年月日</label>
              <input type="date" value={form.birth_date} onChange={(e) => update('birth_date', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">性別</label>
              <select value={form.gender} onChange={(e) => update('gender', e.target.value)} className={inputClass}>
                <option>男性</option>
                <option>女性</option>
                <option>その他</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">電話番号</label>
            <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} className={inputClass} placeholder="090-1234-5678" />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">メールアドレス</label>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={inputClass} placeholder="example@email.com" />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">住所</label>
            <input type="text" value={form.address} onChange={(e) => update('address', e.target.value)} className={inputClass} placeholder="大阪市住吉区..." />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">職業</label>
            <input type="text" value={form.occupation} onChange={(e) => update('occupation', e.target.value)} className={inputClass} placeholder="会社員" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-800 text-sm border-b pb-2">来院情報</h3>

          <div>
            <label className="block text-xs text-gray-600 mb-1">来院経路</label>
            <select value={form.referral_source} onChange={(e) => update('referral_source', e.target.value)} className={inputClass}>
              <option value="">選択してください</option>
              {REFERRAL_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">主訴（お困りの症状）</label>
            <textarea value={form.chief_complaint} onChange={(e) => update('chief_complaint', e.target.value)} className={inputClass} rows={3} placeholder="腰痛、肩こり、頭痛..." />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">既往歴</label>
            <textarea value={form.medical_history} onChange={(e) => update('medical_history', e.target.value)} className={inputClass} rows={2} placeholder="手術歴、持病など" />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">メモ</label>
            <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} className={inputClass} rows={2} placeholder="注意点など" />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !form.name}
          className="w-full text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50"
          style={{ background: '#14252A' }}
        >
          {saving ? '登録中...' : '患者を登録する'}
        </button>
      </div>
    </AppShell>
  )
}
