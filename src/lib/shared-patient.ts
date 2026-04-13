/**
 * 共通患者検索・作成ライブラリ
 * 各アプリのAPIルートからインポートして使用
 *
 * 使い方:
 * 1. このファイルを各アプリの src/lib/shared-patient.ts にコピー
 * 2. APIルートから import { findOrCreatePatient, searchPatientCandidates } from '@/lib/shared-patient'
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface PatientInput {
  name: string
  furigana?: string
  phone?: string
  birth_date?: string | null
  gender?: string
  email?: string
  zipcode?: string
  prefecture?: string
  city?: string
  address?: string
  building?: string
  occupation?: string
  referral_source?: string
  chief_complaint?: string
  medical_history?: string
}

export interface FindOrCreateResult {
  patient_id: string | null
  is_new: boolean
  match_type: 'phone_exact' | 'birthdate_name' | 'name_furigana' | 'no_match' | 'created' | 'phone_conflict_resolved'
}

export interface PatientCandidate {
  patient_id: string
  name: string
  furigana: string | null
  phone: string | null
  birth_date: string | null
  confidence: number  // 0-100
  match_reason: string
}

/**
 * DB関数 find_or_create_patient を呼び出す
 * DB関数がない場合はアプリ側でフォールバック処理
 */
export async function findOrCreatePatient(
  supabase: SupabaseClient,
  clinicId: string,
  input: PatientInput,
  autoCreate: boolean = true
): Promise<FindOrCreateResult> {
  // まずDB関数を試行
  try {
    const { data, error } = await supabase.rpc('find_or_create_patient', {
      p_clinic_id: clinicId,
      p_name: input.name,
      p_furigana: input.furigana || '',
      p_phone: input.phone || '',
      p_birth_date: input.birth_date || null,
      p_gender: input.gender || '男性',
      p_email: input.email || '',
      p_zipcode: input.zipcode || '',
      p_prefecture: input.prefecture || '',
      p_city: input.city || '',
      p_address: input.address || '',
      p_building: input.building || '',
      p_occupation: input.occupation || '',
      p_referral_source: input.referral_source || '',
      p_chief_complaint: input.chief_complaint || '',
      p_medical_history: input.medical_history || '',
      p_auto_create: autoCreate,
    })

    if (!error && data) {
      return data as FindOrCreateResult
    }
  } catch {
    // DB関数がない場合、フォールバック
  }

  // フォールバック: アプリ側でマッチング
  return fallbackFindOrCreate(supabase, clinicId, input, autoCreate)
}

/**
 * DB関数がない場合のフォールバック実装
 */
async function fallbackFindOrCreate(
  supabase: SupabaseClient,
  clinicId: string,
  input: PatientInput,
  autoCreate: boolean
): Promise<FindOrCreateResult> {
  const normalizePhone = (p: string) => p.replace(/[-\s\u3000()（）ー－]/g, '')
  const normalizeName = (n: string) => n.replace(/[\s\u3000]+/g, '')

  // ステップ1: 電話番号完全一致
  if (input.phone) {
    const phoneNorm = normalizePhone(input.phone)
    if (phoneNorm.length >= 10) {
      const { data: patients } = await supabase
        .from('cm_patients')
        .select('id, name, furigana, phone, birth_date')
        .eq('clinic_id', clinicId)

      if (patients) {
        // 電話番号完全一致
        for (const p of patients) {
          if (p.phone && normalizePhone(p.phone) === phoneNorm) {
            return { patient_id: p.id, is_new: false, match_type: 'phone_exact' }
          }
        }

        // 生年月日+名前一致
        if (input.birth_date && input.name) {
          for (const p of patients) {
            if (p.birth_date === input.birth_date && normalizeName(p.name) === normalizeName(input.name)) {
              return { patient_id: p.id, is_new: false, match_type: 'birthdate_name' }
            }
          }
        }

        // 名前+ふりがな一致
        if (input.name && input.furigana) {
          for (const p of patients) {
            if (
              normalizeName(p.name) === normalizeName(input.name) &&
              p.furigana && normalizeName(p.furigana) === normalizeName(input.furigana)
            ) {
              return { patient_id: p.id, is_new: false, match_type: 'name_furigana' }
            }
          }
        }
      }
    }
  }

  if (!autoCreate) {
    return { patient_id: null, is_new: false, match_type: 'no_match' }
  }

  // 新規作成: patient_number はDBトリガー(006_auto_patient_number)に任せる
  const { data: newPatient } = await supabase
    .from('cm_patients')
    .insert({
      clinic_id: clinicId,
      name: input.name || '',
      furigana: input.furigana || '',
      birth_date: input.birth_date || null,
      gender: input.gender || '男性',
      phone: input.phone || '',
      email: input.email || '',
      zipcode: input.zipcode || '',
      prefecture: input.prefecture || '',
      city: input.city || '',
      address: input.address || '',
      building: input.building || '',
      occupation: input.occupation || '',
      referral_source: input.referral_source || '',
      chief_complaint: input.chief_complaint || '',
      medical_history: input.medical_history || '',
      notes: '',
      status: 'active',
    })
    .select('id')
    .single()

  if (newPatient) {
    return { patient_id: newPatient.id, is_new: true, match_type: 'created' }
  }

  return { patient_id: null, is_new: false, match_type: 'no_match' }
}

/**
 * 患者候補検索（手動確認UI用）
 * DB関数 search_patient_candidates を呼び出す
 */
export async function searchPatientCandidates(
  supabase: SupabaseClient,
  clinicId: string,
  input: { name?: string; furigana?: string; phone?: string; birth_date?: string | null }
): Promise<PatientCandidate[]> {
  try {
    const { data, error } = await supabase.rpc('search_patient_candidates', {
      p_clinic_id: clinicId,
      p_name: input.name || '',
      p_furigana: input.furigana || '',
      p_phone: input.phone || '',
      p_birth_date: input.birth_date || null,
    })

    if (!error && data) {
      return data as PatientCandidate[]
    }
  } catch {
    // DB関数がない場合フォールバック
  }

  // フォールバック: 名前でILIKE検索
  if (!input.name && !input.phone) return []

  const { data: patients } = await supabase
    .from('cm_patients')
    .select('id, name, furigana, phone, birth_date')
    .eq('clinic_id', clinicId)
    .or(`name.ilike.%${input.name || ''}%,furigana.ilike.%${input.furigana || ''}%`)
    .limit(10)

  if (!patients) return []

  return patients.map(p => ({
    patient_id: p.id,
    name: p.name,
    furigana: p.furigana,
    phone: p.phone,
    birth_date: p.birth_date,
    confidence: 40,
    match_reason: '名前部分一致',
  }))
}
