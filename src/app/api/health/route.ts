import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export async function GET() {
  const results: Record<string, { status: string; latency?: number; error?: string }> = {}

  // Test Supabase
  const supabaseStart = Date.now()
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )
    const { error } = await supabase
      .from('cm_patients')
      .select('id', { count: 'exact', head: true })
    if (error) console.error('Health check Supabase error:', error)
    results.supabase = error
      ? { status: 'error', error: '接続エラー', latency: Date.now() - supabaseStart }
      : { status: 'ok', latency: Date.now() - supabaseStart }
  } catch (e) {
    console.error('Health check Supabase error:', e)
    results.supabase = {
      status: 'error',
      error: '接続エラー',
      latency: Date.now() - supabaseStart,
    }
  }

  // Test Anthropic API
  const anthropicStart = Date.now()
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      results.anthropic = { status: 'error', error: '設定エラー' }
    } else {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      })
      results.anthropic = { status: 'ok', latency: Date.now() - anthropicStart }
    }
  } catch (e) {
    console.error('Health check Anthropic error:', e)
    results.anthropic = { status: 'error', error: '接続エラー', latency: Date.now() - anthropicStart }
  }

  const overall = Object.values(results).every((r) => r.status === 'ok')
    ? 'healthy'
    : 'degraded'

  return NextResponse.json(
    {
      status: overall,
      timestamp: new Date().toISOString(),
      services: results,
    },
    { status: overall === 'healthy' ? 200 : 503 }
  )
}
