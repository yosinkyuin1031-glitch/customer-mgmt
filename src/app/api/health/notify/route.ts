import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )

  const services: Record<string, { status: string; latency?: number; error?: string }> = {}

  // Test Supabase
  const supabaseStart = Date.now()
  try {
    const { error } = await supabase
      .from('cm_patients')
      .select('id', { count: 'exact', head: true })
    services.supabase = error
      ? { status: 'error', error: error.message, latency: Date.now() - supabaseStart }
      : { status: 'ok', latency: Date.now() - supabaseStart }
  } catch (e) {
    services.supabase = {
      status: 'error',
      error: e instanceof Error ? e.message : 'Unknown',
      latency: Date.now() - supabaseStart,
    }
  }

  // Test Anthropic API
  const anthropicStart = Date.now()
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      services.anthropic = { status: 'error', error: 'API key not set' }
    } else {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      })
      services.anthropic = { status: 'ok', latency: Date.now() - anthropicStart }
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Unknown'
    services.anthropic = { status: 'error', error: errMsg, latency: Date.now() - anthropicStart }
  }

  const overall = Object.values(services).every((r) => r.status === 'ok')
    ? 'healthy'
    : 'degraded'

  // Log to cm_health_logs if degraded
  if (overall === 'degraded') {
    try {
      await supabase.from('cm_health_logs').insert({
        status: overall,
        services,
        notified: false,
      })
    } catch (e) {
      console.error('Failed to log health status:', e)
    }
  }

  return NextResponse.json(
    {
      status: overall,
      timestamp: new Date().toISOString(),
      services,
      logged: overall === 'degraded',
    },
    { status: overall === 'healthy' ? 200 : 503 }
  )
}
