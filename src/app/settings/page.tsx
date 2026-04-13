'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { getClinicId } from '@/lib/clinic'
import { useToast } from '@/lib/toast'

export default function SettingsPage() {
  const supabase = createClient()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null)
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // メール・パスワード変更
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailMsg, setEmailMsg] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  const clinicId = getClinicId()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setEmail(user.email || '')

      // クリニック情報を取得
      const { data: clinic } = await supabase
        .from('clinics')
        .select('name, plan, stripe_customer_id, plan_expires_at')
        .eq('id', clinicId)
        .single()

      if (clinic) {
        setClinicName(clinic.name || '')
        setStripeCustomerId(clinic.stripe_customer_id || null)
        setPlanExpiresAt(clinic.plan_expires_at || null)
      }
    }
    load()
  }, [])

  const handleManagePlan = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        showToast('決済処理でエラーが発生しました。再度お試しください', 'error')
      }
    } catch {
      showToast('ネットワークエラーが発生しました', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) return
    setEmailLoading(true)
    setEmailMsg('')
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    if (error) {
      console.error(error); setEmailMsg('メールアドレスの変更に失敗しました')
    } else {
      setEmailMsg('確認メールを送信しました。新しいメールアドレスで確認してください。')
      setNewEmail('')
    }
    setEmailLoading(false)
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      setPwMsg('パスワードは6文字以上で入力してください')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMsg('パスワードが一致しません')
      return
    }
    setPwLoading(true)
    setPwMsg('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      console.error(error); setPwMsg('パスワードの変更に失敗しました')
    } else {
      setPwMsg('パスワードを変更しました')
      setNewPassword('')
      setConfirmPassword('')
    }
    setPwLoading(false)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
  }

  return (
    <AppShell>
      <Header title="設定" />
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

        <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
          <h3 className="font-bold text-gray-800 text-sm mb-3">アカウント情報</h3>
          <p className="text-sm text-gray-600">現在のメールアドレス: {email}</p>

          {/* メールアドレス変更 */}
          <div className="border-t pt-3">
            <label className="block text-xs text-gray-500 mb-1">メールアドレスを変更</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A]"
                placeholder="新しいメールアドレス"
              />
              <button
                onClick={handleChangeEmail}
                disabled={emailLoading || !newEmail.trim()}
                className="px-4 py-2 bg-[#14252A] text-white text-xs rounded-lg disabled:opacity-50"
              >
                {emailLoading ? '...' : '変更'}
              </button>
            </div>
            {emailMsg && <p className={`text-xs mt-1 ${emailMsg.includes('失敗') ? 'text-red-500' : 'text-green-600'}`}>{emailMsg}</p>}
          </div>

          {/* パスワード変更 */}
          <div className="border-t pt-3">
            <label className="block text-xs text-gray-500 mb-1">パスワードを変更</label>
            <div className="space-y-2">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A]"
                placeholder="新しいパスワード（6文字以上）"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A]"
                placeholder="パスワード確認（もう一度入力）"
              />
              <button
                onClick={handleChangePassword}
                disabled={pwLoading || !newPassword}
                className="w-full py-2 bg-[#14252A] text-white text-xs rounded-lg disabled:opacity-50"
              >
                {pwLoading ? '変更中...' : 'パスワードを変更'}
              </button>
            </div>
            {pwMsg && <p className={`text-xs mt-1 ${pwMsg.includes('失敗') || pwMsg.includes('一致') || pwMsg.includes('6文字') ? 'text-red-500' : 'text-green-600'}`}>{pwMsg}</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-bold text-gray-800 text-sm mb-3">院情報</h3>
          <div className="space-y-1 text-sm text-gray-600">
            <p>{clinicName || '未設定'}</p>
          </div>
        </div>

        {/* ご契約情報 */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-bold text-gray-800 text-sm mb-3">ご契約情報</h3>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                スタンダードプラン
              </span>
            </div>
            <p className="text-xs text-gray-500">月額¥4,980 / 全機能利用可能</p>

            {planExpiresAt && (
              <p className="text-xs text-gray-400 mt-1">
                次回更新日: {formatDate(planExpiresAt)}
              </p>
            )}
          </div>

          {stripeCustomerId && (
            <button
              onClick={handleManagePlan}
              disabled={loading}
              className="w-full py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {loading ? '処理中...' : 'ご契約の管理・解約（Stripe）'}
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-bold text-gray-800 text-sm mb-3">データエクスポート</h3>
          <p className="text-xs text-gray-400 mb-3">患者データ・施術記録をCSV形式でダウンロードできます。</p>
          <div className="space-y-2">
            <button
              onClick={() => {
                window.location.href = `/api/export/patients?clinicId=${clinicId}`
              }}
              className="w-full py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <span>&#x1F4CB;</span> 患者一覧をCSVダウンロード
            </button>
            <button
              onClick={() => {
                window.location.href = `/api/export/sales?clinicId=${clinicId}`
              }}
              className="w-full py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <span>&#x1F4B0;</span> 売上データをCSVダウンロード
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">BOM付きUTF-8形式（Excel対応）</p>
        </div>
      </div>
    </AppShell>
  )
}
