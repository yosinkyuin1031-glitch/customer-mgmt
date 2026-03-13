const { Client } = require("pg");
const client = new Client({ connectionString: "postgresql://postgres.vzkfkazjylrkspqrnhnx:fJZj8SDawfJze7H9@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres" });

async function run() {
  await client.connect();

  const queries = [
    // 広告費用テーブル
    `CREATE TABLE IF NOT EXISTS cm_ad_costs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      month TEXT NOT NULL,
      channel TEXT NOT NULL,
      cost INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      inquiries INTEGER DEFAULT 0,
      new_patients INTEGER DEFAULT 0,
      conversions INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_cm_ad_costs_month ON cm_ad_costs(month)`,
    `CREATE INDEX IF NOT EXISTS idx_cm_ad_costs_channel ON cm_ad_costs(channel)`,
    `ALTER TABLE cm_ad_costs ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN CREATE POLICY "auth_ad_costs" ON cm_ad_costs FOR ALL USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

    // 広告チャネルマスタ
    `CREATE TABLE IF NOT EXISTS cm_ad_channels (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `ALTER TABLE cm_ad_channels ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN CREATE POLICY "auth_ad_channels" ON cm_ad_channels FOR ALL USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

    // 初期データ
    `INSERT INTO cm_ad_channels (name, sort_order) VALUES
      ('Google広告', 1),
      ('Instagram広告', 2),
      ('Facebook広告', 3),
      ('LINE広告', 4),
      ('チラシ', 5),
      ('Googleマップ(MEO)', 6),
      ('SEO(自然検索)', 7),
      ('紹介', 8),
      ('その他', 9)
    ON CONFLICT DO NOTHING`,
  ];

  for (const q of queries) {
    try {
      await client.query(q);
      console.log("OK:", q.slice(0, 70));
    } catch (e) {
      console.log("ERR:", e.message);
    }
  }
  await client.end();
}
run();
