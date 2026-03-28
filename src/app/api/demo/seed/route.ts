import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEMO_CLINIC_ID = '00000000-0000-0000-0000-000000000099'

const SAMPLE_PATIENTS = [
  { name: '田中太郎', furigana: 'タナカタロウ', gender: '男性', birth_date: '1985-03-15', phone: '090-1234-5678' },
  { name: '鈴木花子', furigana: 'スズキハナコ', gender: '女性', birth_date: '1990-07-22', phone: '090-2345-6789' },
  { name: '佐藤一郎', furigana: 'サトウイチロウ', gender: '男性', birth_date: '1978-11-03', phone: '090-3456-7890' },
  { name: '山田美智子', furigana: 'ヤマダミチコ', gender: '女性', birth_date: '1982-05-18', phone: '090-4567-8901' },
  { name: '高橋健一', furigana: 'タカハシケンイチ', gender: '男性', birth_date: '1975-09-30', phone: '090-5678-9012' },
  { name: '渡辺由美', furigana: 'ワタナベユミ', gender: '女性', birth_date: '1988-12-25', phone: '090-6789-0123' },
  { name: '伊藤雅人', furigana: 'イトウマサト', gender: '男性', birth_date: '1992-01-14', phone: '090-7890-1234' },
  { name: '中村あかり', furigana: 'ナカムラアカリ', gender: '女性', birth_date: '1995-04-07', phone: '090-8901-2345' },
  { name: '小林誠', furigana: 'コバヤシマコト', gender: '男性', birth_date: '1970-08-20', phone: '090-9012-3456' },
  { name: '加藤裕子', furigana: 'カトウユウコ', gender: '女性', birth_date: '1983-06-11', phone: '090-0123-4567' },
  { name: '吉田大輔', furigana: 'ヨシダダイスケ', gender: '男性', birth_date: '1987-02-28', phone: '080-1234-5678' },
  { name: '松本美咲', furigana: 'マツモトミサキ', gender: '女性', birth_date: '1993-10-16', phone: '080-2345-6789' },
  { name: '井上正樹', furigana: 'イノウエマサキ', gender: '男性', birth_date: '1980-07-04', phone: '080-3456-7890' },
  { name: '木村千尋', furigana: 'キムラチヒロ', gender: '女性', birth_date: '1991-09-12', phone: '080-4567-8901' },
  { name: '林修一', furigana: 'ハヤシシュウイチ', gender: '男性', birth_date: '1968-03-22', phone: '080-5678-9012' },
]

const CHIEF_COMPLAINTS = ['腰痛', '肩こり', '頭痛', '自律神経', '膝痛']
const REFERRAL_SOURCES = ['Google検索', '紹介', 'チラシ（ポスティング）', 'Instagram']
const MENUS = [
  { name: '初診', price: 5500 },
  { name: '通常施術', price: 4400 },
  { name: '延長30分', price: 2200 },
]
const PAYMENT_METHODS = ['現金', 'カード', 'QR決済']
const SYMPTOMS_DETAIL: Record<string, string[]> = {
  '腰痛': ['腰部の張り', '前屈時の痛み', '起床時の腰の重だるさ'],
  '肩こり': ['肩甲骨周囲の緊張', '首から肩のこわばり', 'デスクワーク後の肩の重さ'],
  '頭痛': ['後頭部の締め付け感', '目の奥の痛み', '天気の変わり目の頭痛'],
  '自律神経': ['倦怠感', '不眠', '動悸・息切れ'],
  '膝痛': ['階段昇降時の痛み', '正座困難', '膝の違和感'],
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomDateInPast6Months(): string {
  const now = new Date()
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const diff = now.getTime() - sixMonthsAgo.getTime()
  const randomDate = new Date(sixMonthsAgo.getTime() + Math.random() * diff)
  return randomDate.toISOString().split('T')[0]
}

export async function POST() {
  try {
    const supabase = await createClient()

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // デモ用クリニックが存在しなければ作成
    const { data: existingClinic } = await supabase
      .from('clinics')
      .select('id')
      .eq('id', DEMO_CLINIC_ID)
      .single()

    if (!existingClinic) {
      await supabase.from('clinics').insert({
        id: DEMO_CLINIC_ID,
        name: 'デモ整体院',
        code: 'demo-clinic',
        owner_name: 'デモユーザー',
        plan: 'pro',
      })
    }

    // デモユーザーをclinic_membersに登録（未登録の場合）
    const { data: existingMember } = await supabase
      .from('clinic_members')
      .select('id')
      .eq('clinic_id', DEMO_CLINIC_ID)
      .eq('user_id', user.id)
      .single()

    if (!existingMember) {
      await supabase.from('clinic_members').insert({
        clinic_id: DEMO_CLINIC_ID,
        user_id: user.id,
        role: 'owner',
      })
    }

    // 既にデモデータが存在するかチェック
    const { count } = await supabase
      .from('cm_patients')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', DEMO_CLINIC_ID)

    if (count && count > 0) {
      return NextResponse.json({ message: 'デモデータは既に存在します', skipped: true })
    }

    // 患者データ生成
    const patientRecords = SAMPLE_PATIENTS.map((p) => {
      const complaint = randomItem(CHIEF_COMPLAINTS)
      const source = randomItem(REFERRAL_SOURCES)
      return {
        clinic_id: DEMO_CLINIC_ID,
        name: p.name,
        furigana: p.furigana,
        gender: p.gender,
        birth_date: p.birth_date,
        phone: p.phone,
        email: '',
        address: '',
        zipcode: '',
        prefecture: '東京都',
        city: '渋谷区',
        building: '',
        occupation: '',
        referral_source: source,
        visit_motive: '',
        customer_category: '',
        chief_complaint: complaint,
        medical_history: '',
        notes: '',
        status: 'active',
        is_enabled: true,
        is_direct_mail: true,
      }
    })

    const { data: patients, error: patientError } = await supabase
      .from('cm_patients')
      .insert(patientRecords)
      .select('id, name, chief_complaint')

    if (patientError) {
      console.error('患者データ挿入エラー:', patientError)
      return NextResponse.json({ error: '患者データの生成に失敗しました' }, { status: 500 })
    }

    // 各患者に来院記録（cm_slips）を3〜8件生成
    const slipRecords: Array<Record<string, unknown>> = []
    for (const patient of patients || []) {
      const visitCount = 3 + Math.floor(Math.random() * 6) // 3〜8件
      const complaint = patient.chief_complaint || '腰痛'
      const symptomDetails = SYMPTOMS_DETAIL[complaint] || SYMPTOMS_DETAIL['腰痛']

      for (let i = 0; i < visitCount; i++) {
        const menu = i === 0 ? MENUS[0] : randomItem(MENUS.slice(1))
        const hasOption = Math.random() > 0.7
        const optionMenu = hasOption ? MENUS[2] : null

        slipRecords.push({
          clinic_id: DEMO_CLINIC_ID,
          patient_id: patient.id,
          patient_name: patient.name,
          visit_date: randomDateInPast6Months(),
          staff_name: 'デモ施術者',
          menu_name: menu.name,
          base_price: menu.price,
          option_names: optionMenu ? optionMenu.name : '',
          option_price: optionMenu ? optionMenu.price : 0,
          total_price: menu.price + (optionMenu ? optionMenu.price : 0),
          payment_method: randomItem(PAYMENT_METHODS),
          discount: 0,
          tax: 0,
          duration_minutes: menu.name === '初診' ? 60 : menu.name === '延長30分' ? 60 : 30,
          notes: randomItem(symptomDetails),
        })
      }
    }

    // cm_slipsに一括挿入
    const { error: slipError } = await supabase
      .from('cm_slips')
      .insert(slipRecords)

    if (slipError) {
      console.error('伝票データ挿入エラー:', slipError)
      return NextResponse.json({ error: '来院記録の生成に失敗しました' }, { status: 500 })
    }

    // 患者のvisit_count, ltv, first_visit_date, last_visit_dateを更新
    for (const patient of patients || []) {
      const patientSlips = slipRecords.filter(s => s.patient_id === patient.id)
      const dates = patientSlips.map(s => s.visit_date as string).sort()
      const totalLtv = patientSlips.reduce((sum, s) => sum + (s.total_price as number), 0)

      await supabase
        .from('cm_patients')
        .update({
          visit_count: patientSlips.length,
          ltv: totalLtv,
          first_visit_date: dates[0],
          last_visit_date: dates[dates.length - 1],
        })
        .eq('id', patient.id)
    }

    return NextResponse.json({
      message: 'デモデータを生成しました',
      patients: patients?.length || 0,
      slips: slipRecords.length,
    })
  } catch (err) {
    console.error('デモシードエラー:', err)
    return NextResponse.json({ error: 'デモデータの生成に失敗しました' }, { status: 500 })
  }
}
