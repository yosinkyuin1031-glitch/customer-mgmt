'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { getClinicId } from '@/lib/clinic'
import { fetchAllSlips } from '@/lib/fetchAll'
import type { Patient } from '@/lib/types'

// --- 型定義 ---

interface PatientWithStats extends Patient {
  calcDaysSince: number | null
  calcLastVisit: string | null
}

interface SMSTemplate {
  id: string
  name: string
  text: string
}

interface SMSLog {
  id: string
  sentAt: string
  count: number
  templateName: string
  recipients: { name: string; phone: string }[]
  message: string
}

// --- テンプレート ---

const DEFAULT_TEMPLATES: SMSTemplate[] = [
  {
    id: 'followup',
    name: 'フォローアップ',
    text: '{patient_name}様、ご来院ありがとうございました。お体の調子はいかがでしょうか？次回のご予約をお待ちしております。',
  },
  {
    id: 'revisit',
    name: '再来院促進',
    text: '{patient_name}様、前回のご来院から日数が経っております。お体の調子を拝見させてください。ご予約お待ちしております。',
  },
  {
    id: 'campaign',
    name: 'キャンペーン',
    text: '{patient_name}様、当院よりお知らせです。',
  },
  {
    id: 'custom',
    name: 'カスタム',
    text: '',
  },
]

const RESERVATION_URL = 'https://line.me/R/ti/p/@oguchi-seitai'

// --- ユーティリティ ---

function maskPhone(phone: string): string {
  if (!phone) return ''
  const cleaned = phone.replace(/[-\s]/g, '')
  if (cleaned.length >= 8) {
    return cleaned.slice(0, 3) + '-' + 'XXXX' + '-' + cleaned.slice(-4)
  }
  return phone
}

function isValidJapanesePhone(phone: string): boolean {
  const cleaned = phone.replace(/[-\s]/g, '')
  return /^0[789]0\d{8}$/.test(cleaned)
}

function getSMSLogs(): SMSLog[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('sms_logs') || '[]')
  } catch {
    return []
  }
}

function saveSMSLog(log: SMSLog) {
  const logs = getSMSLogs()
  logs.unshift(log)
  // 最大100件保持
  if (logs.length > 100) logs.length = 100
  localStorage.setItem('sms_logs', JSON.stringify(logs))
}

function getCustomTemplates(): SMSTemplate[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('sms_custom_templates') || '[]')
  } catch {
    return []
  }
}

// --- メインコンポーネント ---

export default function SMSPage() {
  const supabase = createClient()
  const clinicId = getClinicId()

  // ステップ管理
  const [step, setStep] = useState(1)

  // Step 1: 患者選択
  const [patients, setPatients] = useState<PatientWithStats[]>([])
  const [couponLowIds, setCouponLowIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Step 2: メッセージ作成
  const [selectedTemplateId, setSelectedTemplateId] = useState('followup')
  const [messageText, setMessageText] = useState(DEFAULT_TEMPLATES[0].text)
  const [templates, setTemplates] = useState<SMSTemplate[]>([])

  // Step 3: 送信
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  // テンプレート読み込み
  useEffect(() => {
    const custom = getCustomTemplates()
    setTemplates([...DEFAULT_TEMPLATES, ...custom])
  }, [])

  // 患者データ読み込み
  useEffect(() => {
    const load = async () => {
      const [{ data: patientsData }, { data: couponData }] = await Promise.all([
        supabase
          .from('cm_patients')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('status', 'active')
          .order('name', { ascending: true }),
        supabase
          .from('cm_coupon_books')
          .select('patient_id, remaining')
          .eq('clinic_id', clinicId),
      ])

      // 回数券残りわずか（残り1〜2回）の患者IDセット
      const lowIds = new Set<string>(
        (couponData || [])
          .filter((c: { remaining: number }) => c.remaining > 0 && c.remaining <= 2)
          .map((c: { patient_id: string }) => c.patient_id)
      )
      setCouponLowIds(lowIds)

      // cm_slipsから最終来院日を取得
      const slips = await fetchAllSlips(supabase, 'patient_id, visit_date')
      const lastVisitMap: Record<string, string> = {}
      slips.forEach((s: { patient_id: string; visit_date: string }) => {
        if (!s.patient_id) return
        if (!lastVisitMap[s.patient_id] || s.visit_date > lastVisitMap[s.patient_id]) {
          lastVisitMap[s.patient_id] = s.visit_date
        }
      })

      const now = Date.now()
      const merged: PatientWithStats[] = (patientsData || []).map(p => {
        const lastVisit = lastVisitMap[p.id] || p.last_visit_date || null
        const daysSince = lastVisit
          ? Math.floor((now - new Date(lastVisit).getTime()) / (24 * 60 * 60 * 1000))
          : null
        return { ...p, calcDaysSince: daysSince, calcLastVisit: lastVisit }
      })

      setPatients(merged)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // フィルタリング
  const filtered = useMemo(() => {
    let list = patients

    // クイックフィルタ
    if (filter === 'no_visit_30') {
      list = list.filter(p => p.calcDaysSince !== null && p.calcDaysSince >= 30)
    } else if (filter === 'coupon_low') {
      list = list.filter(p => couponLowIds.has(p.id))
    } else if (filter === 'new_this_month') {
      const monthStart = new Date().toISOString().slice(0, 7) + '-01'
      list = list.filter(p => p.first_visit_date && p.first_visit_date >= monthStart)
    }

    // テキスト検索
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.furigana?.toLowerCase().includes(q) ||
        p.phone?.includes(q) ||
        p.chief_complaint?.toLowerCase().includes(q)
      )
    }

    return list
  }, [patients, search, filter, couponLowIds])

  // 選択された患者のリスト
  const selectedPatients = useMemo(() => {
    return patients.filter(p => selectedIds.has(p.id))
  }, [patients, selectedIds])

  // 電話番号あり・なし判定
  const hasPhone = useCallback((p: PatientWithStats) => {
    return p.phone && isValidJapanesePhone(p.phone)
  }, [])

  // 選択操作
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    const ids = filtered.filter(p => hasPhone(p)).map(p => p.id)
    setSelectedIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.add(id))
      return next
    })
  }

  const deselectAll = () => {
    const ids = new Set(filtered.map(p => p.id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.delete(id))
      return next
    })
  }

  // テンプレート選択
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const tpl = templates.find(t => t.id === templateId)
    if (tpl) setMessageText(tpl.text)
  }

  // 差し込み変数を使ったプレビュー
  const previewMessage = (patient: PatientWithStats) => {
    return messageText
      .replace(/{patient_name}/g, patient.name)
      .replace(/{days}/g, String(patient.calcDaysSince ?? '?'))
      .replace(/{last_symptom}/g, patient.chief_complaint || '')
      .replace(/{reservation_url}/g, RESERVATION_URL)
  }

  // 文字数カウント（改行は1文字扱い）
  const charCount = messageText.replace(/{patient_name}/g, '○○○○').replace(/{days}/g, '00').replace(/{last_symptom}/g, '○○').replace(/{reservation_url}/g, RESERVATION_URL).length

  // SMS送信
  const handleSend = async () => {
    if (selectedPatients.length === 0) return
    setSending(true)

    try {
      const recipients = selectedPatients.map(p => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
      }))

      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
          message: messageText
            .replace(/{reservation_url}/g, RESERVATION_URL),
          templateName: templates.find(t => t.id === selectedTemplateId)?.name || '不明',
        }),
      })

      const data = await res.json()

      if (data.success) {
        // ログ保存
        const log: SMSLog = {
          id: crypto.randomUUID(),
          sentAt: new Date().toISOString(),
          count: recipients.length,
          templateName: templates.find(t => t.id === selectedTemplateId)?.name || '不明',
          recipients: recipients.map(r => ({ name: r.name, phone: r.phone })),
          message: messageText,
        }
        saveSMSLog(log)
        setSent(true)
      } else {
        alert(`送信エラー: ${data.error}`)
      }
    } catch {
      alert('送信に失敗しました。もう一度お試しください。')
    } finally {
      setSending(false)
    }
  }

  // 送信完了後のリセット
  const handleReset = () => {
    setStep(1)
    setSelectedIds(new Set())
    setSelectedTemplateId(DEFAULT_TEMPLATES[0].id)
    setMessageText(DEFAULT_TEMPLATES[0].text)
    setSent(false)
  }

  // --- 送信完了画面 ---
  if (sent) {
    return (
      <AppShell>
        <Header title="SMS送信" />
        <div className="px-4 py-8 max-w-lg mx-auto text-center">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="text-5xl mb-4">&#x2705;</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">送信完了</h2>
            <p className="text-gray-500 mb-1">{selectedPatients.length}名にSMSを送信しました</p>
            <p className="text-xs text-gray-400 mb-6">（モック: 実際には送信されていません）</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleReset}
                className="px-6 py-2.5 text-white rounded-lg text-sm font-bold"
                style={{ background: '#14252A' }}
              >
                新規送信
              </button>
              <Link
                href="/sms/history"
                className="px-6 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                送信履歴
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title="SMS送信" />
      <div className="px-4 py-4 max-w-lg mx-auto">

        {/* ステップインジケーター */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[
            { num: 1, label: '送信先' },
            { num: 2, label: 'メッセージ' },
            { num: 3, label: '確認・送信' },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                step === s.num ? 'text-white' : step > s.num ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
              }`} style={step === s.num ? { background: '#14252A' } : undefined}>
                {step > s.num ? '\u2713' : s.num}
              </div>
              <span className={`ml-1.5 text-xs font-medium ${step === s.num ? 'text-gray-800' : 'text-gray-400'}`}>
                {s.label}
              </span>
              {i < 2 && <div className="w-8 h-px bg-gray-200 mx-2" />}
            </div>
          ))}
        </div>

        {/* ===== Step 1: 送信先を選ぶ ===== */}
        {step === 1 && (
          <div>
            {/* 送信履歴リンク */}
            <div className="flex justify-end mb-3">
              <Link href="/sms/history" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                送信履歴 &rarr;
              </Link>
            </div>

            {/* クイックフィルタ */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <p className="text-xs text-gray-500 font-semibold mb-2">&#x1F4CB; クイックフィルタ</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: '全患者' },
                  { key: 'no_visit_30', label: '30日以上未来院' },
                  { key: 'coupon_low', label: '回数券残りわずか' },
                  { key: 'new_this_month', label: '今月の新規' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      filter === f.key
                        ? 'text-white shadow-sm'
                        : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                    }`}
                    style={filter === f.key ? { background: '#14252A' } : undefined}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 検索 */}
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">&#x1F50D;</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="名前・電話番号・症状で検索"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A] bg-white shadow-sm"
              />
            </div>

            {/* 全選択・全解除 */}
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-gray-500">{filtered.length}件表示 / 選択中: {selectedIds.size}名</p>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                  全選択
                </button>
                <button onClick={deselectAll} className="text-xs text-red-500 hover:text-red-700 font-medium">
                  全解除
                </button>
              </div>
            </div>

            {/* 患者リスト */}
            {loading ? (
              <p className="text-gray-400 text-center py-8">読み込み中...</p>
            ) : filtered.length === 0 ? (
              <p className="text-gray-400 text-center py-8">該当する患者がいません</p>
            ) : (
              <div className="space-y-2 mb-4">
                {filtered.map(p => {
                  const phoneOk = hasPhone(p)
                  const isSelected = selectedIds.has(p.id)
                  return (
                    <div
                      key={p.id}
                      onClick={() => phoneOk && toggleSelect(p.id)}
                      className={`bg-white rounded-xl shadow-sm p-3.5 border-l-4 transition-all ${
                        !phoneOk
                          ? 'border-l-gray-200 opacity-50 cursor-not-allowed'
                          : isSelected
                          ? 'border-l-green-500 ring-2 ring-green-200 cursor-pointer'
                          : 'border-l-gray-200 cursor-pointer hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* チェックボックス */}
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                          !phoneOk
                            ? 'border-gray-200 bg-gray-100'
                            : isSelected
                            ? 'border-green-500 bg-green-500'
                            : 'border-gray-300'
                        }`}>
                          {isSelected && <span className="text-white text-xs font-bold">{'\u2713'}</span>}
                        </div>

                        {/* 患者情報 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-gray-800">{p.name}</p>
                            {!phoneOk && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-500">
                                電話番号未登録
                              </span>
                            )}
                          </div>
                          <div className="flex gap-3 mt-0.5 text-xs text-gray-500">
                            {phoneOk && <span>{maskPhone(p.phone)}</span>}
                            {p.calcDaysSince !== null && (
                              <span className={`font-medium ${
                                p.calcDaysSince > 90 ? 'text-red-500' : p.calcDaysSince > 30 ? 'text-orange-500' : 'text-green-600'
                              }`}>
                                {p.calcDaysSince}日経過
                              </span>
                            )}
                            {p.chief_complaint && <span className="truncate">{p.chief_complaint}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 次へボタン */}
            <div className="sticky bottom-20 md:bottom-4 bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-gray-100">
              <button
                onClick={() => setStep(2)}
                disabled={selectedIds.size === 0}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                  selectedIds.size > 0
                    ? 'text-white shadow-sm hover:opacity-90'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                style={selectedIds.size > 0 ? { background: '#14252A' } : undefined}
              >
                次へ &rarr;（{selectedIds.size}名選択中）
              </button>
            </div>
          </div>
        )}

        {/* ===== Step 2: メッセージ作成 ===== */}
        {step === 2 && (
          <div>
            {/* テンプレート選択 */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <p className="text-xs text-gray-500 font-semibold mb-2">&#x1F4DD; テンプレート選択</p>
              <div className="flex flex-wrap gap-2">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateChange(t.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedTemplateId === t.id
                        ? 'text-white shadow-sm'
                        : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                    }`}
                    style={selectedTemplateId === t.id ? { background: '#14252A' } : undefined}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* メッセージ入力 */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs text-gray-500 font-semibold">メッセージ</p>
                <span className={`text-xs font-bold ${charCount > 70 ? 'text-red-500' : charCount > 60 ? 'text-orange-500' : 'text-gray-400'}`}>
                  {charCount}/70文字
                </span>
              </div>
              {charCount > 70 && (
                <p className="text-xs text-red-500 mb-2">
                  &#x26A0; 70文字を超えるとSMS2通分（16円/人）になります
                </p>
              )}
              <textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                rows={6}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A] resize-none"
                placeholder="メッセージを入力..."
              />

              {/* 差し込み変数 */}
              <div className="mt-3">
                <p className="text-xs text-gray-400 mb-1.5">差し込み変数（タップで挿入）</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: '{patient_name}', label: '患者名' },
                    { key: '{days}', label: '経過日数' },
                    { key: '{last_symptom}', label: '主訴' },
                    { key: '{reservation_url}', label: '予約URL' },
                  ].map(v => (
                    <button
                      key={v.key}
                      onClick={() => setMessageText(prev => prev + v.key)}
                      className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium hover:bg-blue-100 border border-blue-100"
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* プレビュー */}
            {selectedPatients.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
                <p className="text-xs text-gray-500 font-semibold mb-2">&#x1F4F1; プレビュー（{selectedPatients[0].name}さんの場合）</p>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap border border-gray-200">
                  {previewMessage(selectedPatients[0])}
                </div>
              </div>
            )}

            {/* ナビゲーション */}
            <div className="sticky bottom-20 md:bottom-4 bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-gray-100">
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50"
                >
                  &larr; 戻る
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!messageText.trim()}
                  className={`flex-[2] py-3 rounded-xl text-sm font-bold transition-all ${
                    messageText.trim()
                      ? 'text-white shadow-sm hover:opacity-90'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  style={messageText.trim() ? { background: '#14252A' } : undefined}
                >
                  送信確認へ（{selectedIds.size}名）
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== Step 3: 確認・送信 ===== */}
        {step === 3 && (
          <div>
            {/* 送信先一覧 */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <p className="text-xs text-gray-500 font-semibold mb-2">&#x1F4E8; 送信先: {selectedPatients.length}名</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {selectedPatients.map(p => (
                  <div key={p.id} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-50 last:border-0">
                    <span className="font-medium text-gray-800">{p.name}</span>
                    <span className="text-xs text-gray-400">{maskPhone(p.phone)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* メッセージ確認 */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <p className="text-xs text-gray-500 font-semibold mb-2">&#x1F4AC; メッセージ内容</p>
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap border border-gray-200">
                {selectedPatients.length > 0 ? previewMessage(selectedPatients[0]) : messageText}
              </div>
              {selectedPatients.length > 1 && (
                <p className="text-xs text-gray-400 mt-2">
                  ※ 各患者の名前・日数は自動で差し替わります
                </p>
              )}
            </div>

            {/* 料金目安 */}
            <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-100">
              <p className="text-sm font-bold text-blue-800 mb-1">&#x1F4B0; SMS送信料の目安</p>
              <p className="text-xs text-blue-600">
                約{(charCount > 70 ? 16 : 8) * selectedPatients.length}円
                （1通{charCount > 70 ? '16' : '8'}円 x {selectedPatients.length}通）
              </p>
              {charCount > 70 && (
                <p className="text-xs text-orange-500 mt-1">
                  &#x26A0; 70文字超のため2通分の料金がかかります
                </p>
              )}
            </div>

            {/* モック注意 */}
            <div className="bg-yellow-50 rounded-xl p-3 mb-4 border border-yellow-200">
              <p className="text-xs text-yellow-700">
                &#x26A0; 現在テストモードです。実際のSMS送信は行われません（Twilio連携後に有効化）
              </p>
            </div>

            {/* ナビゲーション */}
            <div className="sticky bottom-20 md:bottom-4 bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-gray-100">
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50"
                >
                  &larr; 修正する
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-[2] py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: sending ? '#6B7280' : '#14252A' }}
                >
                  {sending ? '送信中...' : `送信する（${selectedPatients.length}名）`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
