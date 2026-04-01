'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import SetupWizard from '@/components/SetupWizard'
import { createClient } from '@/lib/supabase/client'
import { getClinicId } from '@/lib/clinic'
import { useToast } from '@/lib/toast'
import type { Patient, Slip, CouponBook } from '@/lib/types'

interface TodaySlip extends Slip {
  patient?: Patient
}

interface ChurnPatient extends Patient {
  daysSince: number
  level: 'warning' | 'danger'
}

interface Advice {
  icon: string
  title: string
  text: string
  priority: 'high' | 'medium' | 'low'
}

function getChurnLevel(days: number): 'warning' | 'danger' {
  if (days >= 45) return 'danger'
  return 'warning'
}

function getChurnStyle(level: 'warning' | 'danger') {
  switch (level) {
    case 'warning':
      return { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-700', label: '注意' }
    case 'danger':
      return { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', badge: 'bg-orange-100 text-orange-700', label: '警告' }
  }
}

function getChurnMessage(level: 'warning' | 'danger') {
  switch (level) {
    case 'warning': return 'フォローのタイミングです'
    case 'danger': return '離反リスクが高まっています'
  }
}

function generateAdvice(
  allActivePatients: Patient[],
  thisMonthSlips: Slip[],
  lastMonthSlips: Slip[],
  churnCount: number,
  totalPatients: number
): Advice[] {
  const advices: Advice[] = []
  const today = new Date()
  const dayOfMonth = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()

  // 1. リピート率の変化
  if (thisMonthSlips.length > 0 && lastMonthSlips.length > 0) {
    const thisMonthPatientIds = new Set(thisMonthSlips.map(s => s.patient_id).filter(Boolean))
    const lastMonthPatientIds = new Set(lastMonthSlips.map(s => s.patient_id).filter(Boolean))

    // リピート率 = 先月も来た患者 / 今月の全患者
    const repeatCount = [...thisMonthPatientIds].filter(id => lastMonthPatientIds.has(id)).length
    const thisMonthRepeatRate = thisMonthPatientIds.size > 0 ? Math.round((repeatCount / thisMonthPatientIds.size) * 100) : 0

    // 先月のリピート率を概算（先月来た患者のうち、今月も来た割合）
    const lastMonthRepeatRate = lastMonthPatientIds.size > 0 ? Math.round((repeatCount / lastMonthPatientIds.size) * 100) : 0

    if (thisMonthRepeatRate < lastMonthRepeatRate && lastMonthRepeatRate > 0) {
      advices.push({
        icon: '📊',
        title: 'リピート率の変化',
        text: `リピート率が${lastMonthRepeatRate}%→${thisMonthRepeatRate}%に低下しています。離反アラートの患者へのフォローで改善が見込めます。`,
        priority: 'high'
      })
    } else if (thisMonthRepeatRate >= lastMonthRepeatRate && lastMonthRepeatRate > 0) {
      advices.push({
        icon: '📊',
        title: 'リピート率が安定',
        text: `リピート率は${thisMonthRepeatRate}%で安定しています。この調子を維持しましょう。`,
        priority: 'low'
      })
    }
  }

  // 2. 新規患者の来院経路
  const thisMonthNewPatients = allActivePatients.filter(p => {
    if (!p.first_visit_date) return false
    const fv = p.first_visit_date.slice(0, 7)
    const thisMonth = today.toISOString().slice(0, 7)
    return fv === thisMonth
  })
  if (thisMonthNewPatients.length > 0) {
    const sourceCounts: Record<string, number> = {}
    thisMonthNewPatients.forEach(p => {
      const src = p.referral_source || '不明'
      sourceCounts[src] = (sourceCounts[src] || 0) + 1
    })
    const sorted = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])
    const topSource = sorted[0]
    if (topSource) {
      advices.push({
        icon: '📣',
        title: '新規の来院経路',
        text: `今月の新規${thisMonthNewPatients.length}名のうち、${topSource[0]}経由が${topSource[1]}名で最多です。`,
        priority: 'medium'
      })
    }
  } else {
    advices.push({
      icon: '📣',
      title: '新規患者',
      text: '今月の新規患者がまだ0名です。集客施策を確認してみてください。',
      priority: 'high'
    })
  }

  // 3. 平均単価の変化
  if (thisMonthSlips.length > 0) {
    const thisMonthAvg = Math.round(thisMonthSlips.reduce((s, sl) => s + (sl.total_price || 0), 0) / thisMonthSlips.length)
    if (lastMonthSlips.length > 0) {
      const lastMonthAvg = Math.round(lastMonthSlips.reduce((s, sl) => s + (sl.total_price || 0), 0) / lastMonthSlips.length)
      const diff = thisMonthAvg - lastMonthAvg
      if (diff < -500) {
        advices.push({
          icon: '💰',
          title: '平均単価の低下',
          text: `平均単価 ${thisMonthAvg.toLocaleString()}円（先月比 ${diff.toLocaleString()}円）。メニューの見直しを検討してみてください。`,
          priority: 'high'
        })
      } else if (diff >= 0) {
        advices.push({
          icon: '💰',
          title: '平均単価',
          text: `平均単価 ${thisMonthAvg.toLocaleString()}円（先月比 +${diff.toLocaleString()}円）。好調です。この調子を維持しましょう。`,
          priority: 'low'
        })
      }
    } else {
      advices.push({
        icon: '💰',
        title: '平均単価',
        text: `今月の平均単価は${thisMonthAvg.toLocaleString()}円です。`,
        priority: 'low'
      })
    }
  }

  // 4. 離反患者数の推移
  if (churnCount > 0) {
    advices.push({
      icon: '🚨',
      title: '離反リスク',
      text: `30日以上未来院の患者が${churnCount}名います。フォロー連絡で再来院につなげましょう。`,
      priority: 'high'
    })
  }

  // 5. 今月の売上ペース
  if (thisMonthSlips.length > 0 && lastMonthSlips.length > 0) {
    const thisMonthTotal = thisMonthSlips.reduce((s, sl) => s + (sl.total_price || 0), 0)
    const lastMonthTotal = lastMonthSlips.reduce((s, sl) => s + (sl.total_price || 0), 0)
    const pace = Math.round(thisMonthTotal / dayOfMonth * daysInMonth)
    if (pace < lastMonthTotal * 0.9) {
      advices.push({
        icon: '📈',
        title: '売上ペース',
        text: `今月の売上ペース約${pace.toLocaleString()}円（先月実績${lastMonthTotal.toLocaleString()}円）。ペースアップが必要です。`,
        priority: 'high'
      })
    } else {
      advices.push({
        icon: '📈',
        title: '売上ペース',
        text: `今月の売上ペース約${pace.toLocaleString()}円。先月実績${lastMonthTotal.toLocaleString()}円を上回る見込みです。`,
        priority: 'low'
      })
    }
  }

  // 優先度順にソートし、最大5個
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  return advices.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).slice(0, 5)
}

export default function HomePage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const { showToast } = useToast()
  const [todaySlips, setTodaySlips] = useState<TodaySlip[]>([])
  const [recentPatients, setRecentPatients] = useState<Patient[]>([])
  const [stats, setStats] = useState({ totalPatients: 0, monthVisits: 0, todayVisits: 0, todayRevenue: 0 })
  const [loading, setLoading] = useState(true)

  // 離反アラート
  const [churnPatients, setChurnPatients] = useState<ChurnPatient[]>([])
  const [showAllChurn, setShowAllChurn] = useState(false)
  const [memoOpenId, setMemoOpenId] = useState<string | null>(null)
  const [memoText, setMemoText] = useState('')
  const [savingMemo, setSavingMemo] = useState(false)

  // AIアドバイス
  const [advices, setAdvices] = useState<Advice[]>([])

  // 回数券アラート
  const [couponAlerts, setCouponAlerts] = useState<{ low: CouponBook[]; expiring: CouponBook[] }>({ low: [], expiring: [] })

  const saveMemo = useCallback(async (patientId: string, currentNotes: string) => {
    if (!memoText.trim()) return
    setSavingMemo(true)
    const timestamp = new Date().toLocaleString('ja-JP')
    const newNote = `[${timestamp} フォローメモ] ${memoText.trim()}`
    const updatedNotes = currentNotes ? `${currentNotes}\n${newNote}` : newNote

    const { error } = await supabase
      .from('cm_patients')
      .update({ notes: updatedNotes })
      .eq('id', patientId)
      .eq('clinic_id', clinicId)

    if (!error) {
      setChurnPatients(prev => prev.map(p =>
        p.id === patientId ? { ...p, notes: updatedNotes } : p
      ))
      setMemoText('')
      setMemoOpenId(null)
    } else {
      showToast('メモの保存に失敗しました', 'error')
    }
    setSavingMemo(false)
  }, [memoText, supabase, clinicId])

  useEffect(() => {
    const load = async () => {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const monthStart = todayStr.slice(0, 7) + '-01'

      // 先月の範囲
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastMonthStart = lastMonth.toISOString().split('T')[0]
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0]

      // 離反アラート範囲: 30日〜60日未来院（2ヶ月以内のみ表示）
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const [patientsRes, todayRes, monthRes, allActiveRes, lastMonthSlipsRes] = await Promise.all([
        supabase.from('cm_patients').select('*').eq('clinic_id', clinicId).eq('status', 'active').order('updated_at', { ascending: false }).limit(5),
        supabase.from('cm_slips').select('*').eq('clinic_id', clinicId).eq('visit_date', todayStr).order('created_at', { ascending: false }),
        supabase.from('cm_slips').select('id, total_price', { count: 'exact' }).eq('clinic_id', clinicId).gte('visit_date', monthStart),
        // 全アクティブ患者（フォロー判定 + アドバイス用）
        supabase.from('cm_patients').select('*').eq('clinic_id', clinicId).eq('status', 'active'),
        // 先月の施術データ
        supabase.from('cm_slips').select('*').eq('clinic_id', clinicId).gte('visit_date', lastMonthStart).lte('visit_date', lastMonthEnd),
      ])

      // 全アクティブ患者の最終来院日をcm_slipsから実データで取得して補正
      const activePatients = allActiveRes.data || []
      const patientIds = activePatients.map(p => p.id)
      const { data: latestSlips } = await supabase
        .from('cm_slips')
        .select('patient_id, visit_date')
        .eq('clinic_id', clinicId)
        .in('patient_id', patientIds.length > 0 ? patientIds : ['__none__'])
        .order('visit_date', { ascending: false })

      // 患者ごとの最新来院日マップを構築
      const lastVisitMap: Record<string, string> = {}
      if (latestSlips) {
        for (const s of latestSlips) {
          if (!lastVisitMap[s.patient_id]) {
            lastVisitMap[s.patient_id] = s.visit_date
          }
        }
      }

      // 今月の全施術データ（アドバイス用）
      const { data: thisMonthAllSlips } = await supabase.from('cm_slips').select('*').eq('clinic_id', clinicId).gte('visit_date', monthStart)

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

      // 離反患者を計算（cm_slipsの実データから判定）
      {
        const churn: ChurnPatient[] = activePatients
          .map(p => {
            const actualLastVisit = lastVisitMap[p.id]
            if (!actualLastVisit) return null // 来院記録なし → フォロー対象外
            const lastVisit = new Date(actualLastVisit)
            const diffDays = Math.floor((today.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
            if (diffDays < 30 || diffDays > 60) return null // 30〜60日のみ
            return { ...p, last_visit_date: actualLastVisit, daysSince: diffDays, level: getChurnLevel(diffDays) }
          })
          .filter((p): p is ChurnPatient => p !== null)
          .sort((a, b) => b.daysSince - a.daysSince)
        setChurnPatients(churn)

        // AIアドバイス生成
        const adviceList = generateAdvice(
          allActiveRes.data || [],
          thisMonthAllSlips || [],
          lastMonthSlipsRes.data || [],
          churn.length,
          totalPatients || 0
        )
        setAdvices(adviceList)
      }

      // 回数券アラート取得（テーブルが存在しない場合はスキップ）
      try {
        const { data: activeCoupons } = await supabase
          .from('cm_coupon_books')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('status', 'active')

        if (activeCoupons) {
          const todayDate = new Date(todayStr)
          const low = activeCoupons.filter(c => c.remaining_count <= 5 && c.remaining_count > 0)
          const expiring = activeCoupons.filter(c => {
            if (!c.expiry_date) return false
            const diff = (new Date(c.expiry_date).getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
            return diff <= 30 && diff >= 0
          })
          setCouponAlerts({ low, expiring })
        }
      } catch {
        // テーブルが存在しない場合はスキップ
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const displayedChurn = showAllChurn ? churnPatients : churnPatients.slice(0, 10)

  return (
    <AppShell>
      <Header title="顧客管理シート" />
      <SetupWizard />
      <div className="px-4 py-5 max-w-lg mx-auto">

        {/* 統計カード */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 text-center border-l-4" style={{ borderLeftColor: '#14252A' }}>
            <div className="text-2xl mb-1">👥</div>
            <p className="text-2xl sm:text-3xl font-bold" style={{ color: '#14252A' }}>{stats.totalPatients}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">総患者数</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 text-center border-l-4 border-l-blue-500">
            <div className="text-2xl mb-1">📋</div>
            <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.monthVisits}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">今月の施術</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 text-center border-l-4 border-l-green-500">
            <div className="text-2xl mb-1">✅</div>
            <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.todayVisits}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">本日の施術</p>
          </div>
        </div>

        {/* クイックアクション */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Link href="/patients/new" className="text-white rounded-xl p-3 text-center font-bold shadow-sm text-xs" style={{ background: '#14252A' }}>
            + 新規患者
          </Link>
          <Link href="/visits/new" className="bg-blue-600 text-white rounded-xl p-3 text-center font-bold shadow-sm text-xs">
            + 施術記録
          </Link>
          <Link href="/visits/quick" className="bg-green-600 text-white rounded-xl p-3 text-center font-bold shadow-sm text-xs">
            一括入力
          </Link>
          <Link href="/visits/import" className="bg-white border-2 border-gray-200 text-gray-700 rounded-xl p-3 text-center font-bold shadow-sm text-xs hover:bg-gray-50">
            CSV取込
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : (
          <>
            {/* 離反アラート */}
            <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
              <h2 className="font-bold text-gray-800 text-base mb-3">
                ⚠️ フォローが必要な患者{churnPatients.length > 0 && `（${churnPatients.length}名）`}
              </h2>
              {churnPatients.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">フォローが必要な患者はいません 👍</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {displayedChurn.map(p => {
                      const style = getChurnStyle(p.level)
                      return (
                        <div key={p.id} className={`${style.bg} border ${style.border} rounded-lg p-3`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link href={`/patients/${p.id}`} className="font-bold text-sm hover:underline truncate" title={p.name}>
                                  {p.name}
                                </Link>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${style.badge}`}>
                                  {style.label}
                                </span>
                              </div>
                              <p className={`text-xs mt-0.5 ${style.text}`}>
                                {p.daysSince}日経過{p.chief_complaint ? `（前回: ${p.chief_complaint.slice(0, 10)}）` : ''}
                              </p>
                              <p className="text-[10px] text-gray-500 mt-0.5">{getChurnMessage(p.level)}</p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              {p.phone && (
                                <a
                                  href={`sms:${p.phone.replace(/[-ー－\s]/g, '')}`}
                                  className="text-[10px] font-medium px-2.5 py-1.5 rounded-md bg-green-500 text-white hover:bg-green-600 whitespace-nowrap"
                                >
                                  SMS送信
                                </a>
                              )}
                              <button
                                onClick={() => {
                                  if (memoOpenId === p.id) {
                                    setMemoOpenId(null)
                                    setMemoText('')
                                  } else {
                                    setMemoOpenId(p.id)
                                    setMemoText('')
                                  }
                                }}
                                className="text-[10px] font-medium px-2.5 py-1.5 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 whitespace-nowrap"
                              >
                                メモ
                              </button>
                            </div>
                          </div>
                          {memoOpenId === p.id && (
                            <div className="mt-2 flex gap-2">
                              <input
                                type="text"
                                value={memoText}
                                onChange={e => setMemoText(e.target.value)}
                                placeholder="フォロー結果を入力..."
                                className="flex-1 text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                onKeyDown={e => { if (e.key === 'Enter') saveMemo(p.id, p.notes || '') }}
                              />
                              <button
                                onClick={() => saveMemo(p.id, p.notes || '')}
                                disabled={savingMemo || !memoText.trim()}
                                className="text-[10px] font-medium px-3 py-1.5 rounded-md bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 whitespace-nowrap"
                              >
                                {savingMemo ? '保存中...' : '保存'}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {churnPatients.length > 10 && !showAllChurn && (
                    <button
                      onClick={() => setShowAllChurn(true)}
                      className="w-full mt-3 text-xs text-blue-600 font-medium hover:text-blue-800 py-2"
                    >
                      もっと見る（残り{churnPatients.length - 10}名）
                    </button>
                  )}
                  {showAllChurn && churnPatients.length > 10 && (
                    <button
                      onClick={() => setShowAllChurn(false)}
                      className="w-full mt-3 text-xs text-blue-600 font-medium hover:text-blue-800 py-2"
                    >
                      折りたたむ
                    </button>
                  )}
                </>
              )}
            </div>

            {/* AIアドバイス */}
            <div className="bg-blue-50 rounded-xl shadow-sm p-5 mb-5 border border-blue-200">
              <h2 className="font-bold text-blue-900 text-base mb-3">💡 今月のアドバイス</h2>
              {advices.length === 0 ? (
                <p className="text-blue-700 text-sm text-center py-3">今月は順調です。この調子で！</p>
              ) : (
                <div className="space-y-3">
                  {advices.map((a, i) => (
                    <div key={i} className="flex gap-2.5">
                      <span className="text-base shrink-0 mt-0.5">{a.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-blue-900">{a.title}</p>
                        <p className="text-xs text-blue-800 mt-0.5 leading-relaxed">{a.text}</p>
                      </div>
                      {a.priority === 'high' && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-600 shrink-0 self-start mt-0.5">要対応</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 回数券アラート */}
            {(couponAlerts.low.length > 0 || couponAlerts.expiring.length > 0) && (
              <div className="bg-white rounded-xl shadow-sm p-5 mb-5 border-l-4 border-l-yellow-400">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="font-bold text-gray-800 text-base">🎫 回数券アラート</h2>
                  <Link href="/coupon-books" className="text-xs text-blue-600 font-medium hover:text-blue-800">一覧を見る →</Link>
                </div>
                {couponAlerts.low.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-yellow-700 font-medium mb-1">残り3回以下:</p>
                    <div className="space-y-1">
                      {couponAlerts.low.map(c => (
                        <Link key={c.id} href={`/coupon-books/${c.id}`} className="block text-sm text-gray-700 hover:text-blue-600">
                          {c.patient_name}（{c.coupon_type} 残り{c.remaining_count}回）
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {couponAlerts.expiring.length > 0 && (
                  <div>
                    <p className="text-xs text-red-600 font-medium mb-1">期限30日以内:</p>
                    <div className="space-y-1">
                      {couponAlerts.expiring.map(c => (
                        <Link key={c.id} href={`/coupon-books/${c.id}`} className="block text-sm text-gray-700 hover:text-blue-600">
                          {c.patient_name}（{c.coupon_type} 残り{c.remaining_count}回・{c.expiry_date}期限）
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 本日の施術 */}
            <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-gray-800 text-base">🩺 本日の施術</h2>
                {stats.todayRevenue > 0 && (
                  <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ color: '#14252A', background: 'rgba(20,37,42,0.08)' }}>{stats.todayRevenue.toLocaleString()}円</span>
                )}
              </div>
              {todaySlips.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">本日の施術記録はありません</p>
              ) : (
                <div className="space-y-2">
                  {todaySlips.map(s => (
                    <Link key={s.id} href={`/patients/${s.patient_id}`} className="block border border-gray-100 rounded-lg p-3.5 hover:bg-gray-50 hover:shadow-sm">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-sm">{s.patient_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{s.menu_name}</p>
                        </div>
                        <span className="text-xs font-semibold bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-100">
                          {(s.total_price || 0).toLocaleString()}円
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 最近の患者 */}
            <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-gray-800 text-base">👤 最近の患者</h2>
                <Link href="/patients" className="text-xs text-blue-600 font-medium hover:text-blue-800">すべて見る →</Link>
              </div>
              {recentPatients.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">患者データがありません</p>
              ) : (
                <div className="space-y-2">
                  {recentPatients.map(p => (
                    <Link key={p.id} href={`/patients/${p.id}`} className="block border border-gray-100 rounded-lg p-3.5 hover:bg-gray-50 hover:shadow-sm">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.status === 'active' ? 'bg-green-500' : p.status === 'completed' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                          <div>
                            <p className="font-bold text-sm">{p.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{p.chief_complaint?.slice(0, 20)}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${p.status === 'active' ? 'text-green-700 bg-green-50' : p.status === 'completed' ? 'text-blue-700 bg-blue-50' : 'text-gray-500 bg-gray-50'}`}>
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
