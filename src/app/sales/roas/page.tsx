'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { saleTabs } from '@/lib/saleTabs'

interface AdChannel {
  channel: string
  cost: number
  impressions: number
  clicks: number
  inquiries: number
  new_patients: number
  conversions: number
  revenue: number
}

export default function RoasPage() {
  const supabase = createClient()
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [channelData, setChannelData] = useState<AdChannel[]>([])
  const [totalNewRevenue, setTotalNewRevenue] = useState(0)
  const [totalExistingRevenue, setTotalExistingRevenue] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const startDate = selectedMonth + '-01'
      const d = new Date(startDate)
      d.setMonth(d.getMonth() + 1)
      d.setDate(0)
      const endDate = d.toISOString().split('T')[0]

      // 広告費データ取得
      const { data: adCosts } = await supabase
        .from('cm_ad_costs')
        .select('*')
        .eq('month', selectedMonth)

      // 施術記録から売上取得（新規/既存を判別）
      const { data: visits } = await supabase
        .from('cm_visit_records')
        .select('patient_id, payment_amount, visit_number, patient:cm_patients(referral_source)')
        .gte('visit_date', startDate)
        .lte('visit_date', endDate)

      if (!visits) { setLoading(false); return }

      // 新規売上（visit_number = 1）と既存売上を計算
      let newRev = 0
      let existRev = 0
      const channelRevenue: Record<string, number> = {}

      visits.forEach((v: Record<string, unknown>) => {
        const amount = (v.payment_amount as number) || 0
        const visitNum = v.visit_number as number
        const patient = v.patient as { referral_source: string } | null
        const source = patient?.referral_source || 'その他'

        if (visitNum <= 1) {
          newRev += amount
          channelRevenue[source] = (channelRevenue[source] || 0) + amount
        } else {
          existRev += amount
        }
      })

      setTotalNewRevenue(newRev)
      setTotalExistingRevenue(existRev)

      // 広告チャネル別データを集約
      const channelMap: Record<string, AdChannel> = {}

      if (adCosts) {
        adCosts.forEach(ac => {
          if (!channelMap[ac.channel]) {
            channelMap[ac.channel] = {
              channel: ac.channel, cost: 0, impressions: 0, clicks: 0,
              inquiries: 0, new_patients: 0, conversions: 0, revenue: 0,
            }
          }
          const ch = channelMap[ac.channel]
          ch.cost += ac.cost || 0
          ch.impressions += ac.impressions || 0
          ch.clicks += ac.clicks || 0
          ch.inquiries += ac.inquiries || 0
          ch.new_patients += ac.new_patients || 0
          ch.conversions += ac.conversions || 0
        })
      }

      // 来院経路に基づく売上をマッピング
      Object.entries(channelRevenue).forEach(([source, rev]) => {
        // 来院経路名と広告チャネル名のマッピング
        const channelName = mapSourceToChannel(source)
        if (channelMap[channelName]) {
          channelMap[channelName].revenue += rev
        } else {
          channelMap[channelName] = {
            channel: channelName, cost: 0, impressions: 0, clicks: 0,
            inquiries: 0, new_patients: 0, conversions: 0, revenue: rev,
          }
        }
      })

      setChannelData(Object.values(channelMap).sort((a, b) => b.cost - a.cost))
      setLoading(false)
    }
    load()
  }, [selectedMonth])

  const totalCost = channelData.reduce((s, c) => s + c.cost, 0)
  const totalRevenue = totalNewRevenue + totalExistingRevenue
  const overallRoas = totalCost > 0 ? Math.round((totalRevenue / totalCost) * 100) : 0

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2 border-b">
          {saleTabs.map(tab => (
            <Link key={tab.href} href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                tab.href === '/sales/roas' ? 'bg-[#14252A] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >{tab.label}</Link>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h2 className="font-bold text-gray-800 text-lg">ROAS・広告分析</h2>
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm" />
        </div>

        {/* 全体ROAS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold" style={{ color: '#14252A' }}>{overallRoas}<span className="text-xs sm:text-sm">%</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">全体ROAS</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-red-600">{totalCost.toLocaleString()}<span className="text-xs sm:text-sm">円</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">広告費合計</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-blue-600">{totalNewRevenue.toLocaleString()}<span className="text-xs sm:text-sm">円</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">新規売上</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-2 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-green-600">{totalRevenue.toLocaleString()}<span className="text-xs sm:text-sm">円</span></p>
            <p className="text-[10px] sm:text-xs text-gray-500">総売上</p>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">読み込み中...</p>
        ) : channelData.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-gray-400 mb-3">広告費データがありません</p>
            <Link href="/sales/ad-costs" className="text-blue-600 text-sm hover:underline">
              広告費入力ページで登録してください →
            </Link>
          </div>
        ) : (
          <>
          {/* モバイル: カード表示 */}
          <div className="sm:hidden space-y-3">
            {channelData.map(c => {
              const roas = c.cost > 0 ? Math.round((c.revenue / c.cost) * 100) : 0
              const cpa = c.new_patients > 0 ? Math.round(c.cost / c.new_patients) : 0
              const cpo = c.conversions > 0 ? Math.round(c.cost / c.conversions) : 0
              const responseRate = c.impressions > 0 ? (c.clicks / c.impressions * 100).toFixed(1) : '0'
              const cvRate = c.clicks > 0 ? (c.conversions / c.clicks * 100).toFixed(1) : '0'
              return (
                <div key={c.channel} className="bg-white rounded-xl shadow-sm p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-sm">{c.channel}</span>
                    <span className={`font-bold text-sm ${roas >= 100 ? 'text-green-600' : 'text-red-500'}`}>
                      ROAS {roas}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">広告費</span><span>{c.cost.toLocaleString()}円</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">売上</span><span>{c.revenue.toLocaleString()}円</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">CPA</span><span>{cpa.toLocaleString()}円</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">CPO</span><span>{cpo.toLocaleString()}円</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">反応率</span><span>{responseRate}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">CV率</span><span>{cvRate}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">新規</span><span>{c.new_patients}人</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">CV数</span><span>{c.conversions}件</span></div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* PC: テーブル表示 */}
          <div className="hidden sm:block bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 text-xs text-gray-500">広告媒体</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">広告費</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">売上</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">ROAS</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">CPA</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">CPO</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">反応率</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">CV率</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500">新規</th>
                </tr>
              </thead>
              <tbody>
                {channelData.map(c => {
                  const roas = c.cost > 0 ? Math.round((c.revenue / c.cost) * 100) : 0
                  const cpa = c.new_patients > 0 ? Math.round(c.cost / c.new_patients) : 0
                  const cpo = c.conversions > 0 ? Math.round(c.cost / c.conversions) : 0
                  const responseRate = c.impressions > 0 ? (c.clicks / c.impressions * 100).toFixed(1) : '-'
                  const cvRate = c.clicks > 0 ? (c.conversions / c.clicks * 100).toFixed(1) : '-'
                  return (
                    <tr key={c.channel} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{c.channel}</td>
                      <td className="px-3 py-2 text-right text-red-600">{c.cost.toLocaleString()}円</td>
                      <td className="px-3 py-2 text-right font-medium">{c.revenue.toLocaleString()}円</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`font-bold ${roas >= 100 ? 'text-green-600' : 'text-red-500'}`}>{roas}%</span>
                      </td>
                      <td className="px-3 py-2 text-right">{cpa > 0 ? cpa.toLocaleString() + '円' : '-'}</td>
                      <td className="px-3 py-2 text-right">{cpo > 0 ? cpo.toLocaleString() + '円' : '-'}</td>
                      <td className="px-3 py-2 text-right">{responseRate}%</td>
                      <td className="px-3 py-2 text-right">{cvRate}%</td>
                      <td className="px-3 py-2 text-right">{c.new_patients}人</td>
                    </tr>
                  )
                })}
                <tr className="bg-gray-50 font-bold">
                  <td className="px-3 py-2">合計</td>
                  <td className="px-3 py-2 text-right text-red-600">{totalCost.toLocaleString()}円</td>
                  <td className="px-3 py-2 text-right">{totalRevenue.toLocaleString()}円</td>
                  <td className="px-3 py-2 text-right">
                    <span className={overallRoas >= 100 ? 'text-green-600' : 'text-red-500'}>{overallRoas}%</span>
                  </td>
                  <td className="px-3 py-2" colSpan={5}></td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
          </>
        )}
      </div>
    </AppShell>
  )
}

function mapSourceToChannel(source: string): string {
  const mapping: Record<string, string> = {
    'Google検索': 'SEO(自然検索)',
    'Googleマップ': 'Googleマップ(MEO)',
    'Instagram': 'Instagram広告',
    'YouTube': 'その他',
    'チラシ': 'チラシ',
    '紹介': '紹介',
    'LINE': 'LINE広告',
    '通りがかり': 'その他',
  }
  return mapping[source] || source
}
