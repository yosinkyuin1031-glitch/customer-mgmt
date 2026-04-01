'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { getClinicId } from '@/lib/clinic'
import { syncPatientStats } from '@/lib/patientSync'
import type { Patient, Slip, CouponBook } from '@/lib/types'
import { REFERRAL_SOURCES, PREFECTURES, COUPON_TYPES } from '@/lib/types'

// バリデーション関数
function validateEmail(email: string): boolean {
  if (!email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validatePhone(phone: string): boolean {
  if (!phone) return true
  const normalized = phone.replace(/[-\s\u3000()（）ー－]/g, '')
  return /^\d{10,11}$/.test(normalized)
}

function validateZipcode(zipcode: string): boolean {
  if (!zipcode) return true
  const normalized = zipcode.replace(/[-ー－]/g, '')
  return /^\d{7}$/.test(normalized)
}

// ── Confirmation Modal ──
function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = '削除',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', handleKey)
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="bg-white rounded-lg shadow-xl w-[90%] max-w-sm mx-4 p-6"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-800">{title}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{message}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
            aria-label="キャンセル"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
            aria-label={confirmLabel}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Undo Toast ──
function UndoToast({
  message,
  onUndo,
  onDismiss,
}: {
  message: string
  onUndo: () => void
  onDismiss: () => void
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 5000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onDismiss])

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 max-w-sm w-[90%] animate-[slideUp_0.3s_ease-out]">
      <span className="text-sm flex-1">{message}</span>
      <button
        onClick={() => {
          if (timerRef.current) clearTimeout(timerRef.current)
          onUndo()
        }}
        className="text-sm font-bold text-blue-300 hover:text-blue-200 whitespace-nowrap"
        aria-label="元に戻す"
      >
        元に戻す
      </button>
    </div>
  )
}

// ── Skeleton components ──
function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className || ''}`} />
}

function PatientDetailSkeleton() {
  return (
    <AppShell>
      <Header title="患者詳細" />
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {/* Patient info card */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex justify-between items-start mb-4">
            <div className="space-y-2">
              <SkeletonBlock className="h-7 w-36" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
            <SkeletonBlock className="h-6 w-16 rounded-full" />
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-4 w-20" />
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-4 w-32" />
            </div>
            <div className="border-t pt-3 mt-3">
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonBlock className="h-4 w-56 mt-2" />
            </div>
            <div className="border-t pt-3 mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-4 w-28" />
            </div>
            <SkeletonBlock className="h-16 w-full rounded-lg" />
            <div className="flex gap-2 mt-3">
              <SkeletonBlock className="h-9 flex-1 rounded-lg" />
              <SkeletonBlock className="h-9 w-16 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-4 text-center">
              <SkeletonBlock className="h-7 w-12 mx-auto" />
              <SkeletonBlock className="h-3 w-16 mx-auto mt-2" />
            </div>
          ))}
        </div>

        {/* Visit period */}
        <div className="bg-white rounded-xl shadow-sm p-3">
          <div className="flex justify-between">
            <SkeletonBlock className="h-3 w-32" />
            <SkeletonBlock className="h-3 w-32" />
          </div>
        </div>

        {/* Add button */}
        <SkeletonBlock className="h-12 w-full rounded-xl" />

        {/* Slips table */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <SkeletonBlock className="h-5 w-40 mb-3" />
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map(i => (
              <SkeletonBlock key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default function PatientDetailPage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [patient, setPatient] = useState<Patient | null>(null)
  const [slips, setSlips] = useState<Slip[]>([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Patient>>({})
  const [loading, setLoading] = useState(true)
  const [showAllSlips, setShowAllSlips] = useState(false)
  const [editingSlip, setEditingSlip] = useState<string | null>(null)
  const [slipForm, setSlipForm] = useState<Partial<Slip>>({})
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [slipErrors, setSlipErrors] = useState<Record<string, string>>({})
  const [couponBooks, setCouponBooks] = useState<CouponBook[]>([])
  const [couponLoaded, setCouponLoaded] = useState(false)
  const [showCouponForm, setShowCouponForm] = useState(false)
  const [couponForm, setCouponForm] = useState({
    coupon_type: '15回券',
    total_count: 15,
    purchase_amount: 150000,
    purchase_date: new Date().toISOString().split('T')[0],
    consumption_start_date: new Date().toISOString().split('T')[0],
    expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
    use_different_start: false,
  })

  // Modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    title: string
    message: string
    confirmLabel: string
    onConfirm: () => void
  }>({ open: false, title: '', message: '', confirmLabel: '削除', onConfirm: () => {} })

  // Undo toast state
  const [undoToast, setUndoToast] = useState<{
    show: boolean
    message: string
    deletedSlip: Slip | null
    previousSlips: Slip[]
  }>({ show: false, message: '', deletedSlip: null, previousSlips: [] })

  const closeModal = useCallback(() => {
    setConfirmModal(prev => ({ ...prev, open: false }))
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: p } = await supabase.from('cm_patients').select('*').eq('clinic_id', clinicId).eq('id', id).single()
      if (p) {
        setPatient(p)
        setForm(p)
      }
      const { data: s } = await supabase.from('cm_slips').select('*').eq('clinic_id', clinicId).eq('patient_id', id).order('visit_date', { ascending: false })
      setSlips(s || [])
      // 回数券を読み込み（テーブルが存在しない場合はスキップ）
      try {
        const { data: cb, error: cbErr } = await supabase.from('cm_coupon_books').select('*').eq('clinic_id', clinicId).eq('patient_id', id).order('purchase_date', { ascending: false })
        if (!cbErr) {
          setCouponBooks(cb || [])
          setCouponLoaded(true)
        }
      } catch {
        // テーブルが存在しない場合はスキップ
      }
      setLoading(false)
    }
    load()
  }, [id])

  const handleUpdate = async () => {
    // バリデーション
    const newErrors: Record<string, string> = {}
    if (form.email && !validateEmail(form.email)) {
      newErrors.email = 'メールアドレスの形式が正しくありません'
    }
    if (form.phone && !validatePhone(form.phone)) {
      newErrors.phone = '電話番号は10〜11桁で入力してください'
    }
    if (form.zipcode && !validateZipcode(form.zipcode)) {
      newErrors.zipcode = '郵便番号は7桁で入力してください'
    }
    setEditErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    await supabase.from('cm_patients').update(form).eq('id', id)
    setPatient({ ...patient!, ...form })
    setEditing(false)
    setEditErrors({})
  }

  const handleDelete = () => {
    setConfirmModal({
      open: true,
      title: '患者を削除',
      message: 'この患者の情報をすべて削除します。この操作は取り消せません。',
      confirmLabel: '削除する',
      onConfirm: async () => {
        closeModal()
        await supabase.from('cm_patients').delete().eq('id', id)
        router.push('/patients')
      },
    })
  }

  const handleSlipEdit = (slip: Slip) => {
    setEditingSlip(slip.id)
    setSlipForm({ ...slip })
  }

  const handleSlipUpdate = async () => {
    if (!editingSlip) return
    // 金額バリデーション
    const newSlipErrors: Record<string, string> = {}
    if ((slipForm.total_price ?? 0) < 0) {
      newSlipErrors.total_price = '金額は0以上で入力してください'
    }
    if ((slipForm.base_price ?? 0) < 0) {
      newSlipErrors.base_price = '金額は0以上で入力してください'
    }
    if ((slipForm.option_price ?? 0) < 0) {
      newSlipErrors.option_price = '金額は0以上で入力してください'
    }
    setSlipErrors(newSlipErrors)
    if (Object.keys(newSlipErrors).length > 0) return

    const { id: _id, created_at: _c, ...updateData } = slipForm as Slip
    await supabase.from('cm_slips').update(updateData).eq('id', editingSlip)
    setSlips(slips.map(s => s.id === editingSlip ? { ...s, ...slipForm } : s))
    setEditingSlip(null)
    setSlipErrors({})
    await syncPatientStats(supabase, patient!.id, clinicId)
  }

  const handleSlipDelete = (slipId: string) => {
    setConfirmModal({
      open: true,
      title: '伝票を削除',
      message: 'この伝票を削除しますか？削除後5秒以内であれば元に戻せます。',
      confirmLabel: '削除する',
      onConfirm: async () => {
        closeModal()
        const deletedSlip = slips.find(s => s.id === slipId)
        if (!deletedSlip) return
        const previousSlips = [...slips]
        await supabase.from('cm_slips').delete().eq('id', slipId)
        setSlips(slips.filter(s => s.id !== slipId))
        setEditingSlip(null)
        await syncPatientStats(supabase, patient!.id, clinicId)
        // Show undo toast
        setUndoToast({
          show: true,
          message: '伝票を削除しました',
          deletedSlip,
          previousSlips,
        })
      },
    })
  }

  const handleUndoSlipDelete = async () => {
    if (!undoToast.deletedSlip) return
    const slip = undoToast.deletedSlip
    const { id: _id, created_at: _c, ...insertData } = slip
    const { data } = await supabase.from('cm_slips').insert(insertData).select().single()
    if (data) {
      // Re-insert and re-sort
      const updated = [...slips, data].sort((a, b) => b.visit_date.localeCompare(a.visit_date))
      setSlips(updated)
      await syncPatientStats(supabase, patient!.id, clinicId)
    }
    setUndoToast({ show: false, message: '', deletedSlip: null, previousSlips: [] })
  }

  const dismissUndoToast = useCallback(() => {
    setUndoToast({ show: false, message: '', deletedSlip: null, previousSlips: [] })
  }, [])

  // 回数券の消費を伝票から自動計算
  // 支払方法が「回数券」の伝票を、消費開始日の古い回数券から順に割り当て
  const couponBooksWithAuto = (() => {
    if (couponBooks.length === 0) return []
    // 回数券伝票を日付順に取得
    const couponSlips = slips
      .filter(s => s.payment_method === '回数券')
      .sort((a, b) => a.visit_date.localeCompare(b.visit_date))

    // 回数券を消費開始日順にソート（古い順）
    const sorted = [...couponBooks].sort((a, b) => {
      const dateA = a.consumption_start_date || a.purchase_date
      const dateB = b.consumption_start_date || b.purchase_date
      return dateA.localeCompare(dateB)
    })

    // 各回数券に伝票を割り当て
    let slipIndex = 0
    return sorted.map(cb => {
      const startDate = cb.consumption_start_date || cb.purchase_date
      let used = 0
      const assignedSlips: Slip[] = []

      while (slipIndex < couponSlips.length && used < cb.total_count) {
        const slip = couponSlips[slipIndex]
        if (slip.visit_date >= startDate) {
          used++
          assignedSlips.push(slip)
          slipIndex++
        } else {
          slipIndex++
        }
      }

      const autoStatus = used >= cb.total_count ? 'completed' as const
        : (cb.expiry_date && new Date(cb.expiry_date) < new Date()) ? 'expired' as const
        : 'active' as const

      return {
        ...cb,
        used_count: used,
        remaining_count: cb.total_count - used,
        status: cb.status === 'refunded' ? cb.status : autoStatus,
        assignedSlips,
      }
    })
  })()

  // 回数券: 新規登録
  const handleCouponCreate = async () => {
    if (!patient) return
    const { data, error } = await supabase.from('cm_coupon_books').insert({
      clinic_id: clinicId,
      patient_id: id,
      patient_name: patient.name,
      coupon_type: couponForm.coupon_type,
      total_count: couponForm.total_count,
      used_count: 0,
      purchase_date: couponForm.purchase_date,
      consumption_start_date: couponForm.use_different_start ? couponForm.consumption_start_date : couponForm.purchase_date,
      purchase_amount: couponForm.purchase_amount,
      expiry_date: couponForm.expiry_date || null,
      status: 'active',
      notes: couponForm.notes || null,
    }).select().single()
    if (!error && data) {
      setCouponBooks([data, ...couponBooks])
      setShowCouponForm(false)
      setCouponForm({
        coupon_type: '15回券',
        total_count: 15,
        purchase_amount: 150000,
        purchase_date: new Date().toISOString().split('T')[0],
        consumption_start_date: new Date().toISOString().split('T')[0],
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: '',
        use_different_start: false,
      })
    }
  }

  // 回数券: 券種変更ハンドラ
  const handleCouponTypeChange = (label: string) => {
    const ct = COUPON_TYPES.find(t => t.label === label)
    if (ct) {
      if (ct.label === 'カスタム') {
        setCouponForm({ ...couponForm, coupon_type: label, total_count: 0, purchase_amount: 0 })
      } else {
        setCouponForm({ ...couponForm, coupon_type: label, total_count: ct.count, purchase_amount: ct.price })
      }
    }
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A]"

  if (loading) return <PatientDetailSkeleton />
  if (!patient) return <AppShell><Header title="患者詳細" /><p className="text-center py-8 text-gray-400">患者が見つかりません</p></AppShell>

  const age = patient.birth_date
    ? Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  // cm_slipsから一貫して計算（重複なし）
  const visitCount = slips.length
  const ltvValue = slips.reduce((sum, s) => sum + (s.total_price || 0), 0)
  const avgPrice = visitCount > 0 ? Math.round(ltvValue / visitCount) : 0

  const firstVisit = slips.length > 0 ? slips[slips.length - 1].visit_date : patient.first_visit_date
  const lastVisit = slips.length > 0 ? slips[0].visit_date : patient.last_visit_date
  const daysSince = lastVisit
    ? Math.floor((Date.now() - new Date(lastVisit).getTime()) / (24 * 60 * 60 * 1000))
    : null

  const fullAddress = [patient.prefecture, patient.city, patient.address, patient.building].filter(Boolean).join('')

  const displaySlips = showAllSlips ? slips : slips.slice(0, 10)

  return (
    <AppShell>
      <Header title="患者詳細" />
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

        {/* Confirmation Modal */}
        <ConfirmModal
          open={confirmModal.open}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          onConfirm={confirmModal.onConfirm}
          onCancel={closeModal}
        />

        {/* Undo Toast */}
        {undoToast.show && (
          <UndoToast
            message={undoToast.message}
            onUndo={handleUndoSlipDelete}
            onDismiss={dismissUndoToast}
          />
        )}

        {/* 患者基本情報 */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{patient.name}</h2>
              {patient.furigana && <p className="text-xs text-gray-400 mt-0.5">{patient.furigana}</p>}
            </div>
            <div className="flex items-center gap-2">
              {patient.is_direct_mail && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">DM可</span>
              )}
              <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
                patient.status === 'active' ? 'bg-green-100 text-green-700 border border-green-200' :
                patient.status === 'completed' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                'bg-gray-100 text-gray-500 border border-gray-200'
              }`}>
                {patient.status === 'active' ? '通院中' : patient.status === 'completed' ? '卒業' : '休止'}
              </span>
            </div>
          </div>

          {!editing ? (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {age !== null && <p><span className="text-gray-500">🎂 年齢:</span> {age}歳</p>}
                {patient.gender && <p><span className="text-gray-500">👤 性別:</span> {patient.gender}</p>}
                {patient.birth_date && <p><span className="text-gray-500">📅 生年月日:</span> {patient.birth_date}</p>}
                {patient.phone && <p><span className="text-gray-500">📱 TEL:</span> <a href={`sms:${patient.phone.replace(/[-ー－\s]/g, '')}`} className="text-blue-600 underline">{patient.phone}</a></p>}
                {patient.email && <p className="col-span-2"><span className="text-gray-500">✉️ Email:</span> <a href={`mailto:${patient.email}`} className="text-blue-600 underline">{patient.email}</a></p>}
              </div>

              {(patient.zipcode || fullAddress) && (
                <div className="border-t pt-2 mt-2">
                  {patient.zipcode && <p><span className="text-gray-500">〒</span> {patient.zipcode}</p>}
                  {fullAddress && <p><span className="text-gray-500">📍 住所:</span> {fullAddress}</p>}
                </div>
              )}

              <div className="border-t pt-2 mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                {patient.occupation && <p><span className="text-gray-500">💼 職業:</span> {patient.occupation}</p>}
                {patient.referral_source && <p><span className="text-gray-500">🔍 来院経路:</span> {patient.referral_source}</p>}
                {patient.visit_motive && <p><span className="text-gray-500">💡 来店動機:</span> {patient.visit_motive}</p>}
                {patient.customer_category && <p><span className="text-gray-500">🏷️ 顧客区分:</span> {patient.customer_category}</p>}
              </div>

              {patient.chief_complaint && (
                <div className="mt-2 bg-yellow-50 rounded-lg p-3">
                  <p className="text-xs font-bold text-yellow-700 mb-1">主訴</p>
                  <p className="text-sm text-gray-700">{patient.chief_complaint}</p>
                </div>
              )}
              {patient.medical_history && (
                <div className="mt-2 bg-red-50 rounded-lg p-3">
                  <p className="text-xs font-bold text-red-700 mb-1">既往歴</p>
                  <p className="text-sm text-gray-700">{patient.medical_history}</p>
                </div>
              )}

              {/* LINE情報 */}
              {(patient.line_date || patient.line_count > 0) && (
                <div className="mt-2 bg-green-50 rounded-lg p-3">
                  <p className="text-xs font-bold text-green-700 mb-1">LINE</p>
                  <div className="flex gap-4 text-sm">
                    {patient.line_date && <p><span className="text-gray-500">連携日:</span> {patient.line_date}</p>}
                    {patient.line_count > 0 && <p><span className="text-gray-500">配信回数:</span> {patient.line_count}回</p>}
                  </div>
                </div>
              )}

              {patient.notes && (
                <div className="mt-2 bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-bold text-gray-500 mb-1">メモ</p>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{patient.notes}</p>
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <button onClick={() => setEditing(true)} className="flex-1 text-sm py-2 border border-gray-300 rounded-lg text-gray-600" aria-label="患者情報を編集">編集</button>
                <button onClick={handleDelete} className="text-sm py-2 px-4 text-red-500 border border-red-200 rounded-lg" aria-label="この患者を削除">削除</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">基本情報</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">氏名</label>
                  <input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ふりがな</label>
                  <input value={form.furigana || ''} onChange={e => setForm({...form, furigana: e.target.value})} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">生年月日</label>
                  <input type="date" value={form.birth_date || ''} onChange={e => setForm({...form, birth_date: e.target.value})} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">性別</label>
                  <select value={form.gender || '男性'} onChange={e => setForm({...form, gender: e.target.value as Patient['gender']})} className={inputClass}>
                    <option value="男性">男性</option>
                    <option value="女性">女性</option>
                    <option value="その他">その他</option>
                  </select>
                </div>
              </div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider pt-2 border-t mt-1">連絡先</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">電話番号</label>
                  <input value={form.phone || ''} onChange={e => { setForm({...form, phone: e.target.value}); setEditErrors(prev => { const n = {...prev}; delete n.phone; return n }) }} className={`${inputClass} ${editErrors.phone ? 'border-red-400 focus:ring-red-400' : ''}`} />
                  {editErrors.phone && <p className="text-xs text-red-500 mt-1">{editErrors.phone}</p>}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">メール</label>
                  <input value={form.email || ''} onChange={e => { setForm({...form, email: e.target.value}); setEditErrors(prev => { const n = {...prev}; delete n.email; return n }) }} className={`${inputClass} ${editErrors.email ? 'border-red-400 focus:ring-red-400' : ''}`} />
                  {editErrors.email && <p className="text-xs text-red-500 mt-1">{editErrors.email}</p>}
                </div>
              </div>

              <div className="border-t pt-2">
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">住所</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">郵便番号</label>
                    <input value={form.zipcode || ''} onChange={e => { setForm({...form, zipcode: e.target.value}); setEditErrors(prev => { const n = {...prev}; delete n.zipcode; return n }) }} placeholder="000-0000" className={`${inputClass} ${editErrors.zipcode ? 'border-red-400 focus:ring-red-400' : ''}`} />
                    {editErrors.zipcode && <p className="text-xs text-red-500 mt-1">{editErrors.zipcode}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">都道府県</label>
                    <select value={form.prefecture || ''} onChange={e => setForm({...form, prefecture: e.target.value})} className={inputClass}>
                      <option value="">選択</option>
                      {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-xs text-gray-500 mb-1">市区町村</label>
                  <input value={form.city || ''} onChange={e => setForm({...form, city: e.target.value})} className={inputClass} />
                </div>
                <div className="mt-2">
                  <label className="block text-xs text-gray-500 mb-1">番地</label>
                  <input value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} className={inputClass} />
                </div>
                <div className="mt-2">
                  <label className="block text-xs text-gray-500 mb-1">建物名・部屋番号</label>
                  <input value={form.building || ''} onChange={e => setForm({...form, building: e.target.value})} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">職業</label>
                  <input value={form.occupation || ''} onChange={e => setForm({...form, occupation: e.target.value})} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">来院経路</label>
                  <select value={form.referral_source || ''} onChange={e => setForm({...form, referral_source: e.target.value})} className={inputClass}>
                    <option value="">選択</option>
                    {REFERRAL_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">主訴</label>
                <textarea value={form.chief_complaint || ''} onChange={e => setForm({...form, chief_complaint: e.target.value})} className={inputClass} rows={2} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">既往歴</label>
                <textarea value={form.medical_history || ''} onChange={e => setForm({...form, medical_history: e.target.value})} className={inputClass} rows={2} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ステータス</label>
                  <select value={form.status || 'active'} onChange={e => setForm({...form, status: e.target.value as Patient['status']})} className={inputClass} aria-label="患者ステータスを変更">
                    <option value="active">通院中</option>
                    <option value="inactive">休止</option>
                    <option value="completed">卒業</option>
                  </select>
                </div>
                <div className="flex items-end gap-3 pb-2">
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={form.is_direct_mail ?? true} onChange={e => setForm({...form, is_direct_mail: e.target.checked})} />
                    DM可
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={form.is_enabled ?? true} onChange={e => setForm({...form, is_enabled: e.target.checked})} />
                    有効
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">メモ</label>
                <textarea value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} className={inputClass} rows={2} />
              </div>

              <div className="flex gap-2">
                <button onClick={handleUpdate} className="flex-1 text-white py-2 rounded-lg text-sm font-bold" style={{ background: '#14252A' }} aria-label="変更を保存">保存</button>
                <button onClick={() => { setEditing(false); setForm(patient) }} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600" aria-label="編集をキャンセル">キャンセル</button>
              </div>
            </div>
          )}
        </div>

        {/* 施術サマリー */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center border-t-4" style={{ borderTopColor: '#14252A' }}>
            <p className="text-2xl font-bold" style={{ color: '#14252A' }}>{visitCount}</p>
            <p className="text-xs text-gray-500 mt-1">来院回数</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center border-t-4 border-t-blue-500">
            <p className="text-2xl font-bold text-blue-600">{ltvValue.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">LTV(円)</p>
            <p className="text-[10px] text-gray-400">(自動計算)</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center border-t-4 border-t-green-500">
            <p className="text-2xl font-bold text-green-600">{avgPrice.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">平均単価(円)</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center border-t-4 border-t-orange-500">
            <p className="text-2xl font-bold text-orange-600">{daysSince !== null && daysSince !== undefined ? daysSince : '-'}</p>
            <p className="text-xs text-gray-500 mt-1">最終来院(日前)</p>
          </div>
        </div>

        {/* 来院期間 */}
        {firstVisit && (
          <div className="bg-white rounded-xl shadow-sm p-3">
            <div className="flex justify-between text-xs text-gray-500">
              <span>初回来院: {firstVisit}</span>
              <span>最終来院: {lastVisit}</span>
            </div>
          </div>
        )}

        {/* 施術記録ボタン */}
        <Link
          href={`/visits/new?patient_id=${id}`}
          className="block w-full bg-blue-600 text-white text-center py-3 rounded-xl font-bold text-sm"
          aria-label="この患者の施術記録を新規追加"
        >
          + この患者の施術記録を追加
        </Link>

        {/* 回数券セクション */}
        {couponLoaded && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-800">回数券
                {couponBooks.length > 0 && <span className="text-xs text-gray-400 font-normal ml-1">（{couponBooks.length}件）</span>}
              </h3>
              <button
                onClick={() => setShowCouponForm(!showCouponForm)}
                className="text-xs px-3 py-1.5 rounded-lg font-bold text-white"
                style={{ background: '#14252A' }}
                aria-label={showCouponForm ? '回数券登録フォームを閉じる' : '回数券を新規登録'}
              >
                {showCouponForm ? '閉じる' : '+ 回数券を登録'}
              </button>
            </div>

            {/* 簡易登録フォーム */}
            {showCouponForm && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                <p className="text-xs font-bold text-gray-700 mb-3">回数券を新規登録</p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">券種</label>
                    <select
                      value={couponForm.coupon_type}
                      onChange={e => handleCouponTypeChange(e.target.value)}
                      className={inputClass}
                    >
                      {COUPON_TYPES.map(ct => (
                        <option key={ct.label} value={ct.label}>{ct.label}{ct.price > 0 ? `（¥${ct.price.toLocaleString()}）` : ''}</option>
                      ))}
                    </select>
                  </div>
                  {couponForm.coupon_type === 'カスタム' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">回数</label>
                        <input type="number" value={couponForm.total_count || ''} onChange={e => setCouponForm({ ...couponForm, total_count: parseInt(e.target.value) || 0 })} className={inputClass} placeholder="例: 10" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">金額</label>
                        <input type="number" value={couponForm.purchase_amount || ''} onChange={e => setCouponForm({ ...couponForm, purchase_amount: parseInt(e.target.value) || 0 })} className={inputClass} placeholder="例: 100000" />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">購入日</label>
                      <input type="date" value={couponForm.purchase_date} onChange={e => setCouponForm({ ...couponForm, purchase_date: e.target.value, consumption_start_date: couponForm.use_different_start ? couponForm.consumption_start_date : e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">有効期限</label>
                      <input type="date" value={couponForm.expiry_date} onChange={e => setCouponForm({ ...couponForm, expiry_date: e.target.value })} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={couponForm.use_different_start}
                        onChange={(e) => setCouponForm({
                          ...couponForm,
                          use_different_start: e.target.checked,
                          consumption_start_date: e.target.checked ? couponForm.consumption_start_date : couponForm.purchase_date,
                        })}
                        className="w-3.5 h-3.5 rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-500">消費開始日を別に設定</span>
                    </label>
                    {couponForm.use_different_start && (
                      <input type="date" value={couponForm.consumption_start_date} onChange={e => setCouponForm({ ...couponForm, consumption_start_date: e.target.value })} className={`${inputClass} mt-1`} />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">メモ</label>
                    <input value={couponForm.notes} onChange={e => setCouponForm({ ...couponForm, notes: e.target.value })} className={inputClass} placeholder="任意" />
                  </div>
                  <button
                    onClick={handleCouponCreate}
                    disabled={couponForm.total_count <= 0}
                    className="w-full text-white py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                    style={{ background: '#14252A' }}
                    aria-label="回数券を保存"
                  >
                    保存
                  </button>
                </div>
              </div>
            )}

            {/* 回数券一覧（伝票から自動計算） */}
            {couponBooksWithAuto.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-2">回数券はまだ登録されていません</p>
            ) : (
              <div className="space-y-3">
                {couponBooksWithAuto.map(cb => {
                  const usageRate = cb.total_count > 0 ? cb.used_count / cb.total_count : 0
                  const barColor = usageRate >= 1 ? '#3B82F6' : usageRate >= 0.7 ? '#F59E0B' : '#14252A'
                  const statusLabel: Record<string, string> = { active: '利用中', completed: '使い切り', expired: '期限切れ', refunded: '返金済' }
                  const statusColor: Record<string, string> = { active: 'bg-green-100 text-green-700', completed: 'bg-blue-100 text-blue-700', expired: 'bg-gray-100 text-gray-500', refunded: 'bg-red-100 text-red-600' }

                  // 消費ペース計算
                  const startDate = cb.consumption_start_date || cb.purchase_date
                  const daysSinceStart = Math.max(1, Math.floor((Date.now() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000)))
                  const daysPerUse = cb.used_count > 0 ? Math.round(daysSinceStart / cb.used_count) : 0
                  const estimatedDaysLeft = cb.remaining_count > 0 && daysPerUse > 0 ? daysPerUse * cb.remaining_count : null

                  return (
                    <div key={cb.id} className="border border-gray-200 rounded-xl p-3">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-800">{cb.coupon_type}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColor[cb.status] || 'bg-gray-100 text-gray-500'}`}>
                            {statusLabel[cb.status] || cb.status}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">¥{cb.purchase_amount.toLocaleString()}</span>
                      </div>
                      {/* プログレスバー */}
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>消費 {cb.used_count} / {cb.total_count} 回</span>
                          <span>残り {cb.remaining_count} 回</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5" role="progressbar" aria-valuenow={cb.used_count} aria-valuemin={0} aria-valuemax={cb.total_count} aria-label={`回数券消費状況: ${cb.used_count}/${cb.total_count}回`}>
                          <div className="h-2.5 rounded-full transition-all" style={{ width: `${Math.min(usageRate * 100, 100)}%`, backgroundColor: barColor }} />
                        </div>
                      </div>
                      {/* 消費ペース */}
                      {cb.status === 'active' && cb.used_count > 0 && (
                        <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2 text-xs text-gray-600">
                          <div className="flex justify-between">
                            <span>消費ペース: 約{daysPerUse}日に1回</span>
                            {estimatedDaysLeft && (
                              <span>残り約{estimatedDaysLeft}日で消費</span>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <div>
                          <span>購入: {cb.purchase_date}</span>
                          {cb.consumption_start_date && cb.consumption_start_date !== cb.purchase_date && (
                            <span className="ml-2 text-blue-500">開始: {cb.consumption_start_date}</span>
                          )}
                          {cb.expiry_date && <span className="ml-2">期限: {cb.expiry_date}</span>}
                        </div>
                      </div>
                      {cb.notes && <p className="text-xs text-gray-400 mt-1">{cb.notes}</p>}
                    </div>
                  )
                })}
                <p className="text-[10px] text-gray-400 text-center">
                  ※ 支払方法「回数券」の来院記録から自動計算されます
                </p>
              </div>
            )}
          </div>
        )}

        {/* 来院・売上履歴（cm_slips） */}
        {slips.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-gray-800 mb-3">来院・売上履歴 <span className="text-xs text-gray-400 font-normal">（全{visitCount}件）</span></h3>

            {/* 伝票編集モーダル */}
            {editingSlip && (
              <div className="bg-blue-50 rounded-xl p-4 mb-3 border border-blue-200">
                <p className="text-xs font-bold text-gray-700 mb-3">伝票を編集</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">来院日</label>
                    <input type="date" value={slipForm.visit_date || ''} onChange={e => setSlipForm({...slipForm, visit_date: e.target.value})} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">担当</label>
                    <input value={slipForm.staff_name || ''} onChange={e => setSlipForm({...slipForm, staff_name: e.target.value})} className={inputClass} />
                  </div>
                </div>
                <div className="mb-2">
                  <label className="block text-xs text-gray-500 mb-1">メニュー名</label>
                  <input value={slipForm.menu_name || ''} onChange={e => setSlipForm({...slipForm, menu_name: e.target.value})} className={inputClass} />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">基本料金</label>
                    <input type="number" value={slipForm.base_price ?? 0} onChange={e => {
                      const base = parseInt(e.target.value) || 0
                      setSlipForm({...slipForm, base_price: base, total_price: base + (slipForm.option_price || 0) - (slipForm.discount || 0)})
                    }} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">オプション</label>
                    <input type="number" value={slipForm.option_price ?? 0} onChange={e => {
                      const opt = parseInt(e.target.value) || 0
                      setSlipForm({...slipForm, option_price: opt, total_price: (slipForm.base_price || 0) + opt - (slipForm.discount || 0)})
                    }} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">割引</label>
                    <input type="number" value={slipForm.discount ?? 0} onChange={e => {
                      const disc = parseInt(e.target.value) || 0
                      setSlipForm({...slipForm, discount: disc, total_price: (slipForm.base_price || 0) + (slipForm.option_price || 0) - disc})
                    }} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">合計金額</label>
                    <input type="number" value={slipForm.total_price ?? 0} onChange={e => { setSlipForm({...slipForm, total_price: parseInt(e.target.value) || 0}); setSlipErrors(prev => { const n = {...prev}; delete n.total_price; return n }) }} className={`${inputClass} ${slipErrors.total_price ? 'border-red-400 focus:ring-red-400' : ''}`} min="0" />
                    {slipErrors.total_price && <p className="text-xs text-red-500 mt-1">{slipErrors.total_price}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">支払方法</label>
                    <select value={slipForm.payment_method || '現金'} onChange={e => setSlipForm({...slipForm, payment_method: e.target.value})} className={inputClass}>
                      <option value="現金">現金</option>
                      <option value="カード">カード</option>
                      <option value="QR決済">QR決済</option>
                      <option value="回数券">回数券</option>
                      <option value="その他">その他</option>
                    </select>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 mb-1">メモ</label>
                  <input value={slipForm.notes || ''} onChange={e => setSlipForm({...slipForm, notes: e.target.value})} className={inputClass} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSlipUpdate} className="flex-1 text-white py-2 rounded-lg text-xs font-bold" style={{ background: '#14252A' }} aria-label="伝票の変更を保存">保存</button>
                  <button onClick={() => setEditingSlip(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-xs text-gray-600" aria-label="伝票編集をキャンセル">キャンセル</button>
                  <button onClick={() => handleSlipDelete(editingSlip)} className="py-2 px-3 text-red-500 border border-red-200 rounded-lg text-xs" aria-label="この伝票を削除">削除</button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="text-left py-1 pr-2">#</th>
                    <th className="text-left py-1 pr-2">日付</th>
                    <th className="text-right py-1 pr-2">基本</th>
                    <th className="text-right py-1 pr-2">OP</th>
                    <th className="text-right py-1 font-bold">合計</th>
                    <th className="text-center py-1 pl-1 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {displaySlips.map((s, i) => (
                    <tr key={s.id} className={`border-b border-gray-100 ${editingSlip === s.id ? 'bg-blue-50' : i % 2 === 1 ? 'bg-gray-50/50' : ''} hover:bg-blue-50/30`}>
                      <td className="py-2 pr-2 text-gray-400">{slips.length - slips.indexOf(s)}</td>
                      <td className="py-2 pr-2">
                        {new Date(s.visit_date + 'T00:00:00').toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-2 pr-2 text-right">{s.base_price > 0 ? `￥${s.base_price.toLocaleString()}` : '-'}</td>
                      <td className="py-2 pr-2 text-right">{s.option_price > 0 ? `￥${s.option_price.toLocaleString()}` : '-'}</td>
                      <td className="py-2 text-right font-bold">{s.total_price > 0 ? `￥${s.total_price.toLocaleString()}` : '￥0'}</td>
                      <td className="py-2 pl-1 text-center">
                        <button onClick={() => handleSlipEdit(s)} className="text-gray-400 hover:text-blue-600 text-xs" aria-label={`${s.visit_date}の伝票を編集`}>✏️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {slips.length > 10 && !showAllSlips && (
              <button
                onClick={() => setShowAllSlips(true)}
                className="w-full mt-2 text-xs text-blue-600 py-2 border border-blue-200 rounded-lg"
                aria-label={`残り${slips.length - 10}件の来院履歴をすべて表示`}
              >
                すべて表示（残り{slips.length - 10}件）
              </button>
            )}
            {showAllSlips && slips.length > 10 && (
              <button
                onClick={() => setShowAllSlips(false)}
                className="w-full mt-2 text-xs text-gray-500 py-2 border border-gray-200 rounded-lg"
                aria-label="来院履歴を折りたたむ"
              >
                折りたたむ
              </button>
            )}
          </div>
        )}

        {slips.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-gray-400 text-sm text-center py-2">来院履歴がありません</p>
          </div>
        )}
      </div>

      {/* slideUp animation for toast */}
      <style jsx global>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </AppShell>
  )
}
