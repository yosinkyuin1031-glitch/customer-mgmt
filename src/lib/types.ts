export interface Patient {
  id: string
  name: string
  furigana: string
  birth_date: string | null
  gender: '男性' | '女性' | 'その他'
  phone: string
  email: string
  address: string
  occupation: string
  referral_source: string
  chief_complaint: string
  medical_history: string
  notes: string
  status: 'active' | 'inactive' | 'completed'
  created_at: string
  updated_at: string
}

export interface VisitRecord {
  id: string
  patient_id: string
  visit_date: string
  visit_number: number
  symptoms: string
  treatment_content: string
  body_condition: string
  improvement: string
  atmosphere: '良好' | '普通' | 'やや悪い' | '悪い'
  next_plan: string
  next_appointment: string | null
  payment_amount: number
  payment_method: '現金' | 'カード' | 'QR決済' | '回数券' | 'その他'
  notes: string
  created_at: string
  patient?: Patient
}

export const REFERRAL_SOURCES = [
  'Google検索', 'Googleマップ', 'Instagram', 'YouTube',
  'チラシ', '紹介', '通りがかり', 'LINE', 'その他'
] as const

export const PAYMENT_METHODS = [
  '現金', 'カード', 'QR決済', '回数券', 'その他'
] as const
