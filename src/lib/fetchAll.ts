import { SupabaseClient } from '@supabase/supabase-js'
import { getClinicIdClient } from './clinic'

/**
 * Supabaseの1000件制限を回避して全件取得する
 */
export async function fetchAllSlips<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  selectColumns: string = '*',
  filters?: { gte?: [string, string]; lte?: [string, string]; eq?: [string, string] }
): Promise<T[]> {
  const PAGE_SIZE = 1000
  let allData: T[] = []
  let offset = 0
  let hasMore = true
  const clinicId = await getClinicIdClient()

  while (hasMore) {
    let query = supabase
      .from('cm_slips')
      .select(selectColumns)
      .eq('clinic_id', clinicId)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (filters?.gte) query = query.gte(filters.gte[0], filters.gte[1])
    if (filters?.lte) query = query.lte(filters.lte[0], filters.lte[1])
    if (filters?.eq) query = query.eq(filters.eq[0], filters.eq[1])

    const { data, error } = await query
    if (error || !data) break

    allData = allData.concat(data as T[])
    hasMore = data.length === PAGE_SIZE
    offset += PAGE_SIZE
  }

  return allData
}
