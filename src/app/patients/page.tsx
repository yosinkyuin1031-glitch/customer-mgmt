'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import type { Patient } from '@/lib/types'

export default function PatientsPage() {
  const supabase = createClient()
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const [referralFilter, setReferralFilter] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCsvModal, setShowCsvModal] = useState(false)

  useEffect(() => {
    const load = async () => {
      let query = supabase.from('cm_patients').select('*').order('updated_at', { ascending: false })
      if (statusFilter) query = query.eq('status', statusFilter)
      if (genderFilter) query = query.eq('gender', genderFilter)
      if (referralFilter) query = query.eq('referral_source', referralFilter)
      const { data } = await query
      setPatients(data || [])
      setLoading(false)
    }
    load()
  }, [statusFilter, genderFilter, referralFilter])

  const filtered = search
    ? patients.filter(p =>
        p.name.includes(search) ||
        p.furigana?.includes(search) ||
        p.phone?.includes(search) ||
        p.chief_complaint?.includes(search) ||
        p.address?.includes(search)
      )
    : patients

  const downloadCsv = () => {
    const headers = ['氏名', 'ふりがな', '性別', '生年月日', '電話番号', 'メール', '住所', '職業', '来院経路', '主訴', 'ステータス']
    const rows = filtered.map(p => [
      p.name, p.furigana, p.gender, p.birth_date || '', p.phone, p.email,
      `${p.prefecture || ''}${p.city || ''}${p.address || ''}${p.building || ''}`,
      p.occupation, p.referral_source, p.chief_complaint,
      p.status === 'active' ? '通院中' : p.status === 'completed' ? '卒業' : '休止'
    ])

    const bom = '\uFEFF'
    const csv = bom + [headers.join(','), ...rows.map(r => r.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `患者一覧_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setShowCsvModal(false)
  }

  const uniqueReferrals = [...new Set(patients.map(p => p.referral_source).filter(Boolean))]

  return (
    <AppShell>
      <Header title="患者一覧" />
      <div className="px-4 py-4 max-w-5xl mx-auto">
        {/* アクションバー */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Link href="/patients/new" className="text-white rounded-lg px-4 py-2 text-center font-bold text-sm" style={{ background: '#14252A' }}>
            + 新規患者登録
          </Link>
          <button onClick={() => setShowCsvModal(true)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            CSV出力
          </button>
          <button onClick={() => setShowAdvanced(!showAdvanced)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            {showAdvanced ? '検索を閉じる' : '詳細検索'}
          </button>
        </div>

        {/* 基本検索 */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="名前・電話・主訴・住所で検索"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A]"
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">全ステータス</option>
            <option value="active">通院中</option>
            <option value="inactive">休止</option>
            <option value="completed">卒業</option>
          </select>
        </div>

        {/* 詳細検索 */}
        {showAdvanced && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">性別</label>
              <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                <option value="">全て</option>
                <option value="男性">男性</option>
                <option value="女性">女性</option>
                <option value="その他">その他</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">来院経路</label>
              <select value={referralFilter} onChange={e => setReferralFilter(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                <option value="">全て</option>
                {uniqueReferrals.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="col-span-2 flex items-end">
              <button onClick={() => { setGenderFilter(''); setReferralFilter(''); setStatusFilter(''); setSearch('') }}
                className="px-4 py-1.5 text-xs text-red-500 border border-red-200 rounded hover:bg-red-50">
                フィルタをリセット
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 mb-2">{filtered.length}件の患者</p>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-400 text-center py-8">患者が見つかりません</p>
        ) : (
          /* テーブル表示（PC）/ カード表示（モバイル） */
          <>
            {/* PC: テーブル */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-3 py-2 text-xs text-gray-500">氏名</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">性別</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">電話番号</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">主訴</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">来院経路</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <Link href={`/patients/${p.id}`} className="text-blue-600 hover:underline font-medium">
                          {p.name}
                        </Link>
                        {p.furigana && <span className="text-xs text-gray-400 ml-1">{p.furigana}</span>}
                      </td>
                      <td className="px-3 py-2">{p.gender}</td>
                      <td className="px-3 py-2">{p.phone}</td>
                      <td className="px-3 py-2 text-gray-600 truncate max-w-[150px]">{p.chief_complaint}</td>
                      <td className="px-3 py-2 text-xs">{p.referral_source}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          p.status === 'active' ? 'bg-green-100 text-green-700' :
                          p.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {p.status === 'active' ? '通院中' : p.status === 'completed' ? '卒業' : '休止'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* モバイル: カード */}
            <div className="md:hidden space-y-2">
              {filtered.map(p => (
                <Link key={p.id} href={`/patients/${p.id}`} className="block bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-800">{p.name}</p>
                      {p.furigana && <p className="text-xs text-gray-400">{p.furigana}</p>}
                      <p className="text-xs text-gray-500 mt-1">{p.chief_complaint}</p>
                      {p.phone && <p className="text-xs text-gray-400 mt-0.5">TEL: {p.phone}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        p.status === 'active' ? 'bg-green-100 text-green-700' :
                        p.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {p.status === 'active' ? '通院中' : p.status === 'completed' ? '卒業' : '休止'}
                      </span>
                      {p.referral_source && (
                        <span className="text-xs text-gray-400">{p.referral_source}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* CSV出力モーダル */}
        {showCsvModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCsvModal(false)}>
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-gray-800 mb-3">CSV出力</h3>
              <p className="text-sm text-gray-600 mb-4">
                現在のフィルタ条件で{filtered.length}件の患者データをCSV形式でダウンロードします。
              </p>
              <div className="flex gap-2">
                <button onClick={downloadCsv} className="flex-1 text-white py-2 rounded-lg text-sm font-bold" style={{ background: '#14252A' }}>
                  ダウンロード
                </button>
                <button onClick={() => setShowCsvModal(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
