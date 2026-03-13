'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AppShell from '@/components/AppShell'

const salesTabs = [
  { href: '/sales', label: '概要' },
  { href: '/patients', label: '顧客管理' },
  { href: '/sales/revenue', label: '売上集計' },
]

export default function SalesPage() {
  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* サブタブ */}
        <div className="flex gap-2 mb-4 border-b pb-2">
          {salesTabs.map(tab => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab.href === '/sales' ? 'bg-[#14252A] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/patients" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="text-3xl mb-2">👥</div>
            <h3 className="font-bold text-gray-800 text-lg">顧客管理</h3>
            <p className="text-sm text-gray-500 mt-1">患者の登録・検索・編集・施術履歴の管理</p>
          </Link>
          <Link href="/sales/revenue" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="text-3xl mb-2">💰</div>
            <h3 className="font-bold text-gray-800 text-lg">売上集計</h3>
            <p className="text-sm text-gray-500 mt-1">日別・月別・年別の売上分析</p>
          </Link>
          <Link href="/visits/new" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="text-3xl mb-2">📝</div>
            <h3 className="font-bold text-gray-800 text-lg">施術記録</h3>
            <p className="text-sm text-gray-500 mt-1">施術内容・料金・次回予約の記録</p>
          </Link>
          <Link href="/patients/new" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="text-3xl mb-2">➕</div>
            <h3 className="font-bold text-gray-800 text-lg">新規患者登録</h3>
            <p className="text-sm text-gray-500 mt-1">新しい患者の情報を登録</p>
          </Link>
        </div>
      </div>
    </AppShell>
  )
}
