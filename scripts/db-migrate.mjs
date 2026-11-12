// 앱 시작 전에 실행: axhub DB 에 테이블 구조를 맞춘다 (여러 번 실행해도 안전).
//
// Supabase → axhub 데이터 이전은 2026-11-04 에 끝났다 (Supabase 프로젝트는 정지됨).
// 그래서 더 이상 Supabase 에서 데이터를 복사하지 않는다.
//
// 안전장치: 앱이 실제로 쓰는 DB(DATABASE_URL)에 칼럼 데이터가 하나도 없으면
// 빈 화면이 나가지 않도록 시작을 멈춘다 (실패하면 이전 배포가 그대로 운영된다).
// 정말로 빈 DB 로 시작해야 할 때만 환경변수 ALLOW_EMPTY_DB=1 을 넣는다.
// 단, 스테이징(검토용) 환경은 운영과 다른 빈 DB 를 쓰므로 비어 있어도 시작한다.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCK_KEY = 7321904;
const log = (...a) => console.log('[db-migrate]', ...a);

async function describe(client, label) {
  const { rows } = await client.query(
    `SELECT current_database() AS db, current_schema() AS schema,
            to_regclass('column_models') IS NOT NULL AS has_table`
  );
  const r = rows[0];
  let models = null;
  if (r.has_table) {
    const c = await client.query('SELECT count(*)::int AS n FROM column_models');
    models = c.rows[0].n;
  }
  log(`${label}: db=${r.db} schema=${r.schema} 칼럼 모델=${models ?? '테이블 없음'}`);
  return models;
}

async function main() {
  const appUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_DATABASE_URL || appUrl;
  if (!appUrl) throw new Error('DATABASE_URL 이 없습니다. axhub.yaml 의 database 설정을 확인하세요.');

  // 1) 스키마 맞추기 (직접 연결 사용)
  const direct = new pg.Client({ connectionString: directUrl });
  await direct.connect();
  try {
    await direct.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await describe(direct, '직접 연결');
    const schema = readFileSync(path.join(__dirname, 'db-schema.sql'), 'utf8');
    await direct.query(schema);
    log('스키마 확인 완료');
  } finally {
    await direct.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    await direct.end();
  }

  // 2) 앱이 실제로 쓰는 연결에 데이터가 있는지 확인
  const app = new pg.Client({ connectionString: appUrl });
  await app.connect();
  try {
    const models = await describe(app, '앱 연결');
    const { rows } = await app.query('SELECT current_database() AS db');
    const isStaging = /_staging$/.test(rows[0].db);
    if (!models && isStaging) {
      log('스테이징(검토용) DB 라 비어 있어도 시작함 — 운영 데이터와는 따로예요');
    } else if (!models && process.env.ALLOW_EMPTY_DB !== '1') {
      throw new Error('앱이 연결한 DB 에 칼럼 데이터가 없습니다. 다른 DB 에 연결됐을 수 있어 시작을 멈춥니다.');
    }
  } finally {
    await app.end();
  }
}

main().catch((e) => {
  console.error('[db-migrate] 실패:', e?.message ?? e);
  process.exit(1);
});
