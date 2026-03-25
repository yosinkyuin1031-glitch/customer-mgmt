-- 回数券に消費開始日カラムを追加
-- 早めに購入した人のために、消費をいつから開始するか選択できるようにする
ALTER TABLE cm_coupon_books
ADD COLUMN IF NOT EXISTS consumption_start_date DATE;

-- 既存データは purchase_date を消費開始日とする
UPDATE cm_coupon_books
SET consumption_start_date = purchase_date
WHERE consumption_start_date IS NULL;
