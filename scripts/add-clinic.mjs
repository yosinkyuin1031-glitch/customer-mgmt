#!/usr/bin/env node
// クリニックコア 新規院セットアップスクリプト（決済優先フロー）
// 使い方: node scripts/add-clinic.mjs "院名" "メールアドレス" [アプリID...]
// 例:    node scripts/add-clinic.mjs "○○整体院" "example@gmail.com" customer
//        node scripts/add-clinic.mjs "山田はり灸院" "yamada@example.com" kensa customer
//
// 管理費用の登録:
//        node scripts/add-clinic.mjs "院名" "メール" maintenance 3980
//        → アプリ販売ではなく受託管理費として登録（active状態）
//
// アプリID: kensa, customer, maintenance
// 省略時は customer（顧客管理）のみ
//
// 実行内容:
//   1. clinic_accounts に登録（アプリ→pending_payment / 管理費→active）
//   2. Stripe Payment Linkを表示（アプリの場合）
//   ※ 決済完了後、Webhookが自動でアカウント発行・メール送信を行います

import pg from 'pg'
import crypto from 'crypto'

const { Client } = pg
const DB_URL = 'postgresql://postgres.vzkfkazjylrkspqrnhnx:fJZj8SDawfJze7H9@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres'

// アプリ設定（販売中のみ）
const APP_CONFIG = {
  kensa:       { label: 'カラダマップ',     monthlyPrice: 3980 },
  customer:    { label: '顧客管理（Clinic Core）', monthlyPrice: 5500 },
}

// Stripe Payment Links（月額のみ）
const PAYMENT_LINKS = {
  kensa:       'https://buy.stripe.com/bJecN4108blm8jOdhf08g04',
  customer:    'https://buy.stripe.com/5kQbJ0dMUexydE8a5308g07',
}

// ログインURL
const LOGIN_URLS = {
  kensa:       'https://kensa-sheet-app.vercel.app',
  customer:    'https://customer-mgmt.vercel.app/login',
}

const args = process.argv.slice(2)
const clinicName = args[0]
const email = args[1]

// 管理費モードの判定
const isMaintenanceMode = args[2] === 'maintenance'
const maintenanceAmount = isMaintenanceMode ? parseInt(args[3] || '3980') : 0
const selectedApps = isMaintenanceMode ? ['maintenance'] : (args.slice(2).length > 0 ? args.slice(2) : ['customer'])

if (!clinicName || !email) {
  console.error('使い方: node scripts/add-clinic.mjs "院名" "メール" [アプリID...]')
  console.error('')
  console.error('アプリ販売:')
  console.error('  アプリID: kensa, customer')
  console.error('  例: node scripts/add-clinic.mjs "○○整体院" "example@gmail.com" customer kensa')
  console.error('')
  console.error('管理費用（受託アプリ等）:')
  console.error('  node scripts/add-clinic.mjs "院名" "メール" maintenance [金額]')
  console.error('  例: node scripts/add-clinic.mjs "C-cure" "shimizu@example.com" maintenance 3980')
  process.exit(1)
}

// 無効なアプリIDチェック（管理費モード以外）
if (!isMaintenanceMode) {
  for (const app of selectedApps) {
    if (!APP_CONFIG[app]) {
      console.error(`❌ 無効なアプリID: ${app}`)
      console.error(`有効なID: ${Object.keys(APP_CONFIG).join(', ')}, maintenance`)
      process.exit(1)
    }
  }
}

function generateClinicId() {
  return 'CLN-' + crypto.randomBytes(4).toString('hex').toUpperCase()
}

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()

  if (isMaintenanceMode) {
    console.log(`\n=== 管理費用の登録 ===`)
    console.log(`院名       : ${clinicName}`)
    console.log(`メール     : ${email}`)
    console.log(`月額管理費 : ¥${maintenanceAmount.toLocaleString()}\n`)
  } else {
    const appLabels = selectedApps.map(id => APP_CONFIG[id].label).join('、')
    const monthlyTotal = selectedApps.reduce((sum, id) => sum + APP_CONFIG[id].monthlyPrice, 0)
    console.log(`\n=== 新規院セットアップ（決済優先フロー） ===`)
    console.log(`院名       : ${clinicName}`)
    console.log(`メール     : ${email}`)
    console.log(`選択アプリ : ${appLabels}`)
    console.log(`月額合計   : ¥${monthlyTotal.toLocaleString()}\n`)
  }

  // 重複チェック（clinic_accounts）- 管理費は空メール許可
  if (email && email !== '-') {
    const existing = await c.query(
      `SELECT id, status FROM clinic_accounts WHERE email = $1`,
      [email]
    )
    if (existing.rows.length > 0) {
      const row = existing.rows[0]
      if (row.status === 'cancelled') {
        console.error(`❌ このメールアドレスは過去に解約済みです。再登録はできません。`)
      } else {
        console.error(`❌ このメールアドレスは既に登録されています（ステータス: ${row.status}）`)
      }
      await c.end()
      process.exit(1)
    }
  }

  // clinic_id生成（衝突回避）
  let clinicId = generateClinicId()
  let retries = 0
  while (retries < 5) {
    const dup = await c.query(`SELECT id FROM clinic_accounts WHERE clinic_id = $1`, [clinicId])
    if (dup.rows.length === 0) break
    clinicId = generateClinicId()
    retries++
  }

  if (isMaintenanceMode) {
    // 管理費: activeで即登録
    await c.query(`
      INSERT INTO clinic_accounts (
        clinic_id, clinic_name, email, plan_type, selected_apps, status, metadata, created_at
      ) VALUES (
        $1, $2, $3, 'monthly', $4::jsonb, 'active',
        $5::jsonb, NOW()
      )
    `, [
      clinicId,
      clinicName,
      email || '',
      JSON.stringify(selectedApps),
      JSON.stringify({
        created_by: 'add-clinic-script',
        monthly_override: maintenanceAmount,
        note: `受託アプリ管理費 ¥${maintenanceAmount.toLocaleString()}/月`,
      })
    ])

    console.log(`✅ 管理費用として登録完了（active）`)
    console.log(`   clinic_id: ${clinicId}`)
    console.log(`   月額: ¥${maintenanceAmount.toLocaleString()}`)
    console.log(`\n管理画面に自動反映されます:`)
    console.log(`https://clinic-saas-lp.vercel.app/admin`)
  } else {
    // アプリ販売: pending_paymentで登録
    const monthlyTotal = selectedApps.reduce((sum, id) => sum + APP_CONFIG[id].monthlyPrice, 0)
    await c.query(`
      INSERT INTO clinic_accounts (
        clinic_id, clinic_name, email, plan_type, selected_apps, status, metadata, created_at
      ) VALUES (
        $1, $2, $3, 'monthly', $4::jsonb, 'pending_payment',
        $5::jsonb, NOW()
      )
    `, [
      clinicId,
      clinicName,
      email,
      JSON.stringify(selectedApps),
      JSON.stringify({
        created_by: 'add-clinic-script',
        monthly_total: monthlyTotal,
      })
    ])

    console.log(`✅ clinic_accounts に登録完了（pending_payment）`)
    console.log(`   clinic_id: ${clinicId}\n`)

    // Payment Link表示
    console.log(`--- 決済リンク ---`)
    if (selectedApps.length === 1 && PAYMENT_LINKS[selectedApps[0]]) {
      const link = PAYMENT_LINKS[selectedApps[0]]
      console.log(`\n${link}`)
      console.log(`\n↑ このリンクをお客さんに送ってください。`)
    } else {
      console.log(`\n複数アプリの場合、管理画面から決済リンクを発行してください:`)
      console.log(`https://clinic-saas-lp.vercel.app/admin`)
      console.log(`\n個別リンク:`)
      for (const app of selectedApps) {
        if (PAYMENT_LINKS[app]) {
          console.log(`  ${APP_CONFIG[app].label}: ${PAYMENT_LINKS[app]}`)
        }
      }
    }

    console.log(`\n--- 決済完了後に自動実行される処理 ---`)
    console.log(`  1. Supabase Authにユーザー作成`)
    console.log(`  2. clinics / clinic_members テーブルに登録`)
    console.log(`  3. clinic_accounts のステータスを active に更新`)
    console.log(`  4. お客さんにログイン情報メール自動送信`)
    console.log(`  5. 大口さんに決済通知メール自動送信`)

    console.log(`\n--- お客さんに送るメッセージ例 ---`)
    console.log(`---`)
    console.log(`${clinicName}様\n`)
    console.log(`アプリのご利用ありがとうございます。`)
    console.log(`以下のリンクから月額のお支払い手続きをお願いいたします。\n`)
    if (selectedApps.length === 1 && PAYMENT_LINKS[selectedApps[0]]) {
      console.log(`${PAYMENT_LINKS[selectedApps[0]]}\n`)
    }
    console.log(`お支払い完了後、ログイン情報をメールでお送りします。`)
    console.log(`ご不明な点がございましたらお気軽にご連絡ください。`)
    console.log(`---`)
  }

  await c.end()
}

main().catch(e => { console.error(e); process.exit(1) })
