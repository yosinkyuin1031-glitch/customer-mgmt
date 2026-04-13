# Clinic Core

## 基本情報
- フレームワーク：Next.js（App Router）
- DB：Supabase（vzkfkazjylrkspqrnhnx）
- デプロイ先：Vercel

## セキュリティ設定

### RLS・Policy設定
新しいテーブルを作成したら必ず以下を実行すること：

1. RLS有効化
```sql
ALTER TABLE [テーブル名] ENABLE ROW LEVEL SECURITY;
```

2. 自院データのみアクセス可能にする場合
```sql
CREATE POLICY "clinic_[テーブル名]_policy" ON [テーブル名]
  FOR ALL USING (clinic_id IN (
    SELECT clinic_id FROM clinic_members
    WHERE user_id = auth.uid()
  ));
```

3. ログインユーザーのみアクセス可能にする場合
```sql
CREATE POLICY "authenticated_users_only" ON [テーブル名]
  FOR ALL USING (auth.uid() IS NOT NULL);
```

### 共通セキュリティ基準
- .env / .env.local は絶対にコードに含めない
- service_roleキーはサーバーサイドのみ使用、フロントに露出させない
- APIエンドポイントには適切な認証チェックを入れる
- XSS対策：ユーザー入力は必ずサニタイズ
- Supabaseのanon keyのみクライアントに露出可（RLSで保護されている前提）
