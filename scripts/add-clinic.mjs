#!/usr/bin/env node
// クリニックコア 新規院セットアップスクリプト
// 使い方: node scripts/add-clinic.mjs "院名" "メールアドレス" ["パスワード(省略可)"]
// 例:    node scripts/add-clinic.mjs "○○整体院" "example@gmail.com"
//
// 実行内容:
//   1. auth.users にユーザー作成（email_confirmed_at = NOW()）
//   2. clinics テーブルに院情報INSERT（plan='basic' 固定）
//   3. clinic_members に owner ロールで紐付け
//   4. ログイン情報を表示

import pg from 'pg'
import crypto from 'crypto'

const { Client } = pg
const DB_URL = 'postgresql://postgres:fJZj8SDawfJze7H9@db.vzkfkazjylrkspqrnhnx.supabase.co:5432/postgres'

const [clinicName, email, passwordArg] = process.argv.slice(2)
if (!clinicName || !email) {
  console.error('使い方: node scripts/add-clinic.mjs "院名" "メール" ["パスワード"]')
  process.exit(1)
}

// パスワードが省略されたらランダム生成（12文字英数字）
function genPassword() {
  return 'Cc' + crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)
}
const password = passwordArg || genPassword()

// 院コード（英数字・半角スペース区切り）を院名から生成
function genCode(name) {
  return 'clinic-' + crypto.randomBytes(4).toString('hex')
}
const code = genCode(clinicName)

// Supabase auth.users のパスワードハッシュ形式: crypt(password, gen_salt('bf'))
// PostgreSQL の pgcrypto 拡張を使う

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()

  console.log(`\n=== クリニックコア 新規院セットアップ ===`)
  console.log(`院名     : ${clinicName}`)
  console.log(`メール   : ${email}`)
  console.log(`パスワード: ${password}`)
  console.log(`コード   : ${code}\n`)

  // 全院件数スナップショット（他院の影響検証用）
  const before = await c.query(`SELECT COUNT(*)::int AS n FROM clinics`)
  const beforeCount = before.rows[0].n

  // 重複チェック
  const existingEmail = await c.query(`SELECT id FROM auth.users WHERE email = $1`, [email])
  if (existingEmail.rows.length > 0) {
    console.error(`❌ このメールアドレスは既に登録されています: ${email}`)
    await c.end()
    process.exit(1)
  }

  await c.query('BEGIN')
  try {
    // 1. auth.users にユーザー作成（pgcryptoでハッシュ化）
    const userResult = await c.query(`
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated', 'authenticated',
        $1,
        crypt($2, gen_salt('bf')),
        NOW(), NOW(), NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        false
      )
      RETURNING id
    `, [email, password])
    const userId = userResult.rows[0].id

    // 2. clinics テーブルにINSERT
    const clinicResult = await c.query(`
      INSERT INTO clinics (id, name, code, plan, is_active, email, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, 'basic', true, $3, NOW(), NOW())
      RETURNING id
    `, [clinicName, code, email])
    const clinicId = clinicResult.rows[0].id

    // 3. clinic_members に紐付け
    await c.query(`
      INSERT INTO clinic_members (id, clinic_id, user_id, role, created_at)
      VALUES (gen_random_uuid(), $1, $2, 'owner', NOW())
    `, [clinicId, userId])

    // 他院件数が増えた分（+1）だけかチェック
    const after = await c.query(`SELECT COUNT(*)::int AS n FROM clinics`)
    if (after.rows[0].n !== beforeCount + 1) {
      console.error(`❌ 予期せぬclinics件数変化: ${beforeCount} → ${after.rows[0].n}`)
      await c.query('ROLLBACK')
      process.exit(1)
    }

    await c.query('COMMIT')

    console.log(`✅ 作成完了`)
    console.log(`  clinic_id: ${clinicId}`)
    console.log(`  user_id  : ${userId}\n`)
    console.log(`--- 納品文面 ---`)
    console.log(`【クリニックコア ログイン情報】`)
    console.log(`URL      : https://customer-mgmt.vercel.app/login`)
    console.log(`メール    : ${email}`)
    console.log(`パスワード : ${password}`)
    console.log(``)
    console.log(`※ログイン後、設定画面からメール・パスワードの変更が可能です。`)
  } catch (e) {
    await c.query('ROLLBACK')
    console.error('❌ エラーでROLLBACK:', e.message)
    throw e
  }
  await c.end()
}

main().catch(e => { console.error(e); process.exit(1) })
