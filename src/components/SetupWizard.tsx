'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getClinicId } from '@/lib/clinic'

const STORAGE_KEY = 'setup_completed'

interface ClinicInfo {
  name: string
  staff_count: number | null
  years_in_business: number | null
}

export default function SetupWizard() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [clinic, setClinic] = useState<ClinicInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY)
    if (completed === 'true') {
      setVisible(false)
      return
    }

    const loadClinic = async () => {
      try {
        const supabase = createClient()
        const clinicId = getClinicId()
        const { data } = await supabase
          .from('clinics')
          .select('name, staff_count, years_in_business')
          .eq('id', clinicId)
          .single()
        if (data) setClinic(data)
      } catch {
        // clinicsテーブルにカラムがない場合もあるのでスキップ
      }
      setLoading(false)
      setVisible(true)
    }
    loadClinic()
  }, [])

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  const handleSkip = () => {
    handleComplete()
  }

  if (!visible) return null

  const steps = [
    { label: '基本情報', icon: '🏥' },
    { label: 'メニュー登録', icon: '📋' },
    { label: '患者登録', icon: '👤' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in">
        {/* ヘッダー */}
        <div className="px-6 pt-6 pb-4" style={{ background: 'linear-gradient(135deg, #14252A 0%, #1e3a42 100%)' }}>
          <h2 className="text-white text-lg font-bold">ようこそ！初期セットアップ</h2>
          <p className="text-gray-300 text-xs mt-1">3つのステップで使い始めましょう</p>

          {/* ステップインジケーター */}
          <div className="flex items-center gap-2 mt-4">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-all duration-300"
                  style={{
                    backgroundColor: i <= step ? '#ffffff' : 'rgba(255,255,255,0.2)',
                    color: i <= step ? '#14252A' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {i < step ? '✓' : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-0.5 rounded" style={{ backgroundColor: i < step ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)' }} />
                )}
              </div>
            ))}
          </div>
          <div className="flex mt-1.5">
            {steps.map((s, i) => (
              <div key={i} className="flex-1 text-center">
                <span className="text-[10px]" style={{ color: i <= step ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)' }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* コンテンツ */}
        <div className="px-6 py-6 min-h-[220px] flex flex-col justify-between">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-[#14252A] rounded-full" />
            </div>
          ) : (
            <>
              {/* ステップ1: 基本情報確認 */}
              {step === 0 && (
                <div>
                  <div className="text-center mb-4">
                    <span className="text-4xl">{steps[0].icon}</span>
                  </div>
                  <h3 className="text-base font-bold text-gray-800 text-center mb-4">院の基本情報を確認</h3>
                  {clinic ? (
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">院名</span>
                        <span className="text-sm font-bold text-gray-800">{clinic.name || '未設定'}</span>
                      </div>
                      <div className="border-t border-gray-200" />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">スタッフ数</span>
                        <span className="text-sm font-bold text-gray-800">{clinic.staff_count ?? '未設定'}{clinic.staff_count ? '名' : ''}</span>
                      </div>
                      <div className="border-t border-gray-200" />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">開業年数</span>
                        <span className="text-sm font-bold text-gray-800">{clinic.years_in_business ?? '未設定'}{clinic.years_in_business ? '年' : ''}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm text-gray-500 text-center">院の情報を取得できませんでした。<br />設定画面から登録できます。</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 text-center mt-3">
                    情報の変更は「設定」から行えます
                  </p>
                </div>
              )}

              {/* ステップ2: メニュー登録案内 */}
              {step === 1 && (
                <div>
                  <div className="text-center mb-4">
                    <span className="text-4xl">{steps[1].icon}</span>
                  </div>
                  <h3 className="text-base font-bold text-gray-800 text-center mb-3">基本メニューを登録しましょう</h3>
                  <p className="text-sm text-gray-600 text-center mb-5 leading-relaxed">
                    施術メニューを登録すると、施術記録の入力がスムーズになります。<br />
                    よく使うメニューから登録してみましょう。
                  </p>
                  <Link
                    href="/master/base-menus"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#14252A' }}
                    onClick={handleComplete}
                  >
                    メニューを登録する →
                  </Link>
                  <p className="text-xs text-gray-400 text-center mt-3">
                    後からでも「マスタ管理」から登録できます
                  </p>
                </div>
              )}

              {/* ステップ3: 患者登録案内 */}
              {step === 2 && (
                <div>
                  <div className="text-center mb-4">
                    <span className="text-4xl">{steps[2].icon}</span>
                  </div>
                  <h3 className="text-base font-bold text-gray-800 text-center mb-3">患者さんを登録してみましょう</h3>
                  <p className="text-sm text-gray-600 text-center mb-5 leading-relaxed">
                    既存の患者データがある場合はCSVで一括インポート。<br />
                    少人数なら手動登録も簡単です。
                  </p>
                  <div className="space-y-2.5">
                    <Link
                      href="/patients/import"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: '#14252A' }}
                      onClick={handleComplete}
                    >
                      CSV一括インポート →
                    </Link>
                    <Link
                      href="/patients/new"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold shadow-sm border-2 hover:bg-gray-50 transition-colors"
                      style={{ borderColor: '#14252A', color: '#14252A' }}
                      onClick={handleComplete}
                    >
                      手動で登録する →
                    </Link>
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-3">
                    いつでもダッシュボードから登録できます
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* フッターボタン */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            スキップ
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-xs font-bold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                戻る
              </button>
            )}
            {step < 2 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-5 py-2 text-xs font-bold rounded-lg text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#14252A' }}
              >
                次へ
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="px-5 py-2 text-xs font-bold rounded-lg text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#14252A' }}
              >
                完了
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
