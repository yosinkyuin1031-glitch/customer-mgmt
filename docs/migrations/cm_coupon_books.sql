-- 回数券管理テーブル
-- 実行方法: Supabase SQL Editorにコピペして実行してください

CREATE TABLE IF NOT EXISTS cm_coupon_books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  patient_id UUID NOT NULL,
  patient_name TEXT NOT NULL,
  coupon_type TEXT NOT NULL, -- '15回券', '30回券', '45回券', or カスタム
  total_count INTEGER NOT NULL, -- 購入回数（15, 30, 45）
  used_count INTEGER NOT NULL DEFAULT 0, -- 使用回数
  remaining_count INTEGER GENERATED ALWAYS AS (total_count - used_count) STORED, -- 残り回数（自動計算）
  purchase_date DATE NOT NULL,
  purchase_amount INTEGER NOT NULL, -- 購入金額
  unit_price INTEGER GENERATED ALWAYS AS (purchase_amount / total_count) STORED, -- 単価（自動計算）
  expiry_date DATE, -- 有効期限（購入日から12ヶ月）
  status TEXT NOT NULL DEFAULT 'active', -- active, completed, expired, refunded
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_cm_coupon_books_clinic_id ON cm_coupon_books(clinic_id);
CREATE INDEX IF NOT EXISTS idx_cm_coupon_books_patient_id ON cm_coupon_books(patient_id);
CREATE INDEX IF NOT EXISTS idx_cm_coupon_books_status ON cm_coupon_books(status);

-- RLS
ALTER TABLE cm_coupon_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinic_isolation" ON cm_coupon_books
  FOR ALL USING (clinic_id = current_setting('app.clinic_id', true));

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_cm_coupon_books_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cm_coupon_books_updated_at
  BEFORE UPDATE ON cm_coupon_books
  FOR EACH ROW
  EXECUTE FUNCTION update_cm_coupon_books_updated_at();
