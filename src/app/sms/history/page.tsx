'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import AppShell from '@/components/AppShell'

interface SMSLog {
  id: string
  sentAt: string
  count: number
  templateName: string
  recipients: { name: string; phone: string }[]
  message: string
}

function maskPhone(phone: string): string {
  if (!phone) return ''
  const cleaned = phone.replace(/[-\s]/g, '')
  if (cleaned.length >= 8) {
    return cleaned.slice(0, 3) + '-' + 'XXXX' + '-' + cleaned.slice(-4)
  }
  return phone
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${d.getFullYear()}/${month}/${day} ${hours}:${minutes}`
}

export default function SMSHistoryPage() {
  const [logs, setLogs] = useState<SMSLog[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('sms_logs') || '[]')
      setLogs(stored)
    } catch {
      setLogs([])
    }
  }, [])

  const handleClearAll = () => {
    if (confirm('送信履歴をすべて削除しますか？')) {
      localStorage.removeItem('sms_logs')
      setLogs([])
    }
  }

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
              onClick={handleClearAll}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              履歴を削除
            </button>
          )}
        </div>

        {logs.length === 0 ? (
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
          <div className="space-y-3">
            {logs.map(log => (
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
                          <div key={i} className="flex justify-between text-xs py-1">
                            <span className="text-gray-700">{r.name}</span>
                            <span className="text-gray-400">{maskPhone(r.phone)}</span>
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
        )}

        {/* モック注記 */}
        <div className="mt-6 bg-yellow-50 rounded-xl p-3 border border-yellow-200">
          <p className="text-xs text-yellow-700">
            &#x26A0; テストモードの送信履歴です。実際にSMSは送信されていません。
          </p>
        </div>
      </div>
    </AppShell>
  )
}
