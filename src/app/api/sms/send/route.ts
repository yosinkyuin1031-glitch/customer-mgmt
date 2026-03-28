import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClinicIdServer } from '@/lib/clinic-server'

interface RecipientInput {
  id: string
  name: string
}

interface SMSRequest {
  recipients: RecipientInput[]
  message: string
  templateName: string
}

function isValidJapanesePhone(phone: string): boolean {
  const cleaned = phone.replace(/[-\s]/g, '')
  return /^0[789]0\d{8}$/.test(cleaned)
}

export async function POST(request: NextRequest) {
  try {
    const { recipients, message, templateName } = (await request.json()) as SMSRequest

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ success: false, error: '送信先が指定されていません' }, { status: 400 })
    }

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'メッセージが空です' }, { status: 400 })
    }

    // Supabaseから患者の電話番号を安全に取得
    const supabase = await createClient()
    const clinicId = await getClinicIdServer()
    const patientIds = recipients.map(r => r.id)

    const { data: patientsData, error: dbError } = await supabase
      .from('cm_patients')
      .select('id, name, phone')
      .eq('clinic_id', clinicId)
      .in('id', patientIds)

    if (dbError || !patientsData) {
      return NextResponse.json({ success: false, error: '患者データの取得に失敗しました' }, { status: 500 })
    }

    // IDと電話番号のマップを作成
    const patientMap = new Map(patientsData.map(p => [p.id, { name: p.name, phone: p.phone }]))

    // 電話番号の検証
    const resolvedRecipients: { id: string; name: string; phone: string }[] = []
    const invalidNames: string[] = []

    for (const r of recipients) {
      const patient = patientMap.get(r.id)
      if (!patient || !patient.phone || !isValidJapanesePhone(patient.phone)) {
        invalidNames.push(r.name)
      } else {
        resolvedRecipients.push({ id: r.id, name: patient.name, phone: patient.phone })
      }
    }

    if (invalidNames.length > 0) {
      return NextResponse.json({
        success: false,
        error: `無効な電話番号または患者データなし: ${invalidNames.join(', ')}`,
      }, { status: 400 })
    }

    // Twilio環境変数チェック
    const twilioSid = process.env.TWILIO_ACCOUNT_SID
    const twilioToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER
    const isLive = !!(twilioSid && twilioToken && twilioPhone)

    const results: { name: string; success: boolean; error?: string }[] = []

    if (isLive) {
      // Twilio本番送信
      const twilio = require('twilio')(twilioSid, twilioToken)

      for (const r of resolvedRecipients) {
        const personalizedMessage = message.replace(/{patient_name}/g, r.name)
        const toNumber = '+81' + r.phone.replace(/[-\s]/g, '').slice(1)

        try {
          await twilio.messages.create({
            body: personalizedMessage,
            from: twilioPhone,
            to: toNumber,
          })
          results.push({ name: r.name, success: true })
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : '送信失敗'
          results.push({ name: r.name, success: false, error: errMsg })
        }
      }

      const successCount = results.filter(r => r.success).length
      const failedCount = results.filter(r => !r.success).length

      return NextResponse.json({
        success: failedCount === 0,
        mode: 'live',
        count: successCount,
        failed: failedCount,
        results,
        sentAt: new Date().toISOString(),
      })
    } else {
      // モック送信（Twilio未設定時）
      console.log(`SMS送信（モック）: ${resolvedRecipients.length}名に送信`)
      console.log(`テンプレート: ${templateName}`)
      resolvedRecipients.forEach(r => {
        const personalizedMessage = message.replace(/{patient_name}/g, r.name)
        console.log(`  -> ${r.name}: ${personalizedMessage}`)
      })

      return NextResponse.json({
        success: true,
        mode: 'mock',
        count: resolvedRecipients.length,
        sentAt: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error('SMS送信エラー:', error)
    return NextResponse.json({ success: false, error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
