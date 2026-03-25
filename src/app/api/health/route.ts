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
    results.supabase = error
      ? { status: 'error', error: error.message, latency: Date.now() - supabaseStart }
      : { status: 'ok', latency: Date.now() - supabaseStart }
  } catch (e) {
    results.supabase = {
      status: 'error',
      error: e instanceof Error ? e.message : 'Unknown',
      latency: Date.now() - supabaseStart,
    }
  }

  // Test Anthropic API
  const anthropicStart = Date.now()
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      results.anthropic = { status: 'error', error: 'API key not set' }
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
    const errMsg = e instanceof Error ? e.message : 'Unknown'
    results.anthropic = { status: 'error', error: errMsg, latency: Date.now() - anthropicStart }
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
