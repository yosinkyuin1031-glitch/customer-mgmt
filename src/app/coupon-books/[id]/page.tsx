'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { getClinicId } from '@/lib/clinic'
import { useToast } from '@/lib/toast'
import type { CouponBook, Slip } from '@/lib/types'

export default function CouponBookDetailPage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const { showToast } = useToast()
  const router = useRouter()
  const params = useParams()
  const couponId = params.id as string

  const [coupon, setCoupon] = useState<CouponBook | null>(null)
  const [usageHistory, setUsageHistory] = useState<Slip[]>([])
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)
  const [updating, setUpdating] = useState(false)

  const loadCoupon = async () => {
    const { data, error } = await supabase
      .from('cm_coupon_books')
      .select('*')
      .eq('id', couponId)
      .eq('clinic_id', clinicId)
      .single()

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        setTableError(true)
      }
      setLoading(false)
      return
    }

    setCoupon(data)

    if (data?.patient_id) {
      const { data: slips } = await supabase
        .from('cm_slips')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('patient_id', data.patient_id)
        .eq('payment_method', '回数券')
        .order('visit_date', { ascending: false })
      setUsageHistory(slips || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadCoupon()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponId])

  const handleUse = async () => {
    if (!coupon || coupon.remaining_count <= 0 || updating) return
    setUpdating(true)

    const newUsedCount = coupon.used_count + 1
    const newStatus = newUsedCount >= coupon.total_count ? 'completed' : 'active'

    const { error } = await supabase
      .from('cm_coupon_books')
      .update({ used_count: newUsedCount, status: newStatus })
      .eq('id', couponId)

    if (!error) {
      await loadCoupon()
    } else {
      showToast('更新に失敗しました: ' + error.message, 'error')
    }
    setUpdating(false)
  }

  const handleUndo = async () => {
    if (!coupon || coupon.used_count <= 0 || updating) return
    setUpdating(true)

    const newUsedCount = coupon.used_count - 1
    const newStatus = newUsedCount < coupon.total_count ? 'active' : coupon.status

    const { error } = await supabase
      .from('cm_coupon_books')
      .update({ used_count: newUsedCount, status: newStatus })
      .eq('id', couponId)

    if (!error) {
      await loadCoupon()
    } else {
      showToast('更新に失敗しました: ' + error.message, 'error')
    }
    setUpdating(false)
  }

  const handleDelete = async () => {
    if (!confirm('この回数券を削除しますか？')) return
    setUpdating(true)

    const { error } = await supabase
      .from('cm_coupon_books')
      .delete()
      .eq('id', couponId)

    if (!error) {
      router.push('/coupon-books')
    } else {
      showToast('削除に失敗しました: ' + error.message, 'error')
    }
    setUpdating(false)
  }

  // --- Render states ---

  if (tableError) {
    return (
      <AppShell>
        <Header title="回数券詳細" />
        <div className="px-4 py-8 max-w-lg mx-auto text-center">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <p className="text-4xl mb-3">⚠️</p>
            <h2 className="font-bold text-gray-800 mb-2">テーブルの初期設定が必要です</h2>
            <p className="text-sm text-gray-600">
              <code className="bg-white px-2 py-1 rounded border">docs/migrations/cm_coupon_books.sql</code>
              のSQLを実行してください。
            </p>
          </div>
        </div>
      </AppShell>
    )
  }

  if (loading) {
    return (
      <AppShell>
        <Header title="回数券詳細" />
        <p className="text-gray-400 text-center py-8">読み込み中...</p>
      </AppShell>
    )
  }

  if (!coupon) {
    return (
      <AppShell>
        <Header title="回数券詳細" />
        <div className="px-4 py-8 text-center">
          <p className="text-gray-400">回数券が見つかりません</p>
          <Link href="/coupon-books" className="text-blue-600 text-sm mt-2 inline-block">一覧に戻る</Link>
        </div>
      </AppShell>
    )
  }

  // --- Computed values ---

  const progressPercent = coupon.total_count > 0
    ? (coupon.used_count / coupon.total_count) * 100
    : 0
  const today = new Date().toISOString().split('T')[0]
  const isExpired = coupon.expiry_date && coupon.status === 'active' && today > coupon.expiry_date
  const isExpiringSoon = coupon.expiry_date && coupon.status === 'active' && !isExpired
    ? (new Date(coupon.expiry_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24) <= 30
    : false

  // Circular progress
  const circleRadius = 70
  const circleCircumference = 2 * Math.PI * circleRadius
  const circleOffset = circleCircumference - (progressPercent / 100) * circleCircumference

  const getProgressColor = () => {
    if (coupon.status === 'completed') return '#3b82f6'
    if (isExpired) return '#ef4444'
    if (progressPercent >= 90) return '#ef4444'
    if (progressPercent >= 70) return '#eab308'
    return '#14252A'
  }

  const statusLabels: Record<string, { text: string; cls: string }> = {
    active: { text: '利用中', cls: 'bg-green-50 text-green-700 border-green-200' },
    completed: { text: '使い切り', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    expired: { text: '期限切れ', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
    refunded: { text: '返金済', cls: 'bg-red-50 text-red-600 border-red-200' },
  }
  const statusInfo = statusLabels[coupon.status] || statusLabels.active

  return (
    <AppShell>
      <Header title="回数券詳細" />
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

        {/* 戻るリンク */}
        <Link href="/coupon-books" className="text-xs text-blue-600 hover:underline">&larr; 回数券一覧に戻る</Link>

        {/* 期限切れ警告バナー */}
        {isExpired && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-sm font-bold text-red-700">有効期限を過ぎています</p>
              <p className="text-xs text-red-600">
                期限: {coupon.expiry_date}（本日: {today}）
              </p>
            </div>
          </div>
        )}

        {/* 円形プログレス + 基本情報 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h2 className="text-lg font-bold text-gray-800">{coupon.patient_name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm text-gray-600">{coupon.coupon_type}</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusInfo.cls}`}>
                  {statusInfo.text}
                </span>
                {isExpiringSoon && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200">
                    期限間近
                  </span>
                )}
                {isExpired && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200">
                    期限超過
                  </span>
                )}
              </div>
            </div>
            <Link
              href={`/patients/${coupon.patient_id}`}
              className="text-xs text-blue-600 hover:underline whitespace-nowrap"
            >
              患者情報 →
            </Link>
          </div>

          {/* 大きな円形プログレスインジケーター */}
          <div className="flex flex-col items-center py-6">
            <div className="relative">
              <svg width="180" height="180" viewBox="0 0 180 180">
                {/* 背景の円 */}
                <circle
                  cx="90"
                  cy="90"
                  r={circleRadius}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="12"
                />
                {/* プログレスの円 */}
                <circle
                  cx="90"
                  cy="90"
                  r={circleRadius}
                  fill="none"
                  stroke={getProgressColor()}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={circleCircumference}
                  strokeDashoffset={circleOffset}
                  transform="rotate(-90 90 90)"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              {/* 中央テキスト */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold" style={{ color: '#14252A' }}>
                  {coupon.remaining_count}
                </span>
                <span className="text-xs text-gray-400 mt-1">/ {coupon.total_count} 回残り</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">{coupon.used_count}回使用済み</p>
          </div>

          {/* 横棒プログレスバー */}
          <div className="mb-4">
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPercent}%`,
                  background: getProgressColor(),
                }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-gray-400">
              <span>0</span>
              <span>{Math.floor(coupon.total_count / 2)}</span>
              <span>{coupon.total_count}</span>
            </div>
          </div>

          {/* 情報グリッド */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">購入金額</p>
              <p className="font-bold text-gray-800">{coupon.purchase_amount.toLocaleString()}円</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">1回あたり単価</p>
              <p className="font-bold text-gray-800">{coupon.unit_price.toLocaleString()}円</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">購入日</p>
              <p className="font-bold text-gray-800">{coupon.purchase_date}</p>
            </div>
            {coupon.consumption_start_date && coupon.consumption_start_date !== coupon.purchase_date && (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">消費開始日</p>
                <p className="font-bold text-blue-700">{coupon.consumption_start_date}</p>
              </div>
            )}
            <div className={`rounded-lg p-3 ${isExpired ? 'bg-red-100' : isExpiringSoon ? 'bg-red-50' : 'bg-gray-50'}`}>
              <p className="text-xs text-gray-500">有効期限</p>
              <p className={`font-bold ${isExpired ? 'text-red-700' : isExpiringSoon ? 'text-red-600' : 'text-gray-800'}`}>
                {coupon.expiry_date || '期限なし'}
              </p>
            </div>
          </div>

          {/* 消費タイムライン */}
          {(() => {
            const startDate = coupon.consumption_start_date || coupon.purchase_date
            const endDate = coupon.expiry_date
            if (!endDate) return null
            const start = new Date(startDate).getTime()
            const end = new Date(endDate).getTime()
            const now = new Date(today).getTime()
            const totalDays = Math.max((end - start) / (1000 * 60 * 60 * 24), 1)
            const elapsedDays = Math.max(0, Math.min((now - start) / (1000 * 60 * 60 * 24), totalDays))
            const timePercent = (elapsedDays / totalDays) * 100
            const usagePercent = coupon.total_count > 0 ? (coupon.used_count / coupon.total_count) * 100 : 0
            const pace = timePercent > 0 ? usagePercent / timePercent : 0
            const paceLabel = pace >= 1.2 ? 'ハイペース' : pace >= 0.8 ? '順調' : pace >= 0.5 ? 'やや遅め' : '遅れ気味'
            const paceColor = pace >= 1.2 ? 'text-blue-600' : pace >= 0.8 ? 'text-green-600' : pace >= 0.5 ? 'text-yellow-600' : 'text-red-600'

            return (
              <div className="mt-4 bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-2">消費ペース</p>
                <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
                  <div className="absolute h-full bg-gray-300 rounded-full" style={{ width: `${timePercent}%` }} />
                  <div className="absolute h-full rounded-full" style={{ width: `${usagePercent}%`, background: getProgressColor() }} />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                  <span>{startDate}</span>
                  <span className={`font-medium ${paceColor}`}>{paceLabel}（{Math.round(usagePercent)}% / 期間{Math.round(timePercent)}%経過）</span>
                  <span>{endDate}</span>
                </div>
              </div>
            )
          })()}

          {coupon.notes && (
            <div className="mt-3 bg-yellow-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">メモ</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{coupon.notes}</p>
            </div>
          )}
        </div>

        {/* 操作ボタン */}
        {coupon.status === 'active' && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <h3 className="font-bold text-gray-800 text-sm border-b pb-2">操作</h3>

            <button
              onClick={handleUse}
              disabled={updating || coupon.remaining_count <= 0}
              className="w-full py-4 rounded-xl font-bold text-base text-white disabled:opacity-50 transition-all active:scale-95 shadow-sm"
              style={{ background: '#14252A' }}
            >
              {updating ? '処理中...' : '1回使用する'}
            </button>

            <button
              onClick={handleUndo}
              disabled={updating || coupon.used_count <= 0}
              className="w-full py-3 rounded-xl font-bold text-sm border-2 border-gray-300 text-gray-600 disabled:opacity-50 transition-all active:scale-95 hover:bg-gray-50"
            >
              使用を取り消す
            </button>

            {coupon.remaining_count <= 3 && coupon.remaining_count > 0 && (
              <p className="text-xs text-yellow-600 bg-yellow-50 rounded-lg px-3 py-2 text-center">
                残り{coupon.remaining_count}回です。次回の回数券購入をご案内ください。
              </p>
            )}
          </div>
        )}

        {/* 使用履歴（施術記録から） */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-bold text-gray-800 text-sm border-b pb-2 mb-3">
            使用履歴（施術記録から）
          </h3>
          {usageHistory.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">
              回数券での施術記録はまだありません
            </p>
          ) : (
            <div className="space-y-2">
              {usageHistory.map(s => (
                <div key={s.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{s.visit_date}</p>
                      <p className="text-xs text-gray-500">{s.menu_name}</p>
                    </div>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                      {(s.total_price || 0).toLocaleString()}円
                    </span>
                  </div>
                  {s.notes && <p className="text-xs text-gray-400 mt-1">{s.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 削除 */}
        <div className="pt-4 pb-8">
          <button
            onClick={handleDelete}
            disabled={updating}
            className="w-full py-3 rounded-xl text-sm font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-all"
          >
            この回数券を削除する
          </button>
        </div>
      </div>
    </AppShell>
  )
}
