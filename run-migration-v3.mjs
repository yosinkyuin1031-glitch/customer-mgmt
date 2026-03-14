import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres:fJZj8SDawfJze7H9@db.vzkfkazjylrkspqrnhnx.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const CLINIC_ID = '00000000-0000-0000-0000-000000000001';

async function exec(sql, label) {
  try {
    await client.query(sql);
    console.log(`✓ ${label}`);
    return true;
  } catch (err) {
    console.error(`✗ ${label}: ${err.message}`);
    return false;
  }
}

async function run() {
  await client.connect();
  console.log('Connected to Supabase\n');

  // Step 0: Fix clinics table (drop and recreate if broken)
  console.log('--- Step 0: Fix clinics table ---');
  await exec(`DROP TABLE IF EXISTS clinic_members`, 'Drop clinic_members');
  await exec(`DROP TABLE IF EXISTS clinics CASCADE`, 'Drop clinics CASCADE');

  await exec(`CREATE TABLE clinics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    owner_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`, 'Create clinics table');

  await exec(`INSERT INTO clinics (id, name, code, owner_name) VALUES ('${CLINIC_ID}', '晴れ鍼灸院・整骨院', 'hare-shinkyu', '大口陽平')`, 'Insert default clinic');

  // Verify
  const { rows } = await client.query(`SELECT id, name FROM clinics WHERE id = '${CLINIC_ID}'`);
  console.log(`  Verified: ${rows.length > 0 ? rows[0].name : 'NOT FOUND'}`);

  await exec(`ALTER TABLE clinics ENABLE ROW LEVEL SECURITY`, 'RLS on clinics');
  await exec(`CREATE POLICY "clinics_select_policy" ON clinics FOR SELECT USING (true)`, 'Clinics select policy');
  await exec(`CREATE POLICY "clinics_all_policy" ON clinics FOR ALL USING (auth.role() = 'authenticated')`, 'Clinics all policy');

  // Step 1: Add clinic_id to cm_ tables
  console.log('\n--- Step 1: cm_ tables ---');
  const cmTables = [
    'cm_patients', 'cm_slips', 'cm_reservations', 'cm_base_menus', 'cm_option_menus',
    'cm_facility_info', 'cm_ad_costs', 'cm_ad_channels', 'cm_staff', 'cm_symptoms',
    'cm_visit_motives', 'cm_menu_categories', 'cm_occupations', 'cm_customer_categories',
    'cm_display_columns', 'cm_regular_holidays', 'cm_irregular_holidays'
  ];

  for (const table of cmTables) {
    await exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE`, `Add clinic_id to ${table}`);
    await exec(`UPDATE ${table} SET clinic_id = '${CLINIC_ID}' WHERE clinic_id IS NULL`, `Set default clinic on ${table}`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_${table}_clinic ON ${table}(clinic_id)`, `Index on ${table}.clinic_id`);
  }

  // Step 2: rv_ tables
  console.log('\n--- Step 2: rv_ tables ---');
  const rvTables = ['rv_reservations', 'rv_menus', 'rv_settings'];
  for (const table of rvTables) {
    await exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE`, `Add clinic_id to ${table}`);
    await exec(`UPDATE ${table} SET clinic_id = '${CLINIC_ID}' WHERE clinic_id IS NULL`, `Set default clinic on ${table}`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_${table}_clinic ON ${table}(clinic_id)`, `Index on ${table}.clinic_id`);
  }

  // Add patient_id to rv_reservations
  await exec(`ALTER TABLE rv_reservations ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES cm_patients(id) ON DELETE SET NULL`, 'Add patient_id to rv_reservations');
  await exec(`CREATE INDEX IF NOT EXISTS idx_rv_reservations_patient ON rv_reservations(patient_id)`, 'Index on rv_reservations.patient_id');

  // Step 3: ms_ tables
  console.log('\n--- Step 3: ms_ tables ---');
  await exec(`ALTER TABLE ms_submissions ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE`, 'Add clinic_id to ms_submissions');
  await exec(`UPDATE ms_submissions SET clinic_id = '${CLINIC_ID}' WHERE clinic_id IS NULL`, 'Set default clinic on ms_submissions');
  await exec(`CREATE INDEX IF NOT EXISTS idx_ms_submissions_clinic ON ms_submissions(clinic_id)`, 'Index on ms_submissions.clinic_id');
  await exec(`ALTER TABLE ms_submissions ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES cm_patients(id) ON DELETE SET NULL`, 'Add patient_id to ms_submissions');
  await exec(`CREATE INDEX IF NOT EXISTS idx_ms_submissions_patient ON ms_submissions(patient_id)`, 'Index on ms_submissions.patient_id');

  // Step 4: clinic_members table
  console.log('\n--- Step 4: clinic_members ---');
  await exec(`CREATE TABLE IF NOT EXISTS clinic_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'staff')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, user_id)
  )`, 'Create clinic_members');
  await exec(`ALTER TABLE clinic_members ENABLE ROW LEVEL SECURITY`, 'RLS on clinic_members');
  await exec(`CREATE POLICY "clinic_members_all" ON clinic_members FOR ALL USING (auth.role() = 'authenticated')`, 'Policy on clinic_members');

  console.log('\n--- Done ---');
  await client.end();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
