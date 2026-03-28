import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const clinicId = searchParams.get('clinicId')

  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId is required' }, { status: 400 })
  }

  const supabase = await createClient()

  // 認証チェック
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  // clinicId所有権検証
  const { data: membership } = await supabase
    .from('clinic_members')
    .select('clinic_id')
    .eq('user_id', user.id)
    .eq('clinic_id', clinicId)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'このクリニックへのアクセス権がありません' }, { status: 403 })
  }

  // 1000件制限を回避して全件取得
  const PAGE_SIZE = 1000
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allPatients: any[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('cm_patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) break

    allPatients = allPatients.concat(data)
    hasMore = data.length === PAGE_SIZE
    offset += PAGE_SIZE
  }

  // CSV ヘッダー
  const headers = [
    '名前',
    'ふりがな',
    '性別',
    '電話番号',
    'メール',
    '住所',
    '生年月日',
    '主訴',
    '来院経路',
    'ステータス',
    '初回来院日',
    '最終来院日',
    '来院回数',
    'LTV',
  ]

  const statusMap: Record<string, string> = {
    active: '通院中',
    inactive: '休眠',
    completed: '完了',
  }

  // CSV 行を生成
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = allPatients.map((p: any) => {
    const address = [p.prefecture, p.city, p.address, p.building]
      .filter(Boolean)
      .join(' ')

    return [
      p.name ?? '',
      p.furigana ?? '',
      p.gender ?? '',
      p.phone ?? '',
      p.email ?? '',
      address,
      p.birth_date ?? '',
      p.chief_complaint ?? '',
      p.referral_source ?? '',
      statusMap[p.status] ?? p.status ?? '',
      p.first_visit_date ?? '',
      p.last_visit_date ?? '',
      String(p.visit_count ?? 0),
      String(p.ltv ?? 0),
    ]
  })

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
      'Content-Disposition': `attachment; filename="patients_${dateStr}.csv"`,
    },
  })
}
