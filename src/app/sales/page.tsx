'use client'

import Link from 'next/link'
import AppShell from '@/components/AppShell'

const saleTabs = [
  { href: '/sales', label: '概要' },
  { href: '/patients', label: '顧客管理' },
  { href: '/sales/revenue', label: '売上集計' },
  { href: '/sales/slips', label: '伝票一覧' },
  { href: '/sales/ltv', label: 'LTV' },
  { href: '/sales/repeat', label: 'リピート' },
  { href: '/sales/hourly', label: '時間単価' },
  { href: '/sales/utilization', label: '稼働率' },
  { href: '/sales/cross', label: 'クロス集計' },
]

const menuCards = [
  { href: '/patients', icon: '👥', title: '顧客管理', desc: '患者の登録・検索・編集・施術履歴の管理' },
  { href: '/sales/revenue', icon: '💰', title: '売上集計', desc: '日別・月別・年別の売上分析' },
  { href: '/sales/slips', icon: '🧾', title: '伝票一覧', desc: '施術伝票の一覧と詳細' },
  { href: '/sales/ltv', icon: '📈', title: 'LTV分析', desc: '顧客生涯価値の分析' },
  { href: '/sales/repeat', icon: '🔄', title: 'リピート分析', desc: '新規・リピート比率の推移' },
  { href: '/sales/hourly', icon: '⏱', title: '時間単価', desc: '時間あたりの売上効率' },
  { href: '/sales/utilization', icon: '📊', title: '稼働率', desc: '予約枠の稼働状況' },
  { href: '/sales/cross', icon: '🔀', title: 'クロス集計', desc: '多角的な売上分析' },
  { href: '/visits/new', icon: '📝', title: '施術記録', desc: '施術内容・料金・次回予約の記録' },
  { href: '/patients/new', icon: '➕', title: '新規患者登録', desc: '新しい患者の情報を登録' },
]

export default function SalesPage() {
  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* タブ */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-2 border-b border-gray-200">
          {saleTabs.map(tab => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                tab.href === '/sales' ? 'bg-[#14252A] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {menuCards.map(card => (
            <Link key={card.href} href={card.href} className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-all hover:-translate-y-0.5 group border border-gray-100">
              <div className="flex items-start gap-4">
                <div className="text-3xl bg-gray-50 rounded-xl w-14 h-14 flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">{card.icon}</div>
                <div>
                  <h3 className="font-bold text-gray-800 text-base">{card.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{card.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
