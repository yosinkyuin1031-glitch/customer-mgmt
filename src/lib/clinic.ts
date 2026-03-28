/**
 * クリニックID取得
 * ログインユーザーの所属院からclinic_idを動的に取得する。
 */

import { createClient } from '@/lib/supabase/client'

// クライアント側キャッシュ
let cachedClinicId: string | null = null
let fetchPromise: Promise<string> | null = null

/**
 * クライアントコンポーネント用: clinic_idを動的に取得
 * Supabase Auth のユーザーIDから clinic_members テーブルを検索
 */
export async function getClinicIdClient(): Promise<string> {
  // キャッシュがあればそれを返す
  if (cachedClinicId) return cachedClinicId

  // 既にフェッチ中ならそのPromiseを返す（重複リクエスト防止）
  if (fetchPromise) return fetchPromise

  fetchPromise = (async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // 未ログイン → ログインページへリダイレクト
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return ''
      }

      const { data: membership } = await supabase
        .from('clinic_members')
        .select('clinic_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (membership?.clinic_id) {
        cachedClinicId = membership.clinic_id
        return membership.clinic_id
      }

      // 所属院が見つからない場合、サインアップフローへリダイレクト
      if (typeof window !== 'undefined') {
        window.location.href = '/signup?reason=no_clinic'
      }
      return ''
    } catch {
      return ''
    } finally {
      fetchPromise = null
    }
  })()

  return fetchPromise
}

/**
 * サーバーコンポーネント用は clinic-server.ts の getClinicIdServer() を使用してください
 */

/**
 * 後方互換性のため: 同期的にclinic_idを返す
 * ※ キャッシュがない場合は空文字を返し、
 *    バックグラウンドでフェッチを開始する
 *
 * @deprecated getClinicIdClient() を使ってください
 */
export function getClinicId(): string {
  if (cachedClinicId) return cachedClinicId

  // バックグラウンドでフェッチ開始（結果は次回使用時に反映）
  if (!fetchPromise && typeof window !== 'undefined') {
    getClinicIdClient()
  }

  return process.env.NEXT_PUBLIC_CLINIC_ID || ''
}

/**
 * キャッシュをクリア（ログアウト時に使用）
 */
export function clearClinicIdCache() {
  cachedClinicId = null
  fetchPromise = null
}
