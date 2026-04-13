'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getClinicId } from '@/lib/clinic'

export interface FilterState {
  visit_motive: string
  occupation: string
  chief_complaint: string
  gender: string
  age_group: string
}

const EMPTY_FILTER: FilterState = {
  visit_motive: '', occupation: '', chief_complaint: '', gender: '',
  age_group: '',
}

const AGE_GROUPS = ['10代', '20代', '30代', '40代', '50代', '60代', '70代', '80代以上']
const GENDERS = ['男性', '女性', 'その他']

function getAgeGroup(birthDate: string | null): string {
  if (!birthDate) return ''
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  if (age < 20) return '10代'
  if (age < 30) return '20代'
  if (age < 40) return '30代'
  if (age < 50) return '40代'
  if (age < 60) return '50代'
  if (age < 70) return '60代'
  if (age < 80) return '70代'
  return '80代以上'
}

interface MasterOptions {
  visit_motives: string[]
  occupations: string[]
  symptoms: string[]
}

interface PatientFilterProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  filteredCount?: number
  totalCount?: number
}

export function usePatientFilter() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTER)
  return { filters, setFilters }
}

export function useMasterOptions() {
  const [options, setOptions] = useState<MasterOptions>({
    visit_motives: [], occupations: [], symptoms: [],
  })

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const clinicId = getClinicId()
      const [motives, occs, syms] = await Promise.all([
        supabase.from('cm_visit_motives').select('name').eq('clinic_id', clinicId).eq('is_active', true).order('sort_order'),
        supabase.from('cm_occupations').select('name').eq('clinic_id', clinicId).eq('is_active', true).order('sort_order'),
        supabase.from('cm_symptoms').select('name').eq('clinic_id', clinicId).eq('is_active', true).order('sort_order'),
      ])
      setOptions({
        visit_motives: (motives.data || []).map(d => d.name),
        occupations: (occs.data || []).map(d => d.name),
        symptoms: (syms.data || []).map(d => d.name),
      })
    }
    load()
  }, [])

  return options
}

export interface PatientForFilter {
  id: string
  gender?: string
  birth_date?: string | null
  visit_motive?: string
  occupation?: string
  chief_complaint?: string
}

export function filterPatientIds(
  patients: PatientForFilter[],
  filters: FilterState,
): Set<string> {
  const hasFilter = Object.values(filters).some(v => v !== '')
  if (!hasFilter) return new Set(patients.map(p => p.id))

  return new Set(
    patients.filter(p => {
      if (filters.gender && p.gender !== filters.gender) return false
      if (filters.age_group && getAgeGroup(p.birth_date || null) !== filters.age_group) return false
      if (filters.visit_motive && p.visit_motive !== filters.visit_motive) return false
      if (filters.occupation && p.occupation !== filters.occupation) return false
      if (filters.chief_complaint && p.chief_complaint !== filters.chief_complaint) return false
      return true
    }).map(p => p.id)
  )
}

export function getActiveFilterLabels(filters: FilterState): string[] {
  const labels: string[] = []
  if (filters.gender) labels.push(`性別=${filters.gender}`)
  if (filters.age_group) labels.push(`年代=${filters.age_group}`)
  if (filters.visit_motive) labels.push(`来院動機=${filters.visit_motive}`)
  if (filters.occupation) labels.push(`職業=${filters.occupation}`)
  if (filters.chief_complaint) labels.push(`症状=${filters.chief_complaint}`)
  return labels
}

export default function PatientFilter({ filters, onChange, filteredCount, totalCount }: PatientFilterProps) {
  const options = useMasterOptions()
  const [open, setOpen] = useState(false)

  const hasFilter = Object.values(filters).some(v => v !== '')
  const activeLabels = getActiveFilterLabels(filters)

  const update = useCallback((key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value })
  }, [filters, onChange])

  const reset = useCallback(() => {
    onChange(EMPTY_FILTER)
  }, [onChange])

  const selectClass = "w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"

  return (
    <div className="bg-white rounded-xl shadow-sm mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">絞り込みフィルタ</span>
          {hasFilter && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
              {activeLabels.length}件適用中
            </span>
          )}
        </div>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {/* フィルタ適用中の表示 */}
      {hasFilter && !open && (
        <div className="px-4 pb-3 -mt-1">
          <div className="flex flex-wrap gap-1">
            {activeLabels.map(label => (
              <span key={label} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {label}
              </span>
            ))}
          </div>
          {filteredCount !== undefined && totalCount !== undefined && (
            <p className="text-xs text-blue-600 mt-1 font-medium">
              絞り込み中：{filteredCount}名 / {totalCount}名
            </p>
          )}
        </div>
      )}

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* 性別 */}
            <div>
              <label className="text-[10px] text-gray-500 mb-0.5 block">性別</label>
              <select value={filters.gender} onChange={e => update('gender', e.target.value)} className={selectClass}>
                <option value="">すべて</option>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* 年代 */}
            <div>
              <label className="text-[10px] text-gray-500 mb-0.5 block">年代</label>
              <select value={filters.age_group} onChange={e => update('age_group', e.target.value)} className={selectClass}>
                <option value="">すべて</option>
                {AGE_GROUPS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* 症状 */}
            <div>
              <label className="text-[10px] text-gray-500 mb-0.5 block">症状</label>
              <select value={filters.chief_complaint} onChange={e => update('chief_complaint', e.target.value)} className={selectClass}>
                <option value="">すべて</option>
                {options.symptoms.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* 来院動機 */}
            <div>
              <label className="text-[10px] text-gray-500 mb-0.5 block">来院動機</label>
              <select value={filters.visit_motive} onChange={e => update('visit_motive', e.target.value)} className={selectClass}>
                <option value="">すべて</option>
                {options.visit_motives.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            {/* 職業 */}
            <div>
              <label className="text-[10px] text-gray-500 mb-0.5 block">職業</label>
              <select value={filters.occupation} onChange={e => update('occupation', e.target.value)} className={selectClass}>
                <option value="">すべて</option>
                {options.occupations.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {hasFilter && (
            <div className="mt-3 flex items-center justify-between">
              {filteredCount !== undefined && totalCount !== undefined && (
                <p className="text-xs text-blue-600 font-medium">
                  絞り込み中：{filteredCount}名 / {totalCount}名
                </p>
              )}
              <button onClick={reset}
                className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50">
                フィルタをリセット
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
