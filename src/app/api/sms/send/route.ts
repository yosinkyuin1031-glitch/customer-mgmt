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

    // TODO: Twilio連携時にここを実装
    // const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    // for (const r of recipients) {
    //   const personalizedMessage = message
    //     .replace(/{patient_name}/g, r.name);
    //   await twilio.messages.create({
    //     body: personalizedMessage,
    //     from: process.env.TWILIO_PHONE_NUMBER,
    //     to: '+81' + r.phone.replace(/[-\s]/g, '').slice(1),
    //   });
    // }

    // 今はモック: コンソールに出力
    console.log(`SMS送信（モック）: ${recipients.length}名に送信`)
    console.log(`テンプレート: ${templateName}`)
    recipients.forEach(r => {
      const personalizedMessage = message.replace(/{patient_name}/g, r.name)
      console.log(`  -> ${r.name} (${r.phone}): ${personalizedMessage}`)
    })

    return NextResponse.json({
      success: true,
      count: recipients.length,
      sentAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('SMS送信エラー:', error)
    return NextResponse.json({ success: false, error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
