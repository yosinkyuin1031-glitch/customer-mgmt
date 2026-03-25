import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

interface CallOptions {
  model?: string
  max_tokens?: number
  messages: { role: 'user' | 'assistant'; content: string }[]
  clinicId: string
  endpoint: string
}

class AnthropicApiError extends Error {
  type: 'credits' | 'auth' | 'system' | 'unknown'
  constructor(type: 'credits' | 'auth' | 'system' | 'unknown', message: string) {
    super(message)
    this.type = type
  }
}

/**
 * Anthropic APIをリトライ付きで呼び出し、使用量をトラッキングする
 */
async function callWithRetry(options: CallOptions, retries = 3): Promise<Anthropic.Message> {
  const { model = 'claude-sonnet-4-6', max_tokens = 2000, messages } = options

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await anthropic.messages.create({ model, max_tokens, messages })

      // Track usage
      await trackUsage(options.clinicId, options.endpoint, response.usage, true)

      return response
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)

      // Don't retry on auth errors
      if (errMsg.includes('authentication') || errMsg.includes('invalid x-api-key')) {
        await trackUsage(options.clinicId, options.endpoint, null, false, 'API認証エラー')
        throw new AnthropicApiError('system', 'AIサービスの設定に問題があります。管理者にお問い合わせください。')
      }

      // Don't retry on credit/billing errors
      if (errMsg.includes('credit balance') || errMsg.includes('billing')) {
        await trackUsage(options.clinicId, options.endpoint, null, false, 'クレジット不足')
        throw new AnthropicApiError('credits', 'AIのAPIクレジットが不足しています。管理者にお問い合わせください。')
      }

      // Retry on server errors or overload
      if (attempt < retries - 1 && (errMsg.includes('overloaded') || errMsg.includes('529') || errMsg.includes('500') || errMsg.includes('503'))) {
        const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      await trackUsage(options.clinicId, options.endpoint, null, false, errMsg)
      throw new AnthropicApiError('unknown', '解析中にエラーが発生しました。しばらく待ってから再度お試しください。')
    }
  }

  throw new AnthropicApiError('unknown', '解析に失敗しました。時間をおいて再度お試しください。')
}

async function trackUsage(
  clinicId: string,
  endpoint: string,
  usage: { input_tokens: number; output_tokens: number } | null,
  success: boolean,
  errorMessage?: string
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const totalTokens = usage ? usage.input_tokens + usage.output_tokens : 0
    // Approximate cost: input $3/M, output $15/M for sonnet
    const costEstimate = usage
      ? (usage.input_tokens * 3 + usage.output_tokens * 15) / 1000000
      : 0

    await supabase.from('cm_api_usage').insert({
      clinic_id: clinicId,
      endpoint,
      tokens_used: totalTokens,
      cost_estimate: costEstimate,
      success,
      error_message: errorMessage || null,
    })
  } catch {
    // Don't let tracking errors break the main flow
    console.error('Failed to track API usage')
  }
}

export { callWithRetry, AnthropicApiError }
