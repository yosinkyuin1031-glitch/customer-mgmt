/**
 * クリニックID設定
 * 現在はデフォルト院（晴れ鍼灸院）固定。
 * 将来的にはログインユーザーの所属院から動的に取得する。
 */

// デフォルトのclinic_id（晴れ鍼灸院・整骨院）
const DEFAULT_CLINIC_ID = '00000000-0000-0000-0000-000000000001'

export function getClinicId(): string {
  // 環境変数で上書き可能（テスト・複数院対応時）
  return process.env.NEXT_PUBLIC_CLINIC_ID || DEFAULT_CLINIC_ID
}
