import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const supabase = await createClient()

  // ログインユーザー確認
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 })
  }

  // service_roleクライアントでRLSをバイパス
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6a2ZrYXpqeWxya3NwcXJuaG54Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMjc1NjYyOCwiZXhwIjoyMDM4MzMyNjI4fQ.L2o_CkIoGNmTanVh0Bc-7RS_kStZLHQ8TNCM-TvHqXk'
  )

  // clinic_id取得（service_roleで確実に取得）
  const { data: membership } = await serviceClient
    .from('clinic_members')
    .select('clinic_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership?.clinic_id) {
    return NextResponse.json({ error: '所属院が見つかりません' }, { status: 403 })
  }

  const body = await request.json()
  const { id, ...updateFields } = body

  if (!id) {
    return NextResponse.json({ error: '患者IDが必要です' }, { status: 400 })
  }

  // 対象患者がこの院のものか確認
  const { data: patient } = await serviceClient
    .from('cm_patients')
    .select('id')
    .eq('id', id)
    .eq('clinic_id', membership.clinic_id)
    .single()

  if (!patient) {
    return NextResponse.json({ error: '患者が見つかりません' }, { status: 404 })
  }

  const { data: updated, error } = await serviceClient
    .from('cm_patients')
    .update(updateFields)
    .eq('id', id)
    .eq('clinic_id', membership.clinic_id)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: '更新対象が見つかりません' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
