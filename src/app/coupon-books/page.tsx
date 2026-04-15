'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { getClinicId } from '@/lib/clinic'
import type { CouponBook } from '@/lib/types'

type FilterStatus = '' | 'active' | 'low' | 'completed' | 'expired'

const ITEMS_PER_PAGE = 50

function CouponSkeleton() {
  return (
    <>
      {/* PC skeleton */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                {['患者名', '券種', '残り/全体', '購入金額', '購入日', '有効期限', 'ステータス'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-xs text-gray-500 font-semibold text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="px-3 py-3"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-3 py-3"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-3 py-3"><div className="h-2 w-24 bg-gray-200 rounded-full animate-pulse mx-auto" /></td>
                  <td className="px-3 py-3"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse ml-auto" /></td>
                  <td className="px-3 py-3"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-3 py-3"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-3 py-3"><div className="h-5 w-14 bg-gray-200 rounded-full animate-pulse mx-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Mobile skeleton */}
      <div className="md:hidden space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-3.5 border-l-4 border-l-gray-200">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-12 bg-gray-200 rounded-full animate-pulse" />
                </div>
                <div className="h-3 w-36 bg-gray-200 rounded animate-pulse mt-1.5" />
              </div>
              <div className="text-right ml-2 shrink-0">
                <div className="h-6 w-12 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-10 bg-gray-200 rounded animate-pulse mt-1" />
              </div>
            </div>
            <div className="mt-2 h-2 w-full bg-gray-200 rounded-full animate-pulse" />
            <div className="flex gap-3 mt-2">
              <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default function CouponBooksPage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const [coupons, setCoupons] = useState<CouponBook[]>([])
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterStatus>('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('cm_coupon_books')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })

      if (error) {
        // テーブルが存在しない場合
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
          setTableError(true)
        }
        setLoading(false)
        return
      }

      setCoupons(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const today = new Date().toISOString().split('T')[0]

  const isLow = (c: CouponBook) => c.status === 'active' && c.remaining_count <= 3 && c.remaining_count > 0
  const isExpiringSoon = (c: CouponBook) => {
    if (!c.expiry_date || c.status !== 'active') return false
    const diff = (new Date(c.expiry_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
    return diff <= 30 && diff >= 0
  }

  const filtered = useMemo(() => {
    let list = coupons

    if (search) {
      list = list.filter(c => c.patient_name.includes(search))
    }

    switch (filter) {
      case 'active':
        list = list.filter(c => c.status === 'active' && c.remaining_count > 3)
        break
      case 'low':
        list = list.filter(c => isLow(c))
        break
      case 'completed':
        list = list.filter(c => c.status === 'completed')
        break
      case 'expired':
        list = list.filter(c => c.status === 'expired')
        break
    }

    return list
  }, [coupons, search, filter])

  // Reset page when filter/search changes
  useEffect(() => { setCurrentPage(1) }, [search, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginatedItems = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const getStatusBadge = (c: CouponBook) => {
    if (c.status === 'completed') return { text: '使い切り', cls: 'bg-blue-50 text-blue-700' }
    if (c.status === 'expired') return { text: '期限切れ', cls: 'bg-gray-100 text-gray-500' }
    if (c.status === 'refunded') return { text: '返金済', cls: 'bg-red-50 text-red-600' }
    if (isLow(c)) return { text: '残りわずか', cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' }
    if (isExpiringSoon(c)) return { text: '期限間近', cls: 'bg-red-50 text-red-600 border border-red-200' }
    return { text: '利用中', cls: 'bg-green-50 text-green-700' }
  }

  if (tableError) {
    return (
      <AppShell>
        <Header title="回数券管理" />
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

  return (
    <AppShell>
      <Header title="回数券管理" />
      <div className="px-4 py-4 max-w-5xl mx-auto">

        {/* アクションバー */}
        <div className="bg-white rounded-xl shadow-sm p-3 mb-4 flex flex-wrap gap-2 items-center">
          <Link
            href="/coupon-books/new"
            className="text-white rounded-lg px-4 py-2.5 text-center font-bold text-sm shadow-sm hover:opacity-90"
            style={{ background: '#14252A' }}
          >
            + 回数券を登録
          </Link>
        </div>

        {/* 検索 + フィルタ */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="患者名で検索"
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#14252A] bg-white shadow-sm"
            />
          </div>
          <div className="flex gap-1 items-center overflow-x-auto">
            {([
              { value: '' as FilterStatus, label: '全て' },
              { value: 'active' as FilterStatus, label: '利用中' },
              { value: 'low' as FilterStatus, label: '残りわずか' },
              { value: 'completed' as FilterStatus, label: '完了' },
              { value: 'expired' as FilterStatus, label: '期限切れ' },
            ]).map(s => (
              <button
                key={s.value}
                onClick={() => setFilter(s.value)}
                className={`px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  filter === s.value
                    ? 'bg-[#14252A] text-white shadow-sm'
                    : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-2">{filtered.length}件の回数券</p>

        {loading ? (
          <CouponSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">回数券が登録されていません</p>
            <Link
              href="/coupon-books/new"
              className="inline-block text-white rounded-lg px-6 py-3 font-bold text-sm"
              style={{ background: '#14252A' }}
            >
              最初の回数券を登録する
            </Link>
          </div>
        ) : (
          <>
            {/* PC: テーブル */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-3 py-2.5 text-xs text-gray-500 font-semibold text-left">患者名</th>
                      <th className="px-3 py-2.5 text-xs text-gray-500 font-semibold text-left">券種</th>
                      <th className="px-3 py-2.5 text-xs text-gray-500 font-semibold text-center">残り/全体</th>
                      <th className="px-3 py-2.5 text-xs text-gray-500 font-semibold text-right">購入金額</th>
                      <th className="px-3 py-2.5 text-xs text-gray-500 font-semibold text-left">購入日</th>
                      <th className="px-3 py-2.5 text-xs text-gray-500 font-semibold text-left">有効期限</th>
                      <th className="px-3 py-2.5 text-xs text-gray-500 font-semibold text-center">ステータス</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((c, idx) => {
                      const badge = getStatusBadge(c)
                      const progressPercent = c.total_count > 0 ? ((c.total_count - c.remaining_count) / c.total_count) * 100 : 0
                      return (
                        <tr key={c.id} className={`border-b hover:bg-blue-50/40 active:bg-blue-100/40 cursor-pointer ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                          <td className="px-3 py-3">
                            <Link href={`/coupon-books/${c.id}`} className="text-blue-600 hover:underline font-medium">
                              {c.patient_name}
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-xs">{c.coupon_type}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${progressPercent}%`,
                                    background: progressPercent >= 90 ? '#ef4444' : progressPercent >= 70 ? '#eab308' : '#3b82f6',
                                  }}
                                />
                              </div>
                              <span className="text-xs font-medium text-gray-700">
                                {c.remaining_count}/{c.total_count}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right text-xs font-medium">
                            {c.purchase_amount.toLocaleString()}円
                          </td>
                          <td className="px-3 py-3 text-xs">{c.purchase_date}</td>
                          <td className="px-3 py-3 text-xs">
                            {c.expiry_date ? (
                              <span className={isExpiringSoon(c) ? 'text-red-600 font-medium' : ''}>
                                {c.expiry_date}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                              {badge.text}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* モバイル: カード */}
            <div className="md:hidden space-y-2">
              {paginatedItems.map(c => {
                const badge = getStatusBadge(c)
                const progressPercent = c.total_count > 0 ? ((c.total_count - c.remaining_count) / c.total_count) * 100 : 0
                return (
                  <Link
                    key={c.id}
                    href={`/coupon-books/${c.id}`}
                    className={`block bg-white rounded-xl shadow-sm p-3.5 hover:shadow-md transition-shadow border-l-4 ${
                      c.status === 'active' ? (isLow(c) ? 'border-l-yellow-400' : 'border-l-green-500') :
                      c.status === 'completed' ? 'border-l-blue-500' :
                      'border-l-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-800">{c.patient_name}</p>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                            {badge.text}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{c.coupon_type} / {c.purchase_amount.toLocaleString()}円</p>
                      </div>
                      <div className="text-right ml-2 shrink-0">
                        <p className="text-lg font-bold" style={{ color: '#14252A' }}>
                          {c.remaining_count}<span className="text-xs text-gray-400">/{c.total_count}</span>
                        </p>
                        <p className="text-[10px] text-gray-400">残り回数</p>
                      </div>
                    </div>

                    {/* プログレスバー */}
                    <div className="mt-2">
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${progressPercent}%`,
                            background: progressPercent >= 90 ? '#ef4444' : progressPercent >= 70 ? '#eab308' : '#3b82f6',
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 mt-2 text-xs text-gray-400">
                      <span>購入: {c.purchase_date}</span>
                      {c.expiry_date && (
                        <span className={isExpiringSoon(c) ? 'text-red-500 font-medium' : ''}>
                          期限: {c.expiry_date}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-4 py-3">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  aria-label="前のページ"
                >
                  &lt;
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .reduce<(number | string)[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) =>
                    typeof p === 'string' ? (
                      <span key={`ellipsis-${i}`} className="text-gray-400 text-sm px-1">...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === p ? 'bg-[#14252A] text-white' : 'border border-gray-200 hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  aria-label="次のページ"
                >
                  &gt;
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
