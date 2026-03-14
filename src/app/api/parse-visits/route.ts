import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'テキストが必要です' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEYが設定されていません' }, { status: 500 })
    }

    // 患者リストを取得してAIに渡す
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: patients } = await supabase
      .from('cm_patients')
      .select('id, name, furigana')
      .eq('status', 'active')
      .order('name')

    // 基本メニューも取得
    const { data: menus } = await supabase
      .from('cm_base_menus')
      .select('name, price, duration_minutes')
      .eq('is_active', true)

    const patientList = (patients || []).map(p => `${p.name}（${p.furigana || ''}）→ ID:${p.id}`).join('\n')
    const menuList = (menus || []).map(m => `${m.name}: ${m.price}円 / ${m.duration_minutes}分`).join('\n')

    const today = new Date().toISOString().split('T')[0]

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `あなたは整体院の顧客管理システムのアシスタントです。
以下のテキストから施術記録を抽出してJSON配列で返してください。

【登録済み患者リスト】
${patientList}

【メニューマスタ】
${menuList}

【ルール】
- 患者名は登録済みリストから最も近い名前をマッチングしてください（ふりがな・部分一致OK）
- 「回数券消費」「回数券の消化」「回数券で」→ total_price: 0, menu_name: "回数券消化"
- 金額の指定がある場合はtotal_priceにセット
- メニュー名の指定があればmenu_nameにセット。マスタに一致すれば料金も自動セット
- 日付の指定がなければ今日（${today}）
- 支払方法の指定がなければ "現金"
- 「いつもの」「通常」等はメニューマスタの最初のメニューを使用

【出力フォーマット】JSONのみ、説明文不要
[
  {
    "patient_id": "UUID or null",
    "patient_name": "患者名",
    "visit_date": "YYYY-MM-DD",
    "menu_name": "メニュー名",
    "total_price": 数値,
    "payment_method": "現金",
    "notes": "補足があれば"
  }
]

【入力テキスト】
${text}`
        }
      ]
    })

    // レスポンスからJSONを抽出
    const content = response.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: '解析に失敗しました' }, { status: 500 })
    }

    // JSON部分を抽出
    const jsonMatch = content.text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ error: '解析結果を読み取れませんでした', raw: content.text }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({ records: parsed })
  } catch (error) {
    console.error('Parse error:', error)
    return NextResponse.json({ error: '解析中にエラーが発生しました' }, { status: 500 })
  }
}
