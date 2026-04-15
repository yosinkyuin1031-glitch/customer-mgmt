'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { getClinicId } from '@/lib/clinic'
import { useToast } from '@/lib/toast'
import { REFERRAL_SOURCES, PREFECTURES } from '@/lib/types'

// バリデーション関数
function validateEmail(email: string): boolean {
  if (!email) return true // 空は許可
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validatePhone(phone: string): boolean {
  if (!phone) return true // 空は許可
  const normalized = phone.replace(/[-\s\u3000()（）ー－]/g, '')
  return /^\d{10,11}$/.test(normalized)
}

function validateZipcode(zipcode: string): boolean {
  if (!zipcode) return true // 空は許可
  const normalized = zipcode.replace(/[-ー－]/g, '')
  return /^\d{7}$/.test(normalized)
}

// 郵便番号から住所を取得
async function lookupByZipcode(zipcode: string): Promise<{ prefecture: string; city: string; address: string } | null> {
  const normalized = zipcode.replace(/[-ー－\s]/g, '')
  if (!/^\d{7}$/.test(normalized)) return null
  try {
    const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${normalized}`)
    const data = await res.json()
    if (data.results && data.results.length > 0) {
      const r = data.results[0]
      return { prefecture: r.address1, city: r.address2 + r.address3, address: '' }
    }
  } catch { /* ignore */ }
  return null
}

// 住所から郵便番号を逆引き（都道府県+市区町村でAPI検索）
async function reverseLookupZipcode(prefecture: string, city: string): Promise<string> {
  if (!prefecture || !city) return ''
  try {
    // 市区町村の先頭部分（「市」「区」「町」「村」まで）で検索
    const cityMatch = city.match(/^(.+?[市区町村])/)
    const searchCity = cityMatch ? cityMatch[1] : city
    const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?address=${encodeURIComponent(prefecture + searchCity)}`)
    const data = await res.json()
    if (data.results && data.results.length > 0) {
      // 最も一致度の高い結果を返す
      const fullAddress = prefecture + city
      const best = data.results.find((r: { address1: string; address2: string; address3: string; zipcode: string }) =>
        fullAddress.includes(r.address2 + r.address3)
      ) || data.results[0]
      return best.zipcode
    }
  } catch { /* ignore */ }
  return ''
}

export default function NewPatientPage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const router = useRouter()
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [voiceText, setVoiceText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [listening, setListening] = useState(false)
  const [parseError, setParseError] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const [symptomMaster, setSymptomMaster] = useState<{ name: string; category: string }[]>([])
  const [occupationMaster, setOccupationMaster] = useState<string[]>([])
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [duplicateWarning, setDuplicateWarning] = useState<string>('')
  const [form, setForm] = useState({
    name: '', furigana: '', birth_date: '', gender: '男性',
    phone: '', email: '',
    zipcode: '', prefecture: '', city: '', address: '', building: '',
    occupation: '',
    referral_source: '', visit_motive: '', customer_category: '',
    chief_complaint: '', medical_history: '', notes: '',
    is_direct_mail: true, is_enabled: true,
  })

  // 症状・職業マスター取得
  useEffect(() => {
    const fetchMasters = async () => {
      const [{ data: symptoms }, { data: occupations }] = await Promise.all([
        supabase.from('cm_symptoms').select('name, category').eq('clinic_id', clinicId).eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('cm_occupations').select('name').eq('clinic_id', clinicId).eq('is_active', true).order('sort_order', { ascending: true }),
      ])
      if (symptoms) setSymptomMaster(symptoms)
      if (occupations) setOccupationMaster(occupations.map(o => o.name))
    }
    fetchMasters()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [customComplaint, setCustomComplaint] = useState('')

  // selectedSymptoms + customComplaint → form.chief_complaint に同期
  useEffect(() => {
    const parts = [...selectedSymptoms]
    if (customComplaint.trim()) parts.push(customComplaint.trim())
    setForm(prev => ({ ...prev, chief_complaint: parts.join(', ') }))
  }, [selectedSymptoms, customComplaint])

  const toggleSymptom = (name: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    )
  }

  const update = (key: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }))
    // フィールド変更時にそのフィールドのエラーをクリア
    if (errors[key]) {
      setErrors(prev => { const next = { ...prev }; delete next[key]; return next })
    }
  }

  // 電話番号の重複チェック
  const checkDuplicatePhone = async (phone: string) => {
    if (!phone) { setDuplicateWarning(''); return }
    const normalized = phone.replace(/[-\s\u3000()（）ー－]/g, '')
    if (normalized.length < 10) { setDuplicateWarning(''); return }
    const { data } = await supabase
      .from('cm_patients')
      .select('name, phone')
      .eq('clinic_id', clinicId)
    if (data) {
      const match = data.find(p => p.phone && p.phone.replace(/[-\s\u3000()（）ー－]/g, '') === normalized)
      if (match) {
        setDuplicateWarning(`同じ電話番号の患者「${match.name}」が既に登録されています`)
      } else {
        setDuplicateWarning('')
      }
    }
  }

  // フォーム全体のバリデーション
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!validateEmail(form.email)) {
      newErrors.email = 'メールアドレスの形式が正しくありません'
    }
    if (!validatePhone(form.phone)) {
      newErrors.phone = '電話番号は10〜11桁で入力してください'
    }
    if (!validateZipcode(form.zipcode)) {
      newErrors.zipcode = '郵便番号は7桁で入力してください'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 音声入力
  const toggleVoice = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      showToast('お使いのブラウザは音声入力に対応していません', 'warning')
      return
    }

    const recognition = new SR()
    recognition.lang = 'ja-JP'
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript
        }
      }
      if (transcript) {
        setVoiceText(prev => prev ? prev + '\n' + transcript : transcript)
      }
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [listening])

  // 画像選択処理
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 5MB制限
    if (file.size > 5 * 1024 * 1024) {
      showToast('画像サイズは5MB以下にしてください', 'warning')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      setImagePreview(result)
      setImageBase64(result)
    }
    reader.readAsDataURL(file)
    // inputをリセット（同じファイル再選択可能に）
    e.target.value = ''
  }

  // AI解析して各項目に自動振り分け（テキスト＋画像対応）
  const handleParse = async () => {
    if (!voiceText.trim() && !imageBase64) return
    setParsing(true)
    setParseError('')

    try {
      const res = await fetch('/api/parse-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: voiceText || undefined, image: imageBase64 || undefined }),
      })
      const data = await res.json()

      if (!res.ok) {
        setParseError(data.error || '解析に失敗しました')
      } else if (data.patient) {
        const p = data.patient

        // 郵便番号が空で住所がある場合、逆引き
        let zipcode = p.zipcode || ''
        if (!zipcode && (p.prefecture || p.city)) {
          zipcode = await reverseLookupZipcode(p.prefecture || '', p.city || '')
        }

        // 郵便番号があって住所が空の場合、正引き
        let prefecture = p.prefecture || ''
        let city = p.city || ''
        if (zipcode && !prefecture) {
          const addr = await lookupByZipcode(zipcode)
          if (addr) {
            prefecture = addr.prefecture
            city = city || addr.city
          }
        }

        setForm(prev => ({
          ...prev,
          name: p.name || prev.name,
          furigana: p.furigana || prev.furigana,
          birth_date: p.birth_date || prev.birth_date,
          gender: p.gender || prev.gender,
          phone: p.phone || prev.phone,
          email: p.email || prev.email,
          zipcode: zipcode || prev.zipcode,
          prefecture: prefecture || prev.prefecture,
          city: city || prev.city,
          address: p.address || prev.address,
          building: p.building || prev.building,
          occupation: p.occupation || prev.occupation,
          referral_source: p.referral_source || prev.referral_source,
          medical_history: p.medical_history || prev.medical_history,
        }))

        // AI解析の主訴をマスターの症状名にマッチング
        if (p.chief_complaint && symptomMaster.length > 0) {
          const rawComplaint = (p.chief_complaint as string)
          const rawLower = rawComplaint.toLowerCase()
          const matched = symptomMaster
            .filter(s => rawLower.includes(s.name.toLowerCase()) || rawLower.includes(s.name.replace(/[・]/g, '').toLowerCase()))
            .map(s => s.name)
          if (matched.length > 0) {
            setSelectedSymptoms(prev => [...new Set([...prev, ...matched])])
            // マッチした症状名を除いた残りをcustomComplaintに
            let remaining = rawComplaint
            matched.forEach(m => { remaining = remaining.replace(new RegExp(m, 'gi'), '').replace(/[、,\s]+/g, ' ').trim() })
            if (remaining) setCustomComplaint(remaining)
          } else {
            // マッチしなかった場合はcustomComplaintに入れる
            setCustomComplaint(rawComplaint)
          }
        } else if (p.chief_complaint) {
          setCustomComplaint(p.chief_complaint)
        }
      }
    } catch {
      setParseError('通信エラーが発生しました')
    }
    setParsing(false)
  }

  const handleSave = async () => {
    if (!form.name) return
    if (!validateForm()) return
    setSaving(true)

    // 患者番号を自動採番（clinic_id内の最大値+1）
    const { data: maxRes } = await supabase
      .from('cm_patients')
      .select('patient_number')
      .eq('clinic_id', clinicId)
      .order('patient_number', { ascending: false })
      .limit(1)
    const nextNumber = (maxRes?.[0]?.patient_number || 0) + 1

    const { error } = await supabase.from('cm_patients').insert({
      ...form,
      status: 'active',
      clinic_id: clinicId,
      patient_number: nextNumber,
    })
    if (!error) {
      setSaved(true)
      setTimeout(() => router.push('/patients'), 800)
    } else {
      console.error('patient insert error:', error)
      if (error.code === '23505') {
        showToast('このデータは既に登録されています', 'error')
      } else if (error.code === '42501' || error.message?.includes('RLS')) {
        showToast('アクセス権がありません', 'error')
      } else {
        showToast('データの保存に失敗しました', 'error')
      }
    }
    setSaving(false)
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A] focus:border-transparent"

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

        {/* カルテ読み込み・音声一括入力エリア */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h3 className="font-bold text-gray-800 text-sm">AI自動入力</h3>
          <p className="text-xs text-gray-500">
            カルテ・問診票の写真を撮るか、音声/テキストで入力するとAIが自動で各項目に振り分けます
          </p>

          {/* カメラ・画像アップロード */}
          <div className="flex gap-2">
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageSelect} className="hidden" />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 transition-all"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z"/>
                <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
              </svg>
              カメラで撮影
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 transition-all"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
              </svg>
              写真を選択
            </button>
          </div>

          {/* 画像プレビュー */}
          {imagePreview && (
            <div className="relative">
              <img src={imagePreview} alt="カルテプレビュー" className="w-full max-h-48 object-contain rounded-lg border border-gray-200" />
              <button
                type="button"
                onClick={() => { setImagePreview(null); setImageBase64(null) }}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow"
              >
                x
              </button>
            </div>
          )}

          <textarea
            value={voiceText}
            onChange={(e) => setVoiceText(e.target.value)}
            placeholder="テキスト入力、音声入力、または上のボタンでカルテ写真を読み込み..."
            className="w-full px-3 py-3 border border-blue-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A] min-h-[80px] resize-y bg-white"
            rows={3}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggleVoice}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                listening
                  ? 'bg-red-500 text-white animate-pulse shadow-lg'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
              {listening ? '録音中...' : '音声'}
            </button>

            <button
              onClick={handleParse}
              disabled={parsing || (!voiceText.trim() && !imageBase64)}
              className="flex-1 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-all"
              style={{ background: '#14252A' }}
            >
              {parsing ? (imageBase64 ? 'カルテ解析中...' : '解析中...') : (imageBase64 ? 'カルテを読み取って自動反映' : '各項目に自動反映')}
            </button>
          </div>

          {parseError && (
            <p className="text-xs text-red-600">{parseError}</p>
          )}
        </div>

        {/* 基本情報 */}
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
              <WarekiDateInput value={form.birth_date} onChange={(v) => update('birth_date', v)} inputClass={inputClass} />
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">電話番号</label>
              <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} onBlur={() => checkDuplicatePhone(form.phone)} className={`${inputClass} ${errors.phone ? 'border-red-400 focus:ring-red-400' : ''}`} placeholder="090-1234-5678" />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              {duplicateWarning && <p className="text-xs text-orange-600 mt-1 bg-orange-50 rounded px-2 py-1">{duplicateWarning}</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">メールアドレス</label>
              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={`${inputClass} ${errors.email ? 'border-red-400 focus:ring-red-400' : ''}`} placeholder="example@email.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
          </div>
        </div>

        {/* 住所 */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-800 text-sm border-b pb-2">住所</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">郵便番号</label>
              <input type="text" value={form.zipcode} onChange={async (e) => {
                const val = e.target.value
                update('zipcode', val)
                const normalized = val.replace(/[-ー－\s]/g, '')
                if (normalized.length === 7) {
                  const addr = await lookupByZipcode(val)
                  if (addr) {
                    setForm(prev => ({
                      ...prev,
                      prefecture: addr.prefecture || prev.prefecture,
                      city: addr.city || prev.city,
                    }))
                  }
                }
              }} className={`${inputClass} ${errors.zipcode ? 'border-red-400 focus:ring-red-400' : ''}`} placeholder="000-0000" />
              {errors.zipcode && <p className="text-xs text-red-500 mt-1">{errors.zipcode}</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">都道府県</label>
              <select value={form.prefecture} onChange={(e) => update('prefecture', e.target.value)} className={inputClass}>
                <option value="">選択</option>
                {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">市区町村</label>
            <input type="text" value={form.city} onChange={(e) => update('city', e.target.value)} className={inputClass} placeholder="住吉区長居" />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">番地</label>
            <input type="text" value={form.address} onChange={(e) => update('address', e.target.value)} className={inputClass} placeholder="1-2-3" />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">建物名・部屋番号</label>
            <input type="text" value={form.building} onChange={(e) => update('building', e.target.value)} className={inputClass} placeholder="○○マンション101" />
          </div>
        </div>

        {/* 来院情報 */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-800 text-sm border-b pb-2">来院情報</h3>

          <div>
            <label className="block text-xs text-gray-600 mb-1">職業</label>
            <select value={form.occupation} onChange={(e) => update('occupation', e.target.value)} className={inputClass}>
              <option value="">選択してください</option>
              {occupationMaster.map(o => <option key={o} value={o}>{o}</option>)}
              <option value="その他">その他</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">来院経路</label>
            <select value={form.referral_source} onChange={(e) => update('referral_source', e.target.value)} className={inputClass}>
              <option value="">選択してください</option>
              {REFERRAL_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">主訴（お困りの症状）</label>
            {symptomMaster.length > 0 ? (
              <>
                {/* カテゴリごとにグループ化 */}
                {(() => {
                  const categories = [...new Set(symptomMaster.map(s => s.category || '未分類'))]
                  return categories.map(cat => {
                    const items = symptomMaster.filter(s => (s.category || '未分類') === cat)
                    return (
                      <div key={cat} className="mb-2">
                        <p className="text-xs text-gray-500 mb-1">{cat}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {items.map(s => (
                            <button
                              key={s.name}
                              type="button"
                              onClick={() => toggleSymptom(s.name)}
                              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                                selectedSymptoms.includes(s.name)
                                  ? 'bg-blue-500 text-white border-blue-500'
                                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                              }`}
                            >
                              {s.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })
                })()}
                {selectedSymptoms.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">選択中: {selectedSymptoms.join(', ')}</p>
                )}
                <textarea
                  value={customComplaint}
                  onChange={(e) => setCustomComplaint(e.target.value)}
                  className={`${inputClass} mt-2`}
                  rows={2}
                  placeholder="上記にない症状があれば追記..."
                />
              </>
            ) : (
              <textarea value={form.chief_complaint} onChange={(e) => update('chief_complaint', e.target.value)} className={inputClass} rows={3} placeholder="腰痛、肩こり、頭痛..." />
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">既往歴</label>
            <textarea value={form.medical_history} onChange={(e) => update('medical_history', e.target.value)} className={inputClass} rows={2} placeholder="手術歴、持病など" />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">メモ</label>
            <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} className={inputClass} rows={2} placeholder="注意点など" />
          </div>

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

// 和暦⇔西暦変換テーブル
const ERAS = [
  { name: '令和', start: 2019 },
  { name: '平成', start: 1989 },
  { name: '昭和', start: 1926 },
  { name: '大正', start: 1912 },
  { name: '明治', start: 1868 },
] as const

function warekiToSeireki(era: string, year: number): number {
  const e = ERAS.find(e => e.name === era)
  return e ? e.start + year - 1 : year
}

function seirekiToWareki(seireki: number): { era: string; year: number } {
  for (const e of ERAS) {
    if (seireki >= e.start) return { era: e.name, year: seireki - e.start + 1 }
  }
  return { era: '西暦', year: seireki }
}

function WarekiDateInput({ value, onChange, inputClass }: { value: string; onChange: (v: string) => void; inputClass: string }) {
  const [mode, setMode] = useState<'wareki' | 'seireki'>('wareki')
  const [era, setEra] = useState('昭和')
  const [warekiYear, setWarekiYear] = useState('')
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')

  // 外部からvalueが変わった時（AI解析等）に同期
  useEffect(() => {
    if (!value) return
    const [y, m, d] = value.split('-').map(Number)
    if (!y) return
    const w = seirekiToWareki(y)
    setEra(w.era === '西暦' ? '昭和' : w.era)
    setWarekiYear(w.era === '西暦' ? String(y) : String(w.year))
    setMonth(m ? String(m) : '')
    setDay(d ? String(d) : '')
  }, [value])

  const buildDate = (newEra: string, newYear: string, newMonth: string, newDay: string) => {
    const y = parseInt(newYear)
    const m = parseInt(newMonth)
    const d = parseInt(newDay)
    if (!y || !m || !d) { onChange(''); return }
    const seireki = mode === 'wareki' ? warekiToSeireki(newEra, y) : y
    const dateStr = `${seireki}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    onChange(dateStr)
  }

  const selectClass = inputClass.replace('w-full ', '')

  return (
    <div className="space-y-2">
      <div className="flex gap-1 mb-1">
        <button type="button" onClick={() => setMode('wareki')}
          className={`px-2 py-0.5 text-[10px] rounded ${mode === 'wareki' ? 'bg-[#14252A] text-white' : 'bg-gray-100 text-gray-500'}`}>和暦</button>
        <button type="button" onClick={() => setMode('seireki')}
          className={`px-2 py-0.5 text-[10px] rounded ${mode === 'seireki' ? 'bg-[#14252A] text-white' : 'bg-gray-100 text-gray-500'}`}>西暦</button>
      </div>
      <div className="flex items-center gap-1">
        {mode === 'wareki' && (
          <select value={era} onChange={(e) => { setEra(e.target.value); buildDate(e.target.value, warekiYear, month, day) }}
            className={`${selectClass} w-[72px] px-1.5 text-xs`}>
            {ERAS.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
          </select>
        )}
        <input type="number" inputMode="numeric" value={warekiYear} placeholder={mode === 'wareki' ? '年' : '西暦'}
          onChange={(e) => { setWarekiYear(e.target.value); buildDate(era, e.target.value, month, day) }}
          className={`${selectClass} w-[52px] px-1.5 text-xs text-center`} />
        <span className="text-xs text-gray-400">年</span>
        <input type="number" inputMode="numeric" value={month} placeholder="月"
          onChange={(e) => { setMonth(e.target.value); buildDate(era, warekiYear, e.target.value, day) }}
          className={`${selectClass} w-[42px] px-1.5 text-xs text-center`} min={1} max={12} />
        <span className="text-xs text-gray-400">月</span>
        <input type="number" inputMode="numeric" value={day} placeholder="日"
          onChange={(e) => { setDay(e.target.value); buildDate(era, warekiYear, month, e.target.value) }}
          className={`${selectClass} w-[42px] px-1.5 text-xs text-center`} min={1} max={31} />
        <span className="text-xs text-gray-400">日</span>
      </div>
    </div>
  )
}
