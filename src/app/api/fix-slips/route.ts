import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const ids = [
      "c9f1c8ec-236a-4ea1-a1df-b8ecbed41a06",
      "82f9d006-6d43-4f41-a2da-555904a35372",
      "6bf1af45-2677-446a-912d-ed6ad2358afa",
      "65158739-2d7e-44b6-a0e6-9ce872a54b09",
      "d0c99b10-099e-4048-8af2-8d2c9221667c",
      "005015ae-d8cc-4eb6-8305-16c1f7162e87",
      "8f455cb2-80c9-430d-ad28-42cb0b24643c",
      "3a71057d-4f00-4cd1-987b-483fed3d39ca",
      "b6297b27-65f5-429e-aedc-bac64255d0c5",
      "fc75e173-ed43-4312-a0e2-db982b8fdf4e",
      "3db84b64-7572-4073-a0cb-c5483403ed53",
    ]

    const results = []
    for (const id of ids) {
      const { data, error } = await supabase.from('cm_slips').update({
        visit_date: '2026-03-14',
        payment_method: '回数券',
        total_price: 0,
        base_price: 0,
        notes: '',
      }).eq('id', id).select('id, patient_name, visit_date, payment_method')

      results.push({ id: id.slice(0, 8), data, error: error?.message })
    }

    return NextResponse.json({ results })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
