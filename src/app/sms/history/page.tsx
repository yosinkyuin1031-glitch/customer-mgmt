'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'

interface SMSLog {
  id: string
  sentAt: string
  count: number
  templateName: string
  recipients: { name: string }[]
  message: string
}

const ITEMS_PER_PAGE = 20

function formatDate(iso: string): string {
  const d = new Date(iso)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${d.getFullYear()}/${month}/${day} ${hours}:${minutes}`
}

function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-32 bg-gray-200 rounded animate-pulse mt-1.5" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-3 w-4 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ConfirmModal({ open, title, message, confirmLabel, onConfirm, onCancel }: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 text-base mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
            キャンセル
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SMSHistoryPage() {
  const [logs, setLogs] = useState<SMSLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showClearModal, setShowClearModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem('sms_logs') || '[]')
      setLogs(stored)
    } catch {
      setLogs([])
    }
    setLoading(false)
  }, [])

  const handleClearAll = useCallback(() => {
    sessionStorage.removeItem('sms_logs')
    setLogs([])
    setShowClearModal(false)
    setCurrentPage(1)
  }, [])

  const totalPages = Math.max(1, Math.ceil(logs.length / ITEMS_PER_PAGE))
  const paginatedLogs = logs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  return (
    <AppShell>
      <Header title="SMS送信履歴" />
      <div className="px-4 py-4 max-w-lg mx-auto">

        {/* アクションバー */}
        <div className="flex justify-between items-center mb-4">
          <Link
            href="/sms"
            className="text-white rounded-lg px-4 py-2.5 text-center font-bold text-sm shadow-sm hover:opacity-90"
            style={{ background: '#14252A' }}
          >
            + 新規SMS送信
          </Link>
          {logs.length > 0 && (
            <button
              onClick={() => setShowClearModal(true)}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              履歴を削除
            </button>
          )}
        </div>

        {loading ? (
          <HistorySkeleton />
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="text-4xl mb-3">&#x1F4EC;</div>
            <p className="text-gray-400 text-sm">送信履歴はまだありません</p>
            <Link
              href="/sms"
              className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              SMSを送信する &rarr;
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {paginatedLogs.map(log => (
                <div key={log.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          {log.count}名に送信
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatDate(log.sentAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                          {log.templateName}
                        </span>
                        <span className="text-gray-400 text-xs">
                          {expandedId === log.id ? '\u25B2' : '\u25BC'}
                        </span>
                      </div>
                    </div>
                  </button>

                  {expandedId === log.id && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      {/* 送信先 */}
                      <div className="mt-3 mb-3">
                        <p className="text-xs text-gray-400 font-semibold mb-1.5">送信先</p>
                        <div className="space-y-1">
                          {log.recipients.map((r, i) => (
                            <div key={i} className="text-xs py-1">
                              <span className="text-gray-700">{r.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* メッセージ */}
                      <div>
                        <p className="text-xs text-gray-400 font-semibold mb-1.5">メッセージ</p>
                        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 whitespace-pre-wrap border border-gray-100">
                          {log.message}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
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

        {/* モック注記 */}
        <div className="mt-6 bg-yellow-50 rounded-xl p-3 border border-yellow-200">
          <p className="text-xs text-yellow-700">
            &#x26A0; テストモードの送信履歴です。実際にSMSは送信されていません。
          </p>
        </div>
      </div>

      <ConfirmModal
        open={showClearModal}
        title="送信履歴を削除"
        message="送信履歴をすべて削除しますか？この操作は元に戻せません。"
        confirmLabel="すべて削除"
        onConfirm={handleClearAll}
        onCancel={() => setShowClearModal(false)}
      />
    </AppShell>
  )
}
