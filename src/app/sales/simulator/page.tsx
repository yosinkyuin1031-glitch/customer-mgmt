'use client'

import { useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { saleTabs } from '@/lib/saleTabs'

export default function SimulatorPage() {
  const [patients, setPatients] = useState(80)
  const [frequency, setFrequency] = useState(1.5)
  const [price, setPrice] = useState(6000)
  const [existingRate, setExistingRate] = useState(60)

  const monthlyRevenue = patients * frequency * price
  const existingRevenue = monthlyRevenue * (existingRate / 100)
  const newRevenue = monthlyRevenue - existingRevenue
  const annualLTV = price * frequency * 12

  const goalRevenue = 1500000
  const goalAchieved = monthlyRevenue >= goalRevenue
  const existingRateOk = existingRate >= 60

  const fmt = (n: number) => {
    if (n >= 10000) {
      return (n / 10000).toFixed(1) + '万'
    }
    return n.toLocaleString()
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* タブ */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-2 border-b border-gray-200">
          {[...saleTabs, { href: '/sales/simulator', label: 'シミュレーター' }].map(tab => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                tab.href === '/sales/simulator' ? 'bg-[#14252A] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <h2 className="text-lg font-bold text-gray-800 mb-1">売上シミュレーター</h2>
        <p className="text-sm text-gray-500 mb-6">スライダーを動かして、月商目標達成に必要な数字を確認しましょう</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左: スライダー */}
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-6 border border-gray-100">
            <SliderInput
              label="月間患者数"
              value={patients}
              onChange={setPatients}
              min={10}
              max={300}
              step={1}
              unit="名"
            />
            <SliderInput
              label="月間来院頻度"
              value={frequency}
              onChange={setFrequency}
              min={0.5}
              max={5}
              step={0.1}
              unit="回/月"
              decimal={1}
            />
            <SliderInput
              label="施術単価"
              value={price}
              onChange={setPrice}
              min={1000}
              max={30000}
              step={500}
              unit="円"
            />
            <SliderInput
              label="既存患者比率"
              value={existingRate}
              onChange={setExistingRate}
              min={0}
              max={100}
              step={1}
              unit="%"
            />
          </div>

          {/* 右: 結果 */}
          <div className="space-y-4">
            {/* 月間売上 */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 text-center">
              <p className="text-sm text-gray-500 mb-1">月間売上（推計）</p>
              <p className="text-4xl font-bold text-gray-800">{fmt(monthlyRevenue)}円</p>
            </div>

            {/* 既存/新規 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 text-center">
                <p className="text-xs text-gray-500 mb-1">既存患者売上</p>
                <p className="text-2xl font-bold text-teal-600">{fmt(existingRevenue)}円</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 text-center">
                <p className="text-xs text-gray-500 mb-1">新規患者売上</p>
                <p className="text-2xl font-bold text-orange-500">{fmt(newRevenue)}円</p>
              </div>
            </div>

            {/* 年間LTV */}
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 text-center">
              <p className="text-xs text-gray-500 mb-1">年間LTV（1患者あたり）</p>
              <p className="text-2xl font-bold text-gray-800">{annualLTV.toLocaleString()}円</p>
            </div>

            {/* 目標判定 */}
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 space-y-2">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${goalAchieved ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={`text-sm ${goalAchieved ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                  月商150万円目標 {goalAchieved ? '達成' : '未達成'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${existingRateOk ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={`text-sm ${existingRateOk ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                  既存患者比率60%以上 {existingRateOk ? '達成' : '未達成'}
                </span>
              </div>
            </div>

            {/* 月商目標までの差分 */}
            {!goalAchieved && (
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <p className="text-sm font-bold text-amber-700 mb-2">目標達成に必要な改善</p>
                <div className="text-xs text-amber-600 space-y-1">
                  <p>あと <b>{fmt(goalRevenue - monthlyRevenue)}円</b> で月商150万円達成</p>
                  <p>患者数を <b>{Math.ceil(goalRevenue / (frequency * price))}名</b> にする、または</p>
                  <p>単価を <b>{Math.ceil(goalRevenue / (patients * frequency)).toLocaleString()}円</b> にする、または</p>
                  <p>来院頻度を <b>{(goalRevenue / (patients * price)).toFixed(1)}回/月</b> にする</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function SliderInput({
  label, value, onChange, min, max, step, unit, decimal,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  unit: string
  decimal?: number
}) {
  const pct = ((value - min) / (max - min)) * 100
  const display = decimal !== undefined ? value.toFixed(decimal) : value.toLocaleString()

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-700 font-medium">{label}</span>
        <span className="text-sm font-bold text-gray-800">{display}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #14252A ${pct}%, #e5e7eb ${pct}%)`,
        }}
      />
    </div>
  )
}
