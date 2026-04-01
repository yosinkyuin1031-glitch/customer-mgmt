import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClinicIdServer } from '@/lib/clinic-server'
import { callWithRetry, AnthropicApiError } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  try {
    // 認証チェック
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { text, image } = await req.json()
    if (!text && !image) {
      return NextResponse.json({ error: 'テキストまたは画像が必要です' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEYが設定されていません' }, { status: 500 })
    }

    const clinicId = await getClinicIdServer()

    const systemPrompt = `あなたは整体院の受付アシスタントです。
患者の情報を抽出してJSONで返してください。

【抽出する項目】
- name: 氏名（漢字）
- furigana: ふりがな（ひらがな）
- birth_date: 生年月日（YYYY-MM-DD形式。和暦の場合は西暦に変換）
- gender: 性別（男性/女性/その他）
- phone: 電話番号（ハイフン付き）
- email: メールアドレス
- zipcode: 郵便番号
- prefecture: 都道府県
- city: 市区町村
- address: 番地
- building: 建物名・部屋番号
- occupation: 職業
- referral_source: 来院経路（以下から最も近いもの: Google検索, Googleマップ, Instagram, YouTube, チラシ, 紹介, LINE, 通りがかり, HP, その他）
- chief_complaint: 主訴（お困りの症状）
- medical_history: 既往歴

【和暦変換ルール】
- 令和元年=2019, 令和2年=2020, ...
- 平成元年=1989, 平成31年=2019
- 昭和元年=1926, 昭和64年=1989

【数字の読み取り強化ルール】
- 手書き数字は文脈から判断する（電話番号は10〜11桁、郵便番号は7桁）
- 似た数字の区別: 1と7、6と0、8と3、9と4、2とZ を注意深く判別
- 電話番号: 先頭が0で始まる。携帯は080/090/070、固定は市外局番から。桁数が合わない場合は空文字にする
- 郵便番号: 3桁-4桁の形式。桁数が合わない場合は空文字にする
- 生年月日: 年・月・日の範囲チェック（月は1-12、日は1-31）。不自然な日付は空文字にする
- 住所の番地: 「丁目」「番」「号」の数字も正確に読む
- 数字が不鮮明で複数の解釈がある場合は空文字にする（推測しない）

【ルール】
- 読み取れない項目は空文字""にする
- 推測で埋めない。明確に読み取れる情報のみ
- 手書きの場合も最大限読み取る
- JSONのみ返す。説明文不要`

    // メッセージ構築（テキストのみ or 画像あり）
    type ContentBlock = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp'; data: string } }
    const contentBlocks: ContentBlock[] = []

    if (image) {
      const mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = image.startsWith('data:image/png') ? 'image/png'
        : image.startsWith('data:image/webp') ? 'image/webp'
        : 'image/jpeg'
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64Data },
      })
      contentBlocks.push({
        type: 'text',
        text: text
          ? `この画像はカルテ・問診票です。画像と以下の追加情報から患者情報を抽出してください。\n追加情報: ${text}`
          : 'この画像はカルテ・問診票です。書かれている患者情報を全て読み取ってJSON形式で抽出してください。',
      })
    } else {
      contentBlocks.push({
        type: 'text',
        text: `以下のテキストから新規患者の情報を抽出してJSONで返してください。\n\n【入力テキスト】\n${text}`,
      })
    }

    // 画像ありの場合: contentBlocksをそのまま使う（systemPromptをテキストブロックの先頭に追加）
    // テキストのみの場合: 文字列として結合
    let messageContent: string | ContentBlock[]
    if (image) {
      // 画像の場合: systemPrompt + 画像 + 指示テキスト
      messageContent = [
        { type: 'text' as const, text: systemPrompt },
        ...contentBlocks,
      ]
    } else {
      const firstBlock = contentBlocks[0]
      messageContent = systemPrompt + '\n\n---\n\n' + (firstBlock.type === 'text' ? firstBlock.text : '')
    }

    const response = await callWithRetry({
      clinicId,
      endpoint: image ? 'parse-patient-image' : 'parse-patient',
      model: image ? 'claude-sonnet-4-6' : undefined,
      max_tokens: 1500,
      messages: [
        { role: 'user' as const, content: messageContent }
      ]
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: '解析に失敗しました' }, { status: 500 })
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: '解析結果を読み取れませんでした' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({ patient: parsed })
  } catch (error) {
    console.error('Parse error:', error)

    if (error instanceof AnthropicApiError) {
      const statusMap: Record<string, number> = {
        credits: 402,
        auth: 401,
        system: 503,
        unknown: 500,
      }
      return NextResponse.json(
        { error: error.message },
        { status: statusMap[error.type] || 500 }
      )
    }

    return NextResponse.json({ error: '解析中にエラーが発生しました' }, { status: 500 })
  }
}
