const { Client } = require("pg");
const fs = require("fs");
const sql = fs.readFileSync("supabase-migration-v2.sql", "utf8");
const client = new Client({ connectionString: "postgresql://postgres.vzkfkazjylrkspqrnhnx:fJZj8SDawfJze7H9@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres" });

async function run() {
  await client.connect();
  const lines = sql.split(";");
  for (const line of lines) {
    const stmt = line.trim();
    if (stmt.length < 10) continue;
    if (stmt.startsWith("--")) continue;
    try {
      await client.query(stmt);
      console.log("OK:", stmt.slice(0, 60));
    } catch (e) {
      console.log("ERR:", e.message, "|", stmt.slice(0, 60));
    }
  }
  await client.end();
}
run();
