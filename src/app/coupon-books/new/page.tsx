'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { getClinicId } from '@/lib/clinic'
import { useToast } from '@/lib/toast'
import { COUPON_TYPES } from '@/lib/types'
import type { Patient } from '@/lib/types'
import { normalizeName } from '@/lib/nameMatch'

export default function NewCouponBookPage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const { showToast } = useToast()
  const router = useRouter()

  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tableError, setTableError] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const defaultExpiry = new Date()
  defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1)
  const defaultExpiryStr = defaultExpiry.toISOString().split('T')[0]

  const [form, setForm] = useState({
    patient_id: '',
    patient_name: '',
    coupon_type: '30回券',
    total_count: 30,
    purchase_amount: 285000,
    purchase_date: today,
    consumption_start_date: today,
    expiry_date: defaultExpiryStr,
    notes: '',
    is_custom: false,
    use_different_start: false,
  })

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('cm_patients')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('status', 'active')
        .order('name')
      setPatients(data || [])
    }
    load()
  }, [])

  const update = (key: string, value: string | number | boolean) => setForm(prev => ({ ...prev, [key]: value }))

  const filteredPatients = search.length > 0
    ? patients.filter(p => {
        const q = normalizeName(search)
        const name = normalizeName(p.name)
        const furigana = normalizeName(p.furigana || '')
        return name.includes(q) || q.includes(name) || furigana.includes(q) || q.includes(furigana)
      })
    : []

  const selectedPatient = patients.find(p => p.id === form.patient_id)

  const selectCouponType = (type: typeof COUPON_TYPES[number]) => {
    if (type.label === 'カスタム') {
      setForm(prev => ({
        ...prev,
        coupon_type: 'カスタム',
        total_count: prev.is_custom ? prev.total_count : 0,
        purchase_amount: prev.is_custom ? prev.purchase_amount : 0,
        is_custom: true,
      }))
    } else {
      // 有効期限を購入日から12ヶ月に再計算
      const purchaseDate = new Date(form.purchase_date)
      purchaseDate.setFullYear(purchaseDate.getFullYear() + 1)
      setForm(prev => ({
        ...prev,
        coupon_type: type.label,
        total_count: type.count,
        purchase_amount: type.price,
        expiry_date: purchaseDate.toISOString().split('T')[0],
        is_custom: false,
      }))
    }
  }

  const handlePurchaseDateChange = (date: string) => {
    const d = new Date(date)
    d.setFullYear(d.getFullYear() + 1)
    setForm(prev => ({
      ...prev,
      purchase_date: date,
      consumption_start_date: prev.use_different_start ? prev.consumption_start_date : date,
      expiry_date: d.toISOString().split('T')[0],
    }))
  }

  const handleSave = async () => {
    if (!form.patient_id || form.total_count <= 0 || form.purchase_amount <= 0) return
    setSaving(true)

    const { error } = await supabase.from('cm_coupon_books').insert({
      clinic_id: clinicId,
      patient_id: form.patient_id,
      patient_name: form.patient_name,
      coupon_type: form.coupon_type,
      total_count: form.total_count,
      used_count: 0,
      purchase_date: form.purchase_date,
      consumption_start_date: form.use_different_start ? form.consumption_start_date : form.purchase_date,
      purchase_amount: form.purchase_amount,
      expiry_date: form.expiry_date || null,
      status: 'active',
      notes: form.notes || null,
    })

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        setTableError(true)
      } else {
        console.error(error); showToast('保存に失敗しました', 'error')
      }
      setSaving(false)
      return
    }

    setSaved(true)
    setTimeout(() => router.push('/coupon-books'), 800)
    setSaving(false)
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A] focus:border-transparent"

  if (tableError) {
    return (
      <AppShell>
        <Header title="回数券登録" />
        <div className="px-4 py-8 max-w-lg mx-auto text-center">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <p className="text-4xl mb-3">⚠️</p>
            <h2 className="font-bold text-gray-800 mb-2">テーブルの初期設定が必要です</h2>
            <p className="text-sm text-gray-600 mb-4">
              回数券管理を利用するには、Supabaseでテーブルを作成する必要があります。
            </p>
            <p className="text-xs text-gray-500">
              <code className="bg-white px-2 py-1 rounded border">docs/migrations/cm_coupon_books.sql</code>
              <br />のSQLをSupabase SQL Editorで実行してください。
            </p>
          </div>
        </div>
      </AppShell>
    )
  }

  if (saved) {
    return (
      <AppShell>
        <Header title="回数券登録" />
        <div className="px-4 py-16 text-center">
          <div className="text-5xl mb-4">&#10003;</div>
          <p className="font-bold text-lg text-gray-800">登録しました</p>
        </div>
      </AppShell>
    )
  }

  const unitPrice = form.total_count > 0 ? Math.floor(form.purchase_amount / form.total_count) : 0

  return (
    <AppShell>
      <Header title="回数券登録" />
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

        {/* 1. 患者選択 */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-3 border-b pb-2">
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: '#14252A' }}>1</span>
            <h3 className="font-bold text-gray-800 text-sm">患者を選択</h3>
          </div>

          {selectedPatient ? (
            <div className="flex justify-between items-center bg-blue-50 rounded-lg p-3">
              <div>
                <p className="font-bold text-sm">{selectedPatient.name}</p>
                <p className="text-xs text-gray-500">{selectedPatient.furigana}</p>
              </div>
              <button onClick={() => { update('patient_id', ''); update('patient_name', ''); setSearch('') }} className="text-xs text-red-500 font-medium">変更</button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="患者名で検索"
                className={inputClass}
              />
              {search.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 shadow-lg z-10 max-h-48 overflow-y-auto">
                  {filteredPatients.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-gray-400 text-center">該当なし</p>
                  ) : filteredPatients.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setForm(prev => ({ ...prev, patient_id: p.id, patient_name: p.name }))
                        setSearch('')
                      }}
                      className="block w-full text-left px-3 py-2.5 hover:bg-gray-50 text-sm border-b border-gray-100"
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{p.furigana}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. 券種選択 */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-3 border-b pb-2">
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: '#14252A' }}>2</span>
            <h3 className="font-bold text-gray-800 text-sm">券種を選択</h3>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {COUPON_TYPES.map(type => (
              <button
                key={type.label}
                onClick={() => selectCouponType(type)}
                className={`px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                  form.coupon_type === type.label
                    ? 'border-[#14252A] bg-[#14252A] text-white shadow-md'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                {type.label}
                {type.price > 0 && (
                  <span className="block text-[10px] opacity-75 mt-0.5">
                    {type.price.toLocaleString()}円
                    <span className="ml-1">(@{Math.floor(type.price / type.count).toLocaleString()}円)</span>
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* カスタムの場合 */}
          {form.is_custom && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">回数</label>
                <input
                  type="number"
                  value={form.total_count || ''}
                  onChange={(e) => update('total_count', parseInt(e.target.value) || 0)}
                  placeholder="10"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">金額（円）</label>
                <input
                  type="number"
                  value={form.purchase_amount || ''}
                  onChange={(e) => update('purchase_amount', parseInt(e.target.value) || 0)}
                  placeholder="100000"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* 単価表示 */}
          {unitPrice > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">1回あたり単価</p>
              <p className="text-xl font-bold" style={{ color: '#14252A' }}>
                {unitPrice.toLocaleString()}<span className="text-sm">円</span>
              </p>
            </div>
          )}
        </div>

        {/* 3. 購入情報 */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-3 border-b pb-2">
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: '#14252A' }}>3</span>
            <h3 className="font-bold text-gray-800 text-sm">購入情報</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">購入日</label>
              <input
                type="date"
                value={form.purchase_date}
                onChange={(e) => handlePurchaseDateChange(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">有効期限</label>
              <input
                type="date"
                value={form.expiry_date}
                onChange={(e) => update('expiry_date', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* 消費開始日 */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.use_different_start}
                onChange={(e) => setForm(prev => ({
                  ...prev,
                  use_different_start: e.target.checked,
                  consumption_start_date: e.target.checked ? prev.consumption_start_date : prev.purchase_date,
                }))}
                className="w-4 h-4 rounded border-gray-300 text-[#14252A] focus:ring-[#14252A]"
              />
              <span className="text-xs text-gray-600">消費開始日を購入日と別に設定する</span>
            </label>
            {form.use_different_start && (
              <div className="mt-2">
                <label className="block text-xs text-gray-600 mb-1">消費開始日</label>
                <input
                  type="date"
                  value={form.consumption_start_date}
                  onChange={(e) => update('consumption_start_date', e.target.value)}
                  className={inputClass}
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  この日から回数券の消費カウントが開始されます
                </p>
              </div>
            )}
          </div>

          {!form.is_custom && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">購入金額（変更可）</label>
              <input
                type="number"
                value={form.purchase_amount || ''}
                onChange={(e) => update('purchase_amount', parseInt(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-600 mb-1">メモ</label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              className={inputClass}
              rows={2}
              placeholder="特記事項があれば..."
            />
          </div>
        </div>

        {/* サマリー */}
        {form.patient_id && form.total_count > 0 && (
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
            <p>患者: <span className="text-gray-800 font-medium">{form.patient_name}</span></p>
            <p>券種: <span className="text-gray-800 font-medium">{form.coupon_type}（{form.total_count}回）</span></p>
            <p>金額: <span className="text-gray-800 font-medium">{form.purchase_amount.toLocaleString()}円</span></p>
            <p>単価: <span className="text-gray-800 font-medium">{unitPrice.toLocaleString()}円/回</span></p>
            {form.use_different_start && (
              <p>消費開始: <span className="text-gray-800 font-medium">{form.consumption_start_date}</span></p>
            )}
            <p>期限: <span className="text-gray-800 font-medium">{form.expiry_date}</span></p>
          </div>
        )}

        {/* 保存ボタン */}
        <button
          onClick={handleSave}
          disabled={saving || !form.patient_id || form.total_count <= 0 || form.purchase_amount <= 0}
          className="w-full text-white py-4 rounded-xl font-bold text-base disabled:opacity-50 shadow-lg transition-all active:scale-95"
          style={{ background: '#14252A' }}
        >
          {saving ? '登録中...' : '回数券を登録する'}
        </button>
      </div>
    </AppShell>
  )
}
