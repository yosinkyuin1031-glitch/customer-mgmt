export interface PlanLimitResult {
  allowed: boolean
  message?: string
  currentCount?: number
  limit?: number
  plan?: string
}

/**
 * プラン制限チェック
 * 現在は全院同一プラン（制限なし）のため常にallowedを返す
 */
export async function checkPlanLimit(_clinicId: string): Promise<PlanLimitResult> {
  return { allowed: true }
}
