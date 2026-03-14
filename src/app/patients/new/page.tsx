'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { REFERRAL_SOURCES, PREFECTURES } from '@/lib/types'

function VoiceMic({ onResult, listening, onToggle }: { onResult: (text: string) => void; listening: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
        listening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
      }`}
      title={listening ? '停止' : '音声入力'}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      </svg>
    </button>
  )
}

export default function NewPatientPage() {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeField, setActiveField] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const [form, setForm] = useState({
    name: '', furigana: '', birth_date: '', gender: '男性',
    phone: '', email: '',
    zipcode: '', prefecture: '', city: '', address: '', building: '',
    occupation: '',
    referral_source: '', visit_motive: '', customer_category: '',
    chief_complaint: '', medical_history: '', notes: '',
    is_direct_mail: true, is_enabled: true,
  })

  const update = (key: string, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }))

  // 音声入力のトグル
  const toggleVoice = useCallback((field: string, processResult?: (text: string) => void) => {
    // 既に録音中なら停止
    if (activeField === field) {
      recognitionRef.current?.stop()
      setActiveField(null)
      return
    }
    // 別のフィールドが録音中なら停止
    if (activeField) {
      recognitionRef.current?.stop()
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      alert('お使いのブラウザは音声入力に対応していません')
      return
    }

    const recognition = new SR()
    recognition.lang = 'ja-JP'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0][0].transcript
      if (processResult) {
        processResult(text)
      } else {
        update(field, text)
      }
      setActiveField(null)
    }
    recognition.onerror = () => setActiveField(null)
    recognition.onend = () => setActiveField(null)

    recognitionRef.current = recognition
    recognition.start()
    setActiveField(field)
  }, [activeField])

  // 電話番号の音声処理
  const processPhone = useCallback((text: string) => {
    // 数字以外を除去して電話番号に変換
    let cleaned = text
      .replace(/[ー−–—]/g, '-')
      .replace(/の/g, '-')
      .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[^0-9\-]/g, '')
    update('phone', cleaned)
  }, [])

  // 生年月日の音声処理
  const processBirthDate = useCallback((text: string) => {
    // 「1985年3月15日」→「1985-03-15」
    const match = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
    if (match) {
      const y = match[1]
      const m = match[2].padStart(2, '0')
      const d = match[3].padStart(2, '0')
      update('birth_date', `${y}-${m}-${d}`)
      return
    }
    // 「昭和60年3月15日」等の和暦対応
    const eraMatch = text.match(/(明治|大正|昭和|平成|令和)\s*(\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
    if (eraMatch) {
      const eraMap: Record<string, number> = { '明治': 1868, '大正': 1912, '昭和': 1926, '平成': 1989, '令和': 2019 }
      const year = eraMap[eraMatch[1]] + parseInt(eraMatch[2]) - 1
      const m = eraMatch[3].padStart(2, '0')
      const d = eraMatch[4].padStart(2, '0')
      update('birth_date', `${year}-${m}-${d}`)
      return
    }
    // そのまま入れる
    update('birth_date', text)
  }, [])

  // 性別の音声処理
  const processGender = useCallback((text: string) => {
    if (text.includes('男')) update('gender', '男性')
    else if (text.includes('女')) update('gender', '女性')
    else update('gender', text)
  }, [])

  // 都道府県の音声処理
  const processPrefecture = useCallback((text: string) => {
    const match = PREFECTURES.find(p => text.includes(p) || text.includes(p.replace(/[都道府県]$/, '')))
    if (match) update('prefecture', match)
    else update('prefecture', text)
  }, [])

  // 来院経路の音声処理
  const processReferral = useCallback((text: string) => {
    const match = REFERRAL_SOURCES.find(s =>
      text.includes(s) || s.includes(text.replace(/\s/g, ''))
    )
    if (match) update('referral_source', match)
    else update('referral_source', text)
  }, [])

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    const { error } = await supabase.from('cm_patients').insert({
      ...form,
      status: 'active',
    })
    if (!error) {
      setSaved(true)
      setTimeout(() => router.push('/patients'), 800)
    }
    setSaving(false)
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A] focus:border-transparent"

  // 音声対応テキストフィールド
  const VoiceField = ({ label, field, placeholder, processResult, required }: {
    label: string; field: string; placeholder?: string; processResult?: (text: string) => void; required?: boolean
  }) => (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}{required && ' *'}</label>
      <div className="flex gap-1.5 items-center">
        <input
          type="text"
          value={(form as Record<string, string | boolean>)[field] as string || ''}
          onChange={(e) => update(field, e.target.value)}
          className={`${inputClass} flex-1`}
          placeholder={placeholder}
        />
        <VoiceMic
          onResult={() => {}}
          listening={activeField === field}
          onToggle={() => toggleVoice(field, processResult)}
        />
      </div>
    </div>
  )

  // 音声対応テキストエリア
  const VoiceTextArea = ({ label, field, placeholder, rows = 2 }: {
    label: string; field: string; placeholder?: string; rows?: number
  }) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-gray-600">{label}</label>
        <VoiceMic
          onResult={() => {}}
          listening={activeField === field}
          onToggle={() => toggleVoice(field, (text) => {
            const current = (form as Record<string, string | boolean>)[field] as string || ''
            update(field, current ? current + ' ' + text : text)
          })}
        />
      </div>
      <textarea
        value={(form as Record<string, string | boolean>)[field] as string || ''}
        onChange={(e) => update(field, e.target.value)}
        className={inputClass}
        rows={rows}
        placeholder={placeholder}
      />
    </div>
  )

  if (saved) {
    return (
      <AppShell>
        <Header title="新規患者登録" />
        <div className="px-4 py-16 text-center">
          <div className="text-5xl mb-4">&#10003;</div>
          <p className="font-bold text-lg text-gray-800">登録しました</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title="新規患者登録" />
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-800 text-sm border-b pb-2">基本情報</h3>

          <VoiceField label="氏名" field="name" placeholder="大口 太郎" required />
          <VoiceField label="ふりがな" field="furigana" placeholder="おおぐち たろう" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">生年月日</label>
              <div className="flex gap-1.5 items-center">
                <input type="date" value={form.birth_date} onChange={(e) => update('birth_date', e.target.value)} className={`${inputClass} flex-1`} />
                <VoiceMic
                  onResult={() => {}}
                  listening={activeField === 'birth_date'}
                  onToggle={() => toggleVoice('birth_date', processBirthDate)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">性別</label>
              <div className="flex gap-1.5 items-center">
                <select value={form.gender} onChange={(e) => update('gender', e.target.value)} className={`${inputClass} flex-1`}>
                  <option>男性</option>
                  <option>女性</option>
                  <option>その他</option>
                </select>
                <VoiceMic
                  onResult={() => {}}
                  listening={activeField === 'gender'}
                  onToggle={() => toggleVoice('gender', processGender)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <VoiceField label="電話番号" field="phone" placeholder="090-1234-5678" processResult={processPhone} />
            <VoiceField label="メールアドレス" field="email" placeholder="example@email.com" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-800 text-sm border-b pb-2">住所</h3>

          <div className="grid grid-cols-2 gap-3">
            <VoiceField label="郵便番号" field="zipcode" placeholder="000-0000" />
            <div>
              <label className="block text-xs text-gray-600 mb-1">都道府県</label>
              <div className="flex gap-1.5 items-center">
                <select value={form.prefecture} onChange={(e) => update('prefecture', e.target.value)} className={`${inputClass} flex-1`}>
                  <option value="">選択</option>
                  {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <VoiceMic
                  onResult={() => {}}
                  listening={activeField === 'prefecture'}
                  onToggle={() => toggleVoice('prefecture', processPrefecture)}
                />
              </div>
            </div>
          </div>

          <VoiceField label="市区町村" field="city" placeholder="住吉区長居" />
          <VoiceField label="番地" field="address" placeholder="1-2-3" />
          <VoiceField label="建物名・部屋番号" field="building" placeholder="○○マンション101" />
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-800 text-sm border-b pb-2">来院情報</h3>

          <VoiceField label="職業" field="occupation" placeholder="会社員" />

          <div>
            <label className="block text-xs text-gray-600 mb-1">来院経路</label>
            <div className="flex gap-1.5 items-center">
              <select value={form.referral_source} onChange={(e) => update('referral_source', e.target.value)} className={`${inputClass} flex-1`}>
                <option value="">選択してください</option>
                {REFERRAL_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <VoiceMic
                onResult={() => {}}
                listening={activeField === 'referral_source'}
                onToggle={() => toggleVoice('referral_source', processReferral)}
              />
            </div>
          </div>

          <VoiceTextArea label="主訴（お困りの症状）" field="chief_complaint" placeholder="腰痛、肩こり、頭痛..." rows={3} />
          <VoiceTextArea label="既往歴" field="medical_history" placeholder="手術歴、持病など" />
          <VoiceTextArea label="メモ" field="notes" placeholder="注意点など" />

          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_direct_mail} onChange={e => update('is_direct_mail', e.target.checked)} className="rounded" />
              DM送付可
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_enabled} onChange={e => update('is_enabled', e.target.checked)} className="rounded" />
              有効
            </label>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !form.name}
          className="w-full text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50 shadow-lg transition-all active:scale-95"
          style={{ background: '#14252A' }}
        >
          {saving ? '登録中...' : '患者を登録する'}
        </button>
      </div>
    </AppShell>
  )
}
