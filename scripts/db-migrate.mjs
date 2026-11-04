// 앱 시작 전에 실행: axhub DB 에 테이블을 만들고, 처음 한 번은 Supabase 의 데이터를 복사한다.
//
// 동작
//  1) scripts/db-schema.sql 실행 (여러 번 실행해도 안전)
//  2) 아직 복사한 적이 없고 Supabase 접속 정보(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)가 있으면
//     Supabase 의 모든 테이블을 axhub DB 로 복사한다. 복사 후 행 수가 다르면 실패로 끝내 배포를 멈춘다
//     (실패하면 이전 배포가 그대로 운영되므로 빈 화면이 나가지 않는다).
//  3) 다시 복사(최종 전환용): 환경변수 RESYNC_FROM_SUPABASE 에 새 값(예: 날짜)을 넣으면,
//     그 값으로 아직 복사한 적이 없을 때 한 번만 axhub DB 를 비우고 Supabase 데이터로 다시 채운다.
//
// 복사 대상 데이터는 저장소에 남기지 않는다 — 실행 시점에 Supabase 에서 직접 읽는다.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 외래키 순서대로 (부모 먼저)
const TABLES = [
  'admins',
  'user_sessions',
  'column_models',
  'purchase_requests',
  'individual_columns',
  'receiving_records',
  'monthly_closings',
  'activity_logs',
  'column_test_mappings',
];

const LOCK_KEY = 7321904;
const log = (...a) => console.log('[db-migrate]', ...a);

function toParam(v) {
  if (v === undefined) return null;
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v;
}

async function fetchAll(sb, table) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Supabase ${table} 읽기 실패: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

async function insertRows(client, table, rows) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const chunk = 200;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const params = [];
    const values = part
      .map((r) => `(${cols.map((c) => { params.push(toParam(r[c])); return `$${params.length}`; }).join(', ')})`)
      .join(', ');
    await client.query(
      `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES ${values}`,
      params
    );
  }
}

async function copyFromSupabase(client, reason, markerKey, markerValue) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sb = createClient(url, key, { auth: { persistSession: false } });

  log(`Supabase 데이터 복사 시작 (${reason})`);
  const source = {};
  for (const t of TABLES) {
    source[t] = await fetchAll(sb, t);
    log(`  읽음 ${t}: ${source[t].length}행`);
  }

  await client.query('BEGIN');
  try {
    await client.query(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} CASCADE`);
    for (const t of TABLES) await insertRows(client, t, source[t]);

    for (const t of TABLES) {
      const { rows } = await client.query(`SELECT count(*)::int AS n FROM "${t}"`);
      if (rows[0].n !== source[t].length) {
        throw new Error(`${t} 행 수 불일치: Supabase ${source[t].length} / axhub ${rows[0].n}`);
      }
    }
    await client.query(
      `INSERT INTO _app_migrations (key, value, at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, at = now()`,
      [markerKey, markerValue]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
  const total = TABLES.reduce((s, t) => s + source[t].length, 0);
  log(`복사 완료: ${TABLES.length}개 테이블, 총 ${total}행 (행 수 일치 확인)`);
}

async function main() {
  const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL 이 없습니다. axhub.yaml 의 database 설정을 확인하세요.');
  }
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);

    const schema = readFileSync(path.join(__dirname, 'db-schema.sql'), 'utf8');
    await client.query(schema);
    log('스키마 확인 완료');

    const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { rows: marks } = await client.query('SELECT key, value FROM _app_migrations');
    const mark = Object.fromEntries(marks.map((m) => [m.key, m.value]));

    const resync = (process.env.RESYNC_FROM_SUPABASE || '').trim();
    if (!hasSupabase) {
      log('Supabase 접속 정보가 없어 데이터 복사는 건너뜀');
    } else if (!mark.supabase_copy) {
      await copyFromSupabase(client, '첫 복사', 'supabase_copy', new Date().toISOString());
      // 첫 복사 때 이미 RESYNC 값이 있으면, 다음 시작에서 또 복사하지 않도록 같이 기록
      if (resync) {
        await client.query(
          `INSERT INTO _app_migrations (key, value) VALUES ('supabase_resync', $1)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, at = now()`,
          [resync]
        );
      }
    } else if (resync && mark.supabase_resync !== resync) {
      await copyFromSupabase(client, `다시 복사: ${resync}`, 'supabase_resync', resync);
    } else {
      log('이미 복사됨 — 건너뜀');
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    await client.end();
  }
}

main().catch((e) => {
  console.error('[db-migrate] 실패:', e?.message ?? e);
  process.exit(1);
});
