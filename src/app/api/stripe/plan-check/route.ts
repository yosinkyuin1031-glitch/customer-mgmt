import { NextRequest, NextResponse } from 'next/server'
import { checkPlanLimit } from '@/lib/plan'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { clinicId } = await req.json()

    if (!clinicId) {
      return NextResponse.json({ error: 'clinicIdは必須です' }, { status: 400 })
    }

    // 認証チェック
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // clinicId所有権検証
    const { data: membership } = await supabase
      .from('clinic_members')
      .select('clinic_id')
      .eq('user_id', user.id)
      .eq('clinic_id', clinicId)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'このクリニックへのアクセス権がありません' }, { status: 403 })
    }

    const result = await checkPlanLimit(clinicId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Plan check error:', error)
    return NextResponse.json(
      { error: 'プラン確認に失敗しました' },
      { status: 500 }
    )
  }
}
