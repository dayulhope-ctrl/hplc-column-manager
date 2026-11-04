import { Pool, types } from 'pg';
import { PgRestClient } from './pgrest';

// axhub DB(PostgreSQL) 연결.
// 이전에는 Supabase 를 썼지만, 기존 API 라우트 코드를 그대로 쓰기 위해 함수 이름(createServerClient)과
// 사용법(sb.from(...).select(...))은 유지하고 내부만 axhub DB 로 바꿨다.

// Supabase(PostgREST) 와 같은 모양으로 값을 돌려주도록 형 변환을 맞춘다.
//  - numeric/bigint → number
//  - date → 'YYYY-MM-DD' 문자열 그대로
//  - timestamptz → ISO 문자열 ('2026-05-19T05:03:06.480724+00:00')
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v))); // numeric
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10))); // int8
types.setTypeParser(1082, (v) => v); // date
const toIso = (v: string | null) =>
  v === null ? null : v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00');
types.setTypeParser(1184, toIso); // timestamptz
types.setTypeParser(1114, (v) => (v === null ? null : v.replace(' ', 'T'))); // timestamp

const globalForPg = globalThis as unknown as { __hplcPool?: Pool };

function getPool(): Pool {
  if (!globalForPg.__hplcPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL 이 설정되지 않았습니다');
    globalForPg.__hplcPool = new Pool({ connectionString, max: 5 });
  }
  return globalForPg.__hplcPool;
}

// 서버용 (API 라우트). 환경변수는 호출 시점(런타임)에 읽는다 — 빌드 단계에서는 DB 에 접속하지 않는다.
export function createServerClient() {
  return new PgRestClient((sql, params) => getPool().query(sql, params as any[]));
}
