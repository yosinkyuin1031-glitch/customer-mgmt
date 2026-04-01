import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClinicIdServer } from '@/lib/clinic-server'

/**
 * 全患者のvisit_count, ltv, first_visit_date, last_visit_dateを
 * cm_slipsの実データから再計算して一括更新するAPI
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const clinicId = await getClinicIdServer()

    // 全患者を取得
    const { data: patients } = await supabase
      .from('cm_patients')
      .select('id')
      .eq('clinic_id', clinicId)

    if (!patients || patients.length === 0) {
      return NextResponse.json({ message: '患者データがありません', updated: 0 })
    }

    // 全来院記録を取得
    const { data: allSlips } = await supabase
      .from('cm_slips')
      .select('patient_id, visit_date, total_price')
      .eq('clinic_id', clinicId)
      .order('visit_date', { ascending: true })

    // 患者ごとに集計
    const statsMap: Record<string, {
      visitCount: number
      ltv: number
      firstVisitDate: string | null
      lastVisitDate: string | null
    }> = {}

    for (const p of patients) {
      statsMap[p.id] = { visitCount: 0, ltv: 0, firstVisitDate: null, lastVisitDate: null }
    }

    if (allSlips) {
      for (const s of allSlips) {
        if (!statsMap[s.patient_id]) continue
        const stat = statsMap[s.patient_id]
        stat.visitCount++
        stat.ltv += s.total_price || 0
        if (!stat.firstVisitDate) stat.firstVisitDate = s.visit_date
        stat.lastVisitDate = s.visit_date // 昇順なので最後が最新
      }
    }

    // 一括更新
    let updated = 0
    for (const [patientId, stat] of Object.entries(statsMap)) {
      const { error } = await supabase.from('cm_patients').update({
        visit_count: stat.visitCount,
        ltv: stat.ltv,
        first_visit_date: stat.firstVisitDate,
        last_visit_date: stat.lastVisitDate,
        updated_at: new Date().toISOString(),
      }).eq('id', patientId)

      if (!error) updated++
    }

    return NextResponse.json({ message: `${updated}名の患者データを更新しました`, updated })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({ error: 'データ同期に失敗しました' }, { status: 500 })
  }
}
