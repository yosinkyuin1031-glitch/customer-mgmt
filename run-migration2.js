const { Client } = require("pg");
const client = new Client({ connectionString: "postgresql://postgres.vzkfkazjylrkspqrnhnx:fJZj8SDawfJze7H9@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres" });

async function run() {
  await client.connect();

  const queries = [
    `ALTER TABLE cm_patients ADD COLUMN IF NOT EXISTS zipcode TEXT DEFAULT ''`,

    `CREATE TABLE IF NOT EXISTS cm_reservations (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      patient_id UUID REFERENCES cm_patients(id) ON DELETE SET NULL,
      patient_name TEXT DEFAULT '',
      staff_id UUID,
      reservation_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      menu_name TEXT DEFAULT '',
      menu_price INTEGER DEFAULT 0,
      status TEXT DEFAULT 'reserved' CHECK (status IN ('reserved', 'visited', 'cancelled', 'no_show')),
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_cm_reservations_date ON cm_reservations(reservation_date)`,
    `CREATE INDEX IF NOT EXISTS idx_cm_reservations_patient ON cm_reservations(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cm_reservations_staff ON cm_reservations(staff_id)`,
    `ALTER TABLE cm_reservations ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN CREATE POLICY "auth_reservations" ON cm_reservations FOR ALL USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

    `CREATE TABLE IF NOT EXISTS cm_slips (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      patient_id UUID REFERENCES cm_patients(id) ON DELETE SET NULL,
      patient_name TEXT DEFAULT '',
      visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
      staff_id UUID,
      staff_name TEXT DEFAULT '',
      menu_name TEXT DEFAULT '',
      base_price INTEGER DEFAULT 0,
      option_names TEXT DEFAULT '',
      option_price INTEGER DEFAULT 0,
      total_price INTEGER DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      discount INTEGER DEFAULT 0,
      tax INTEGER DEFAULT 0,
      duration_minutes INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_cm_slips_date ON cm_slips(visit_date)`,
    `CREATE INDEX IF NOT EXISTS idx_cm_slips_patient ON cm_slips(patient_id)`,
    `ALTER TABLE cm_slips ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN CREATE POLICY "auth_slips" ON cm_slips FOR ALL USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
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
