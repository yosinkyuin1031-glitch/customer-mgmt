import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const clinicId = searchParams.get('clinicId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId is required' }, { status: 400 })
  }

  const supabase = await createClient()

  // 1000件制限を回避して全件取得
  const PAGE_SIZE = 1000
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allSlips: any[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from('cm_slips')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('visit_date', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (from) {
      query = query.gte('visit_date', from)
    }
    if (to) {
      query = query.lte('visit_date', to)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) break

    allSlips = allSlips.concat(data)
    hasMore = data.length === PAGE_SIZE
    offset += PAGE_SIZE
  }

  // CSV ヘッダー
  const headers = [
    '来院日',
    '患者名',
    'メニュー',
    'オプション',
    '合計金額',
    '支払方法',
    '担当スタッフ',
    '備考',
  ]

  // CSV 行を生成
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = allSlips.map((s: any) => [
    s.visit_date ?? '',
    s.patient_name ?? '',
    s.menu_name ?? '',
    s.option_names ?? '',
    String(s.total_price ?? 0),
    s.payment_method ?? '',
    s.staff_name ?? '',
    s.notes ?? '',
  ])

  // CSV文字列を組み立て
  const csvLines = [headers, ...rows].map((row) =>
    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  )
  const csvString = csvLines.join('\n')

  // BOM付きUTF-8
  const BOM = '\uFEFF'
  const body = BOM + csvString

  // ファイル名に日付を含める
  const now = new Date()
  const dateStr =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sales_${dateStr}.csv"`,
    },
  })
}
