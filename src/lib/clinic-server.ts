/**
 * サーバーコンポーネント専用: clinic_idを動的に取得
 * ※ このファイルはサーバーコンポーネント・API Routeからのみインポートすること
 */

import { createClient } from '@/lib/supabase/server'

export async function getClinicIdServer(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('認証されていません')
  }

  const { data: membership } = await supabase
    .from('clinic_members')
    .select('clinic_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (membership?.clinic_id) {
    return membership.clinic_id
  }

  throw new Error('所属クリニックが見つかりません')
}
