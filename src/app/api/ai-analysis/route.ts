import { NextRequest, NextResponse } from 'next/server'
import { callWithRetry, AnthropicApiError } from '@/lib/anthropic'

export async function POST(request: NextRequest) {
  try {
    const { clinicId, statsData } = await request.json()

    if (!clinicId || !statsData) {
      return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 })
    }

    const prompt = `あなたは整体院・治療院の経営コンサルタントです。以下の月間統計データを分析し、具体的な経営アドバイスを日本語で提供してください。

## 分析データ
${JSON.stringify(statsData, null, 2)}

## 出力フォーマット（必ずこの構造で）

### 1. 経営状況サマリー
直近のデータから、売上・患者数・リピート率などの傾向を3〜5行で簡潔にまとめてください。

### 2. 強み（良い点）
- 箇条書きで3〜5個
- 具体的な数値を引用して

### 3. 改善ポイント
- 箇条書きで3〜5個
- 具体的な改善アクションを含めて

### 4. 今月のアクションプラン
優先度順に3つの具体的な施策を提案してください。各施策には：
- 施策名
- 具体的な実行方法
- 期待される効果

### 5. KPI目標の提案
来月の目標値を提案してください：
- 売上目標
- 新規患者数目標
- リピート率目標
- 回数券購入率目標

数値は必ず根拠を示してください。楽観的すぎず、実現可能な提案をしてください。`

    const response = await callWithRetry({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
      clinicId,
      endpoint: 'ai-analysis',
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    return NextResponse.json({
      analysis: text,
      usage: response.usage,
    })
  } catch (error) {
    if (error instanceof AnthropicApiError) {
      return NextResponse.json({ error: error.message, type: error.type }, { status: 500 })
    }
    console.error('AI Analysis error:', error)
    return NextResponse.json({ error: 'AI分析中にエラーが発生しました' }, { status: 500 })
  }
}
