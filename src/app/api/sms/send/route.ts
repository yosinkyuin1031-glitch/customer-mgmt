import { NextRequest, NextResponse } from 'next/server'

interface Recipient {
  id: string
  name: string
  phone: string
}

interface SMSRequest {
  recipients: Recipient[]
  message: string
  templateName: string
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

    // 電話番号バリデーション（日本の携帯番号: 070/080/090）
    const invalidRecipients = recipients.filter(r => {
      const cleaned = r.phone.replace(/[-\s]/g, '')
      return !/^0[789]0\d{8}$/.test(cleaned)
    })

    if (invalidRecipients.length > 0) {
      return NextResponse.json({
        success: false,
        error: `無効な電話番号: ${invalidRecipients.map(r => r.name).join(', ')}`,
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

      for (const r of recipients) {
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
      console.log(`SMS送信（モック）: ${recipients.length}名に送信`)
      console.log(`テンプレート: ${templateName}`)
      recipients.forEach(r => {
        const personalizedMessage = message.replace(/{patient_name}/g, r.name)
        console.log(`  -> ${r.name} (${r.phone}): ${personalizedMessage}`)
      })

      return NextResponse.json({
        success: true,
        mode: 'mock',
        count: recipients.length,
        sentAt: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error('SMS送信エラー:', error)
    return NextResponse.json({ success: false, error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
