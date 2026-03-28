import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { clinicId } = await req.json()

    if (!clinicId) {
      return NextResponse.json({ error: 'clinicIdは必須です' }, { status: 400 })
    }

    const supabase = await createClient()

    // 認証チェック
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

    // クリニック情報を取得
    const { data: clinic } = await supabase
      .from('clinics')
      .select('stripe_customer_id')
      .eq('id', clinicId)
      .single()

    if (!clinic?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Stripeの顧客情報が見つかりません。まずプランをアップグレードしてください。' },
        { status: 404 }
      )
    }

    const origin = req.headers.get('origin') || 'http://localhost:3000'
    const session = await stripe.billingPortal.sessions.create({
      customer: clinic.stripe_customer_id,
      return_url: `${origin}/settings`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe Portal error:', error)
    return NextResponse.json(
      { error: 'ポータルセッションの作成に失敗しました' },
      { status: 500 }
    )
  }
}
