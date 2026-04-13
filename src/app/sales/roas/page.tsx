'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/client'
import { saleTabs } from '@/lib/saleTabs'
import { fetchAllSlips } from '@/lib/fetchAll'
import { getClinicId } from '@/lib/clinic'

/* ---------- types ---------- */
interface ChannelRow {
  channel: string
  cost: number
  revenue: number
  patientCount: number
  totalLtv: number
  avgLtv: number
  roas: number
  new_patients: number
  cpa: number
}

interface DimensionRow {
  label: string
  patientCount: number
  totalLtv: number
  avgLtv: number
  cost: number
  roas: number
}

interface CrossCell {
  patientCount: number
  totalLtv: number
  avgLtv: number
  cost: number
  roas: number
}

type TabKey = 'channel' | 'motive' | 'symptom' | 'cross'
type PeriodKey = 'all' | '1m' | '3m' | '6m' | '1y' | 'custom'

/* ---------- helpers ---------- */
function getDateRange(period: PeriodKey, customFrom: string, customTo: string) {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const to = fmt(today)
  switch (period) {
    case '1m': { const d = new Date(today); d.setMonth(d.getMonth() - 1); return { from: fmt(d), to } }
    case '3m': { const d = new Date(today); d.setMonth(d.getMonth() - 3); return { from: fmt(d), to } }
    case '6m': { const d = new Date(today); d.setMonth(d.getMonth() - 6); return { from: fmt(d), to } }
    case '1y': { const d = new Date(today); d.setFullYear(d.getFullYear() - 1); return { from: fmt(d), to } }
    case 'custom': return { from: customFrom || null, to: customTo || to }
    default: return { from: null, to: null }
  }
}

function roasBg(roas: number): string {
  if (roas >= 200) return 'bg-green-50'
  if (roas >= 100) return 'bg-green-50/50'
  if (roas > 0) return 'bg-red-50/50'
  return ''
}

function roasColor(roas: number): string {
  if (roas >= 100) return 'text-green-600'
  if (roas > 0) return 'text-red-500'
  return 'text-gray-400'
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const bom = '\uFEFF'
  const csv = bom + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function mapSourceToChannel(source: string): string {
  const mapping: Record<string, string> = {
    'Google検索': 'SEO(自然検索)', 'Googleマップ': 'Googleマップ(MEO)',
    'Instagram': 'Instagram広告', 'YouTube': 'その他',
    'チラシ': 'チラシ', '紹介': '紹介', 'LINE': 'LINE広告', '通りがかり': 'その他',
  }
  return mapping[source] || source
}

/* ========== component ========== */
export default function RoasPage() {
  const supabase = createClient()
  const clinicId = getClinicId()

  const [tab, setTab] = useState<TabKey>('channel')
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [loading, setLoading] = useState(true)

  // raw data
  const [channelRows, setChannelRows] = useState<ChannelRow[]>([])
  const [motiveRows, setMotiveRows] = useState<DimensionRow[]>([])
  const [symptomRows, setSymptomRows] = useState<DimensionRow[]>([])
  const [crossData, setCrossData] = useState<Record<string, Record<string, CrossCell>>>({})
  const [crossChannels, setCrossChannels] = useState<string[]>([])
  const [crossMotives, setCrossMotives] = useState<string[]>([])
  const [totalCost, setTotalCost] = useState(0)
  const [totalNewRevenue, setTotalNewRevenue] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)

  /* ---------- data load ---------- */
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { from, to } = getDateRange(period, customFrom, customTo)

      // 広告費の月レンジ
      const startMonth = from ? from.slice(0, 7) : '2000-01'
      const endMonth = to ? to.slice(0, 7) : '2099-12'

      const [
        { data: adCosts },
        allSlips,
        { data: visitMotivesMaster },
        { data: symptomsMaster },
      ] = await Promise.all([
        supabase.from('cm_ad_costs').select('*').eq('clinic_id', clinicId)
          .gte('month', startMonth).lte('month', endMonth),
        fetchAllSlips(supabase, 'patient_id, total_price, visit_date') as Promise<{ patient_id: string; total_price: number; visit_date: string }[]>,
        supabase.from('cm_visit_motives').select('name').eq('clinic_id', clinicId).eq('is_active', true).order('sort_order'),
        supabase.from('cm_symptoms').select('name').eq('clinic_id', clinicId).eq('is_active', true).order('sort_order'),
      ])

      const motiveNames = (visitMotivesMaster || []).map(m => m.name)
      const symptomNames = (symptomsMaster || []).map(s => s.name)

      if (!allSlips || allSlips.length === 0) {
        setChannelRows([]); setMotiveRows([]); setSymptomRows([])
        setCrossData({}); setCrossChannels([]); setCrossMotives([])
        setTotalCost(0); setTotalNewRevenue(0); setTotalRevenue(0)
        setLoading(false); return
      }

      // period filter on slips
      const periodSlips = allSlips.filter(s => {
        if (from && s.visit_date < from) return false
        if (to && s.visit_date > to) return false
        return true
      })

      const patientIds = [...new Set(periodSlips.map(s => s.patient_id).filter(Boolean))]

      // first visit date for new/existing判定 + patient attributes
      const [allSlipsForFirst, { data: patientsData }] = await Promise.all([
        fetchAllSlips(supabase, 'patient_id, visit_date') as Promise<{ patient_id: string; visit_date: string }[]>,
        supabase.from('cm_patients')
          .select('id, referral_source, visit_motive, chief_complaint, ltv')
          .eq('clinic_id', clinicId)
          .in('id', patientIds.length > 0 ? patientIds : ['__none__']),
      ])

      const firstVisitDate: Record<string, string> = {}
      allSlipsForFirst.forEach(s => {
        if (s.patient_id && (!firstVisitDate[s.patient_id] || s.visit_date < firstVisitDate[s.patient_id])) {
          firstVisitDate[s.patient_id] = s.visit_date
        }
      })

      // patient maps
      const pSource: Record<string, string> = {}
      const pMotive: Record<string, string> = {}
      const pSymptom: Record<string, string> = {}
      const pLtv: Record<string, number> = {}
      patientsData?.forEach(p => {
        pSource[p.id] = p.referral_source || 'その他'
        pMotive[p.id] = p.visit_motive || '（未設定）'
        pSymptom[p.id] = p.chief_complaint || '（未設定）'
        pLtv[p.id] = p.ltv || 0
      })

      // aggregate slips
      let newRev = 0, allRev = 0
      const chRevenue: Record<string, number> = {}
      const chPatients: Record<string, Set<string>> = {}

      periodSlips.forEach(s => {
        const amt = s.total_price || 0
        allRev += amt
        const pid = s.patient_id
        if (!pid) return
        const isNew = firstVisitDate[pid] && (!from || firstVisitDate[pid] >= from) && (!to || firstVisitDate[pid] <= to)
        const ch = mapSourceToChannel(pSource[pid] || 'その他')
        if (isNew) {
          newRev += amt
          chRevenue[ch] = (chRevenue[ch] || 0) + amt
          if (!chPatients[ch]) chPatients[ch] = new Set()
          chPatients[ch].add(pid)
        }
      })

      setTotalNewRevenue(newRev)
      setTotalRevenue(allRev)

      // ad cost by channel
      const adCostByChannel: Record<string, number> = {}
      let costTotal = 0
      const adNewPatientsByChannel: Record<string, number> = {}
      if (adCosts) {
        adCosts.forEach(ac => {
          adCostByChannel[ac.channel] = (adCostByChannel[ac.channel] || 0) + (ac.cost || 0)
          adNewPatientsByChannel[ac.channel] = (adNewPatientsByChannel[ac.channel] || 0) + (ac.new_patients || 0)
          costTotal += ac.cost || 0
        })
      }
      setTotalCost(costTotal)

      // ① channel rows
      const allChannelNames = new Set([...Object.keys(adCostByChannel), ...Object.keys(chRevenue)])
      const chRows: ChannelRow[] = [...allChannelNames].map(ch => {
        const cost = adCostByChannel[ch] || 0
        const revenue = chRevenue[ch] || 0
        const pids = chPatients[ch] || new Set<string>()
        const patientCount = pids.size
        let ltvSum = 0
        pids.forEach(pid => { ltvSum += pLtv[pid] || 0 })
        const np = adNewPatientsByChannel[ch] || 0
        return {
          channel: ch, cost, revenue, patientCount, totalLtv: ltvSum,
          avgLtv: patientCount > 0 ? Math.round(ltvSum / patientCount) : 0,
          roas: cost > 0 ? Math.round((revenue / cost) * 100) : 0,
          new_patients: np,
          cpa: np > 0 ? Math.round(cost / np) : 0,
        }
      }).sort((a, b) => b.revenue - a.revenue)
      setChannelRows(chRows)

      // ② motive rows
      const motiveMap: Record<string, { pids: Set<string>; ltv: number }> = {}
      patientsData?.forEach(p => {
        const mv = p.visit_motive || '（未設定）'
        if (!motiveMap[mv]) motiveMap[mv] = { pids: new Set(), ltv: 0 }
        motiveMap[mv].pids.add(p.id)
        motiveMap[mv].ltv += p.ltv || 0
      })
      const mvRows: DimensionRow[] = [...new Set([...motiveNames, ...Object.keys(motiveMap)])]
        .map(label => {
          const d = motiveMap[label] || { pids: new Set(), ltv: 0 }
          const pc = d.pids.size
          return {
            label, patientCount: pc, totalLtv: d.ltv,
            avgLtv: pc > 0 ? Math.round(d.ltv / pc) : 0,
            cost: 0, roas: 0,
          }
        })
        .filter(r => r.patientCount > 0)
        .sort((a, b) => b.totalLtv - a.totalLtv)
      // distribute total ad cost by patient count proportion
      const totalPatForMotive = mvRows.reduce((s, r) => s + r.patientCount, 0)
      mvRows.forEach(r => {
        r.cost = totalPatForMotive > 0 ? Math.round(costTotal * (r.patientCount / totalPatForMotive)) : 0
        r.roas = r.cost > 0 ? Math.round((r.totalLtv / r.cost) * 100) : 0
      })
      setMotiveRows(mvRows)

      // ③ symptom rows
      const symptomMap: Record<string, { pids: Set<string>; ltv: number }> = {}
      patientsData?.forEach(p => {
        const sym = p.chief_complaint || '（未設定）'
        if (!symptomMap[sym]) symptomMap[sym] = { pids: new Set(), ltv: 0 }
        symptomMap[sym].pids.add(p.id)
        symptomMap[sym].ltv += p.ltv || 0
      })
      const symRows: DimensionRow[] = [...new Set([...symptomNames, ...Object.keys(symptomMap)])]
        .map(label => {
          const d = symptomMap[label] || { pids: new Set(), ltv: 0 }
          const pc = d.pids.size
          return {
            label, patientCount: pc, totalLtv: d.ltv,
            avgLtv: pc > 0 ? Math.round(d.ltv / pc) : 0,
            cost: 0, roas: 0,
          }
        })
        .filter(r => r.patientCount > 0)
        .sort((a, b) => b.totalLtv - a.totalLtv)
      const totalPatForSym = symRows.reduce((s, r) => s + r.patientCount, 0)
      symRows.forEach(r => {
        r.cost = totalPatForSym > 0 ? Math.round(costTotal * (r.patientCount / totalPatForSym)) : 0
        r.roas = r.cost > 0 ? Math.round((r.totalLtv / r.cost) * 100) : 0
      })
      setSymptomRows(symRows)

      // ④ cross: channel × motive
      const usedCh = chRows.map(r => r.channel)
      const usedMv = mvRows.map(r => r.label)
      setCrossChannels(usedCh)
      setCrossMotives(usedMv)

      const cross: Record<string, Record<string, CrossCell>> = {}
      usedCh.forEach(ch => {
        cross[ch] = {}
        usedMv.forEach(mv => {
          cross[ch][mv] = { patientCount: 0, totalLtv: 0, avgLtv: 0, cost: 0, roas: 0 }
        })
      })
      patientsData?.forEach(p => {
        const ch = mapSourceToChannel(p.referral_source || 'その他')
        const mv = p.visit_motive || '（未設定）'
        if (!cross[ch]) return
        if (!cross[ch][mv]) cross[ch][mv] = { patientCount: 0, totalLtv: 0, avgLtv: 0, cost: 0, roas: 0 }
        cross[ch][mv].patientCount++
        cross[ch][mv].totalLtv += p.ltv || 0
      })
      usedCh.forEach(ch => {
        const chCost = adCostByChannel[ch] || 0
        const totalPats = Object.values(cross[ch]).reduce((s, c) => s + c.patientCount, 0)
        Object.keys(cross[ch]).forEach(mv => {
          const cell = cross[ch][mv]
          cell.avgLtv = cell.patientCount > 0 ? Math.round(cell.totalLtv / cell.patientCount) : 0
          cell.cost = totalPats > 0 ? Math.round(chCost * (cell.patientCount / totalPats)) : 0
          cell.roas = cell.cost > 0 ? Math.round((cell.totalLtv / cell.cost) * 100) : 0
        })
      })
      setCrossData(cross)
      setLoading(false)
    }
    load()
  }, [period, customFrom, customTo])

  /* ---------- derived ---------- */
  const overallRoas = totalCost > 0 ? Math.round((totalRevenue / totalCost) * 100) : 0

  const bestChannel = useMemo(() => {
    const withCost = channelRows.filter(c => c.cost > 0)
    if (withCost.length === 0) return null
    return withCost.reduce((best, c) => c.roas > best.roas ? c : best)
  }, [channelRows])

  const periodLabel = useMemo(() => {
    const { from, to } = getDateRange(period, customFrom, customTo)
    if (!from) return '全期間'
    return `${from} 〜 ${to}`
  }, [period, customFrom, customTo])

  /* ---------- CSV exports ---------- */
  const exportChannelCsv = useCallback(() => {
    downloadCsv(`ROAS_媒体別_${periodLabel}.csv`,
      ['広告媒体', '広告費', '売上', 'ROAS(%)', '患者数', '平均LTV', 'CPA', '新規数'],
      channelRows.map(c => [c.channel, String(c.cost), String(c.revenue), String(c.roas), String(c.patientCount), String(c.avgLtv), String(c.cpa), String(c.new_patients)])
    )
  }, [channelRows, periodLabel])

  const exportMotiveCsv = useCallback(() => {
    downloadCsv(`ROAS_来院動機別_${periodLabel}.csv`,
      ['来院動機', '患者数', '総LTV', '平均LTV', '広告費(按分)', 'ROAS(%)'],
      motiveRows.map(r => [r.label, String(r.patientCount), String(r.totalLtv), String(r.avgLtv), String(r.cost), String(r.roas)])
    )
  }, [motiveRows, periodLabel])

  const exportSymptomCsv = useCallback(() => {
    downloadCsv(`ROAS_症状別_${periodLabel}.csv`,
      ['症状', '患者数', '総LTV', '平均LTV', '広告費(按分)', 'ROAS(%)'],
      symptomRows.map(r => [r.label, String(r.patientCount), String(r.totalLtv), String(r.avgLtv), String(r.cost), String(r.roas)])
    )
  }, [symptomRows, periodLabel])

  const exportCrossCsv = useCallback(() => {
    const headers = ['媒体', ...crossMotives.flatMap(mv => [`${mv}_患者数`, `${mv}_平均LTV`, `${mv}_ROAS`])]
    const rows = crossChannels.map(ch => [
      ch,
      ...crossMotives.flatMap(mv => {
        const c = crossData[ch]?.[mv]
        return c ? [String(c.patientCount), String(c.avgLtv), String(c.roas)] : ['0', '0', '0']
      }),
    ])
    downloadCsv(`ROAS_媒体x動機_${periodLabel}.csv`, headers, rows)
  }, [crossData, crossChannels, crossMotives, periodLabel])

  /* ---------- shared UI pieces ---------- */
  const CsvButton = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick}
      className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
      CSV出力
    </button>
  )

  const EmptyState = () => (
    <div className="bg-white rounded-xl shadow-sm p-8 text-center">
      <p className="text-gray-400 mb-3">データがありません</p>
      <Link href="/sales/ad-costs" className="text-blue-600 text-sm hover:underline">
        広告費入力ページで登録してください →
      </Link>
    </div>
  )

  /* ---------- render ---------- */
  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* sale tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2 border-b">
          {saleTabs.map(t => (
            <Link key={t.href} href={t.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                t.href === '/sales/roas' ? 'bg-[#14252A] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}>{t.label}</Link>
          ))}
        </div>

        <h2 className="font-bold text-gray-800 text-lg mb-3">ROAS・広告分析</h2>

        {/* period filter */}
        <div className="bg-white rounded-xl shadow-sm p-3 mb-4">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-gray-500 mr-1">期間:</span>
            {([
              { key: 'all' as PeriodKey, label: '全期間' },
              { key: '1m' as PeriodKey, label: '1ヶ月' },
              { key: '3m' as PeriodKey, label: '3ヶ月' },
              { key: '6m' as PeriodKey, label: '6ヶ月' },
              { key: '1y' as PeriodKey, label: '1年' },
              { key: 'custom' as PeriodKey, label: 'カスタム' },
            ]).map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  period === p.key ? 'bg-[#14252A] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>{p.label}</button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex gap-2 mt-2 items-center">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
              <span className="text-xs text-gray-400">〜</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>
          )}
          {period !== 'all' && <p className="text-xs text-gray-400 mt-1.5">{periodLabel}</p>}
        </div>

        {/* summary cards */}
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

        {/* best channel highlight */}
        {bestChannel && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3 mb-4 flex items-center gap-3">
            <span className="text-2xl">★</span>
            <div>
              <p className="text-xs text-green-700 font-medium">最もROASが高い媒体</p>
              <p className="font-bold text-green-800">
                {bestChannel.channel}
                <span className="ml-2 text-sm">ROAS {bestChannel.roas}%</span>
                <span className="ml-2 text-xs text-green-600">（広告費{bestChannel.cost.toLocaleString()}円 → 売上{bestChannel.revenue.toLocaleString()}円）</span>
              </p>
            </div>
          </div>
        )}

        {/* tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {([
            { key: 'channel' as TabKey, label: '媒体別ROAS' },
            { key: 'motive' as TabKey, label: '来院動機別' },
            { key: 'symptom' as TabKey, label: '症状別' },
            { key: 'cross' as TabKey, label: '媒体×動機' },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                tab === t.key ? 'bg-[#14252A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-32 bg-gray-200 rounded mx-auto" />
              <div className="h-48 bg-gray-100 rounded" />
            </div>
          </div>
        ) : tab === 'channel' ? (
          /* ========== TAB 1: 媒体別ROAS ========== */
          channelRows.length === 0 ? <EmptyState /> : (
            <>
            <div className="flex justify-end mb-2"><CsvButton onClick={exportChannelCsv} /></div>

            {/* mobile */}
            <div className="sm:hidden space-y-3">
              {channelRows.map(c => {
                const isBest = bestChannel?.channel === c.channel
                return (
                  <div key={c.channel} className={`bg-white rounded-xl shadow-sm p-3 ${isBest ? 'ring-2 ring-green-400' : ''} ${roasBg(c.roas)}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-sm flex items-center gap-1">
                        {isBest && <span className="text-green-500">★</span>}{c.channel}
                      </span>
                      <span className={`font-bold text-sm ${roasColor(c.roas)}`}>ROAS {c.roas}%</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-gray-500">広告費</span><span>{c.cost.toLocaleString()}円</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">売上</span><span>{c.revenue.toLocaleString()}円</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">患者数</span><span>{c.patientCount}人</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">平均LTV</span><span>{c.avgLtv.toLocaleString()}円</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">CPA</span><span>{c.cpa > 0 ? c.cpa.toLocaleString() + '円' : '-'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">新規</span><span>{c.new_patients}人</span></div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* desktop */}
            <div className="hidden sm:block bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-3 py-2 text-xs text-gray-500">広告媒体</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">広告費</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">売上</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">ROAS</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">患者数</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">平均LTV</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">CPA</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">新規</th>
                  </tr>
                </thead>
                <tbody>
                  {channelRows.map(c => {
                    const isBest = bestChannel?.channel === c.channel
                    return (
                      <tr key={c.channel} className={`border-b hover:bg-gray-50 ${isBest ? 'bg-green-50' : roasBg(c.roas)}`}>
                        <td className="px-3 py-2 font-medium">
                          {isBest && <span className="text-green-500 mr-1">★</span>}{c.channel}
                        </td>
                        <td className="px-3 py-2 text-right text-red-600">{c.cost.toLocaleString()}円</td>
                        <td className="px-3 py-2 text-right font-medium">{c.revenue.toLocaleString()}円</td>
                        <td className="px-3 py-2 text-right"><span className={`font-bold ${roasColor(c.roas)}`}>{c.roas}%</span></td>
                        <td className="px-3 py-2 text-right">{c.patientCount}人</td>
                        <td className="px-3 py-2 text-right">{c.avgLtv > 0 ? c.avgLtv.toLocaleString() + '円' : '-'}</td>
                        <td className="px-3 py-2 text-right">{c.cpa > 0 ? c.cpa.toLocaleString() + '円' : '-'}</td>
                        <td className="px-3 py-2 text-right">{c.new_patients}人</td>
                      </tr>
                    )
                  })}
                  <tr className="bg-gray-50 font-bold">
                    <td className="px-3 py-2">合計</td>
                    <td className="px-3 py-2 text-right text-red-600">{totalCost.toLocaleString()}円</td>
                    <td className="px-3 py-2 text-right">{totalRevenue.toLocaleString()}円</td>
                    <td className="px-3 py-2 text-right"><span className={roasColor(overallRoas)}>{overallRoas}%</span></td>
                    <td className="px-3 py-2 text-right">{channelRows.reduce((s, c) => s + c.patientCount, 0)}人</td>
                    <td className="px-3 py-2" colSpan={3}></td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
            </>
          )

        ) : tab === 'motive' ? (
          /* ========== TAB 2: 来院動機別ROAS ========== */
          motiveRows.length === 0 ? <EmptyState /> : (
            <>
            <div className="flex justify-end mb-2"><CsvButton onClick={exportMotiveCsv} /></div>
            <DimensionTable rows={motiveRows} labelHeader="来院動機" totalCost={totalCost} />
            </>
          )

        ) : tab === 'symptom' ? (
          /* ========== TAB 3: 症状別ROAS ========== */
          symptomRows.length === 0 ? <EmptyState /> : (
            <>
            <div className="flex justify-end mb-2"><CsvButton onClick={exportSymptomCsv} /></div>
            <DimensionTable rows={symptomRows} labelHeader="症状" totalCost={totalCost} />
            </>
          )

        ) : (
          /* ========== TAB 4: 媒体×動機クロス ========== */
          crossChannels.length === 0 ? <EmptyState /> : (
            <>
            <div className="flex justify-end mb-2"><CsvButton onClick={exportCrossCsv} /></div>

            {/* mobile */}
            <div className="sm:hidden space-y-4">
              {crossChannels.map(ch => {
                const activeMvs = crossMotives.filter(mv => crossData[ch]?.[mv]?.patientCount > 0)
                return (
                  <div key={ch} className="bg-white rounded-xl shadow-sm p-3">
                    <h4 className="font-bold text-sm mb-2 pb-2 border-b" style={{ color: '#14252A' }}>{ch}</h4>
                    {activeMvs.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">該当患者なし</p>
                    ) : (
                      <div className="space-y-2">
                        {activeMvs.map(mv => {
                          const cell = crossData[ch][mv]
                          return (
                            <div key={mv} className={`rounded-lg p-2 ${roasBg(cell.roas)}`}>
                              <p className="text-xs font-medium text-gray-700 mb-1">{mv}</p>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                                <div className="flex justify-between"><span className="text-gray-500">患者数</span><span>{cell.patientCount}人</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">平均LTV</span><span>{cell.avgLtv.toLocaleString()}円</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">総LTV</span><span>{cell.totalLtv.toLocaleString()}円</span></div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">ROAS</span>
                                  <span className={`font-bold ${roasColor(cell.roas)}`}>{cell.cost > 0 ? cell.roas + '%' : '-'}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* desktop */}
            <div className="hidden sm:block bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-2 py-2 text-gray-500 sticky left-0 bg-gray-50 min-w-[100px] z-10">媒体 ＼ 来院動機</th>
                    {crossMotives.map(mv => (
                      <th key={mv} className="text-center px-2 py-2 text-gray-500 min-w-[120px]">{mv}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {crossChannels.map(ch => (
                    <tr key={ch} className="border-b hover:bg-gray-50">
                      <td className="px-2 py-2 font-medium sticky left-0 bg-white z-10" style={{ color: '#14252A' }}>{ch}</td>
                      {crossMotives.map(mv => {
                        const cell = crossData[ch]?.[mv]
                        if (!cell || cell.patientCount === 0) {
                          return <td key={mv} className="px-2 py-2 text-center text-gray-300">-</td>
                        }
                        return (
                          <td key={mv} className={`px-2 py-2 ${roasBg(cell.roas)}`}>
                            <div className="text-center space-y-0.5">
                              <p className="font-medium">{cell.patientCount}人</p>
                              <p className="text-gray-500">平均 {cell.avgLtv.toLocaleString()}円</p>
                              {cell.cost > 0 && (
                                <p className={`font-bold ${roasColor(cell.roas)}`}>ROAS {cell.roas}%</p>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
            </>
          )
        )}
      </div>
    </AppShell>
  )
}

/* ---------- shared dimension table ---------- */
function DimensionTable({ rows, labelHeader, totalCost }: { rows: DimensionRow[]; labelHeader: string; totalCost: number }) {
  const totalPatients = rows.reduce((s, r) => s + r.patientCount, 0)
  const totalLtv = rows.reduce((s, r) => s + r.totalLtv, 0)
  const overallRoas = totalCost > 0 ? Math.round((totalLtv / totalCost) * 100) : 0
  const bestLabel = rows.reduce((best, r) => r.roas > best.roas ? r : best, rows[0])

  return (
    <>
    {/* mobile */}
    <div className="sm:hidden space-y-2">
      {rows.map(r => {
        const isBest = r.label === bestLabel?.label && r.roas > 0
        return (
          <div key={r.label} className={`bg-white rounded-xl shadow-sm p-3 ${isBest ? 'ring-2 ring-green-400' : ''} ${roasBg(r.roas)}`}>
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-sm flex items-center gap-1">
                {isBest && <span className="text-green-500">★</span>}{r.label}
              </span>
              {r.cost > 0 && <span className={`font-bold text-xs ${roasColor(r.roas)}`}>ROAS {r.roas}%</span>}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">患者数</span><span>{r.patientCount}人</span></div>
              <div className="flex justify-between"><span className="text-gray-500">総LTV</span><span>{r.totalLtv.toLocaleString()}円</span></div>
              <div className="flex justify-between"><span className="text-gray-500">平均LTV</span><span>{r.avgLtv.toLocaleString()}円</span></div>
              <div className="flex justify-between"><span className="text-gray-500">広告費(按分)</span><span>{r.cost.toLocaleString()}円</span></div>
            </div>
          </div>
        )
      })}
    </div>

    {/* desktop */}
    <div className="hidden sm:block bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="text-left px-3 py-2 text-xs text-gray-500">{labelHeader}</th>
            <th className="text-right px-3 py-2 text-xs text-gray-500">患者数</th>
            <th className="text-right px-3 py-2 text-xs text-gray-500">総LTV</th>
            <th className="text-right px-3 py-2 text-xs text-gray-500">平均LTV</th>
            <th className="text-right px-3 py-2 text-xs text-gray-500">広告費(按分)</th>
            <th className="text-right px-3 py-2 text-xs text-gray-500">ROAS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const isBest = r.label === bestLabel?.label && r.roas > 0
            return (
              <tr key={r.label} className={`border-b hover:bg-gray-50 ${isBest ? 'bg-green-50' : roasBg(r.roas)}`}>
                <td className="px-3 py-2 font-medium">
                  {isBest && <span className="text-green-500 mr-1">★</span>}{r.label}
                </td>
                <td className="px-3 py-2 text-right">{r.patientCount}人</td>
                <td className="px-3 py-2 text-right font-medium">{r.totalLtv.toLocaleString()}円</td>
                <td className="px-3 py-2 text-right">{r.avgLtv.toLocaleString()}円</td>
                <td className="px-3 py-2 text-right text-red-600">{r.cost.toLocaleString()}円</td>
                <td className="px-3 py-2 text-right">
                  <span className={`font-bold ${roasColor(r.roas)}`}>{r.cost > 0 ? r.roas + '%' : '-'}</span>
                </td>
              </tr>
            )
          })}
          <tr className="bg-gray-50 font-bold">
            <td className="px-3 py-2">合計</td>
            <td className="px-3 py-2 text-right">{totalPatients}人</td>
            <td className="px-3 py-2 text-right">{totalLtv.toLocaleString()}円</td>
            <td className="px-3 py-2 text-right">{totalPatients > 0 ? Math.round(totalLtv / totalPatients).toLocaleString() + '円' : '-'}</td>
            <td className="px-3 py-2 text-right text-red-600">{totalCost.toLocaleString()}円</td>
            <td className="px-3 py-2 text-right"><span className={roasColor(overallRoas)}>{overallRoas}%</span></td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
    </>
  )
}
