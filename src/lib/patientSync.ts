import { SupabaseClient } from '@supabase/supabase-js'

/**
 * 患者の来院統計を最新のcm_slipsデータから再計算して更新する
 * 来院記録の追加・削除・編集時に必ず呼ぶ
 */
export async function syncPatientStats(
  supabase: SupabaseClient,
  patientId: string,
  clinicId: string
) {
  // その患者の全来院記録を取得
  const { data: slips } = await supabase
    .from('cm_slips')
    .select('visit_date, total_price')
    .eq('patient_id', patientId)
    .eq('clinic_id', clinicId)
    .order('visit_date', { ascending: false })

  if (!slips || slips.length === 0) {
    // 来院記録なし → リセット
    await supabase.from('cm_patients').update({
      visit_count: 0,
      ltv: 0,
      last_visit_date: null,
      updated_at: new Date().toISOString(),
    }).eq('id', patientId)
    return
  }

  const visitCount = slips.length
  const ltv = slips.reduce((sum, s) => sum + (s.total_price || 0), 0)
  const lastVisitDate = slips[0].visit_date // 降順なので先頭が最新
  const firstVisitDate = slips[slips.length - 1].visit_date

  await supabase.from('cm_patients').update({
    visit_count: visitCount,
    ltv,
    last_visit_date: lastVisitDate,
    first_visit_date: firstVisitDate,
    updated_at: new Date().toISOString(),
  }).eq('id', patientId)
}
