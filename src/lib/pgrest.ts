// Supabase(PostgREST) 쿼리 빌더와 같은 사용법을 PostgreSQL 위에서 그대로 제공하는 얇은 호환 계층.
// 기존 API 라우트의 sb.from(...).select(...).eq(...) 코드를 고치지 않고 axhub DB 로 옮기기 위해 만들었다.
// 이 앱이 실제로 쓰는 기능만 지원한다: select/insert/update/delete, eq·neq·gt·gte·lt·lte·like·ilike·in·is·not·or·match·contains·filter,
// order·limit·range·single·maybeSingle, count, 외래키 1단계 임베드(column_models(...)), rpc.

export type Executor = (sql: string, params: unknown[]) => Promise<{ rows: any[] }>;

export interface PgError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

export interface PgResult<R = any> {
  data: R | null;
  error: PgError | null;
  count?: number | null;
  status?: number;
}

// 테이블 → (임베드 대상 테이블 → 외래키 컬럼)
const FOREIGN_KEYS: Record<string, Record<string, string>> = {
  purchase_requests: { column_models: 'column_model_id' },
  receiving_records: { column_models: 'column_model_id', purchase_requests: 'purchase_request_id' },
  individual_columns: { column_models: 'model_id' },
  column_test_mappings: { column_models: 'model_id' },
};

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function ident(name: string): string {
  const n = name.trim();
  if (!IDENT.test(n)) throw new Error(`허용되지 않는 식별자: ${name}`);
  return `"${n}"`;
}

function toParam(v: unknown): unknown {
  if (v === undefined) return null;
  if (v !== null && typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
  return v;
}

// 최상위 콤마로 나누기 (괄호 안 콤마는 무시)
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

function columnList(cols: string, alias: string): string {
  const items = splitTop(cols || '*');
  return items
    .map((it) => (it === '*' ? `${alias}.*` : `${alias}.${ident(it)}`))
    .join(', ');
}

type Op = 'select' | 'insert' | 'update' | 'delete';

// R: 여러 행이면 any[], single()/maybeSingle() 이면 any (Supabase 의 타입과 같게)
class QueryBuilder<R = any[]> implements PromiseLike<PgResult<R>> {
  private op: Op | null = null;
  private columns = '*';
  private countMode: string | null = null;
  private head = false;
  private returning: string | null = null;
  private payload: any = null;
  private where: string[] = [];
  private params: unknown[] = [];
  private orders: string[] = [];
  private limitN: number | null = null;
  private offsetN: number | null = null;
  private singleMode: 'single' | 'maybe' | null = null;
  private deferredError: Error | null = null;

  // Supabase 처럼 체이닝 중 오류를 던지지 않고, 실행 시 error 로 돌려준다
  private guard(fn: () => void) {
    if (this.deferredError) return this;
    try { fn(); } catch (e: any) { this.deferredError = e; }
    return this;
  }

  constructor(private exec: Executor, private table: string) {
    ident(table);
  }

  private p(v: unknown): string {
    this.params.push(toParam(v));
    return `$${this.params.length}`;
  }

  // ---------- 동작 ----------
  select(cols = '*', opts?: { count?: string; head?: boolean }) {
    if (this.op === null) {
      this.op = 'select';
      this.columns = cols;
      if (opts?.count) this.countMode = opts.count;
      if (opts?.head) this.head = true;
    } else {
      this.returning = cols || '*';
    }
    return this;
  }
  insert(values: any) {
    this.op = 'insert';
    this.payload = values;
    return this;
  }
  upsert(values: any) {
    // 이 앱은 upsert 를 쓰지 않는다. 혹시 쓰이면 insert 로 처리한다.
    return this.insert(values);
  }
  update(values: any) {
    this.op = 'update';
    this.payload = values;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }

  // ---------- 필터 ----------
  private cmp(col: string, sqlOp: string, v: unknown) {
    if (v === null && (sqlOp === '=' || sqlOp === '<>')) {
      this.where.push(`${ident(col)} IS ${sqlOp === '=' ? '' : 'NOT '}NULL`);
    } else {
      this.where.push(`${ident(col)} ${sqlOp} ${this.p(v)}`);
    }
    return this;
  }
  eq(col: string, v: unknown) { return this.guard(() => this.cmp(col, '=', v)); }
  neq(col: string, v: unknown) { return this.guard(() => this.cmp(col, '<>', v)); }
  gt(col: string, v: unknown) { return this.guard(() => this.cmp(col, '>', v)); }
  gte(col: string, v: unknown) { return this.guard(() => this.cmp(col, '>=', v)); }
  lt(col: string, v: unknown) { return this.guard(() => this.cmp(col, '<', v)); }
  lte(col: string, v: unknown) { return this.guard(() => this.cmp(col, '<=', v)); }
  like(col: string, v: string) { return this.guard(() => this.cmp(col, 'LIKE', v)); }
  ilike(col: string, v: string) { return this.guard(() => this.cmp(col, 'ILIKE', v)); }
  in(col: string, values: unknown[]) {
    return this.guard(() => {
      const c = ident(col);
      if (!values || values.length === 0) {
        this.where.push('FALSE');
        return;
      }
      this.params.push(values.map((x) => (x === undefined ? null : x)));
      this.where.push(`${c} = ANY($${this.params.length})`);
    });
  }
  is(col: string, v: null | boolean) {
    return this.guard(() => {
      const lit = v === null ? 'NULL' : v ? 'TRUE' : 'FALSE';
      this.where.push(`${ident(col)} IS ${lit}`);
    });
  }
  not(col: string, op: string, v: unknown) {
    return this.guard(() => {
      this.where.push(`NOT (${this.condition(col, op, v)})`);
    });
  }
  match(obj: Record<string, unknown>) {
    for (const [k, v] of Object.entries(obj)) this.eq(k, v);
    return this;
  }
  contains(col: string, v: unknown) {
    return this.guard(() => {
      const c = ident(col);
      this.where.push(`${c} @> ${this.p(v)}::jsonb`);
    });
  }
  filter(col: string, op: string, v: unknown) {
    return this.guard(() => {
      this.where.push(this.condition(col, op, v));
    });
  }
  or(expr: string) {
    // 예: "model_name.ilike.%abc%,cat_no.eq.X"
    return this.guard(() => {
      const parts = splitTop(expr).map((part) => {
        const i1 = part.indexOf('.');
        const i2 = part.indexOf('.', i1 + 1);
        if (i1 < 0 || i2 < 0) throw new Error(`or 조건 형식 오류: ${part}`);
        const col = part.slice(0, i1);
        const op = part.slice(i1 + 1, i2);
        let val: unknown = part.slice(i2 + 1);
        if (op === 'is') val = val === 'null' ? null : val === 'true';
        if (op === 'in') {
          val = String(val).replace(/^\(|\)$/g, '').split(',').map((s) => s.trim());
        }
        // PostgREST 는 like 패턴의 * 를 % 로 취급한다
        if ((op === 'like' || op === 'ilike') && typeof val === 'string') val = val.replace(/\*/g, '%');
        return this.condition(col, op, val);
      });
      if (parts.length) this.where.push(`(${parts.join(' OR ')})`);
    });
  }

  private condition(col: string, op: string, v: unknown): string {
    const c = ident(col);
    switch (op) {
      case 'eq': return v === null ? `${c} IS NULL` : `${c} = ${this.p(v)}`;
      case 'neq': return v === null ? `${c} IS NOT NULL` : `${c} <> ${this.p(v)}`;
      case 'gt': return `${c} > ${this.p(v)}`;
      case 'gte': return `${c} >= ${this.p(v)}`;
      case 'lt': return `${c} < ${this.p(v)}`;
      case 'lte': return `${c} <= ${this.p(v)}`;
      case 'like': return `${c} LIKE ${this.p(v)}`;
      case 'ilike': return `${c} ILIKE ${this.p(v)}`;
      case 'is': {
        const lit = v === null || v === 'null' ? 'NULL' : v === true || v === 'true' ? 'TRUE' : 'FALSE';
        return `${c} IS ${lit}`;
      }
      case 'in': {
        const arr = Array.isArray(v) ? v : String(v).replace(/^\(|\)$/g, '').split(',');
        if (arr.length === 0) return 'FALSE';
        this.params.push(arr);
        return `${c} = ANY($${this.params.length})`;
      }
      case 'cs': return `${c} @> ${this.p(v)}::jsonb`;
      default: throw new Error(`지원하지 않는 필터 연산자: ${op}`);
    }
  }

  // ---------- 정렬·범위 ----------
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    return this.guard(() => {
      const asc = opts?.ascending !== false;
      let o = `${ident(col)} ${asc ? 'ASC' : 'DESC'}`;
      if (opts?.nullsFirst !== undefined) o += opts.nullsFirst ? ' NULLS FIRST' : ' NULLS LAST';
      this.orders.push(o);
    });
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  range(from: number, to: number) {
    this.offsetN = from;
    this.limitN = to - from + 1;
    return this;
  }
  single(): QueryBuilder<any> {
    this.singleMode = 'single';
    return this as unknown as QueryBuilder<any>;
  }
  maybeSingle(): QueryBuilder<any> {
    this.singleMode = 'maybe';
    return this as unknown as QueryBuilder<any>;
  }

  // ---------- SQL 생성 ----------
  private selectList(cols: string, alias: string): string {
    const items = splitTop(cols || '*');
    const parts: string[] = [];
    for (const it of items) {
      const m = it.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([\s\S]*)\)$/);
      if (m) {
        const rel = m[1];
        const fk = FOREIGN_KEYS[this.table]?.[rel];
        if (!fk) throw new Error(`${this.table} → ${rel} 관계를 찾을 수 없습니다`);
        const inner = columnList(m[2], 'r0');
        parts.push(
          `(SELECT row_to_json(r) FROM (SELECT ${inner} FROM ${ident(rel)} r0 WHERE r0."id" = ${alias}.${ident(fk)}) r) AS ${ident(rel)}`
        );
      } else if (it === '*') {
        parts.push(`${alias}.*`);
      } else {
        parts.push(`${alias}.${ident(it)}`);
      }
    }
    return parts.join(', ');
  }

  private whereSql(): string {
    return this.where.length ? ` WHERE ${this.where.join(' AND ')}` : '';
  }

  private tailSql(): string {
    let s = '';
    if (this.orders.length) s += ` ORDER BY ${this.orders.join(', ')}`;
    if (this.limitN !== null) s += ` LIMIT ${Math.max(0, Math.floor(this.limitN))}`;
    if (this.offsetN !== null) s += ` OFFSET ${Math.max(0, Math.floor(this.offsetN))}`;
    return s;
  }

  build(): { sql: string; params: unknown[]; countSql?: string } {
    const t = ident(this.table);
    switch (this.op ?? 'select') {
      case 'select': {
        const w = this.whereSql();
        const countSql = this.countMode ? `SELECT count(*)::int AS count FROM ${t} t${w}` : undefined;
        const sql = `SELECT ${this.selectList(this.columns, 't')} FROM ${t} t${w}${this.tailSql()}`;
        return { sql, params: this.params, countSql };
      }
      case 'insert': {
        const rows: any[] = Array.isArray(this.payload) ? this.payload : [this.payload];
        if (rows.length === 0) return { sql: 'SELECT 1 WHERE FALSE', params: [] };
        const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r ?? {}))));
        const values = rows
          .map((r) => `(${cols.map((c) => (r[c] === undefined ? 'DEFAULT' : this.p(r[c]))).join(', ')})`)
          .join(', ');
        const ins = cols.length
          ? `INSERT INTO ${t} (${cols.map(ident).join(', ')}) VALUES ${values} RETURNING *`
          : `INSERT INTO ${t} DEFAULT VALUES RETURNING *`;
        return { sql: this.wrapReturning(ins), params: this.params };
      }
      case 'update': {
        const entries = Object.entries(this.payload ?? {}).filter(([, v]) => v !== undefined);
        if (entries.length === 0) throw new Error('수정할 값이 없습니다');
        const sets = entries.map(([k, v]) => `${ident(k)} = ${this.p(v)}`).join(', ');
        const upd = `UPDATE ${t} SET ${sets}${this.whereSql()} RETURNING *`;
        return { sql: this.wrapReturning(upd), params: this.params };
      }
      case 'delete': {
        const del = `DELETE FROM ${t}${this.whereSql()} RETURNING *`;
        return { sql: this.wrapReturning(del), params: this.params };
      }
    }
  }

  private wrapReturning(stmt: string): string {
    const cols = this.returning ?? '*';
    return `WITH m AS (${stmt}) SELECT ${this.selectList(cols, 't')} FROM m t${this.tailSql()}`;
  }

  // ---------- 실행 ----------
  async execute(): Promise<PgResult<R>> {
    try {
      if (this.deferredError) throw this.deferredError;
      const { sql, params, countSql } = this.build();
      let count: number | null = null;
      if (countSql) {
        const c = await this.exec(countSql, params);
        count = c.rows[0]?.count ?? 0;
        if (this.head) return { data: null, error: null, count, status: 200 };
      }
      const { rows } = await this.exec(sql, params);
      const isMutation = this.op !== null && this.op !== 'select';
      if (isMutation && this.returning === null && !this.singleMode) {
        return { data: null, error: null, count, status: 204 };
      }
      if (this.singleMode) {
        if (rows.length === 1) return { data: rows[0], error: null, count, status: 200 };
        if (rows.length === 0 && this.singleMode === 'maybe') return { data: null, error: null, count, status: 200 };
        return {
          data: null,
          error: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
            details: `The result contains ${rows.length} rows`,
            hint: null,
          },
          count,
          status: 406,
        };
      }
      return { data: rows as unknown as R, error: null, count, status: 200 };
    } catch (e: any) {
      return {
        data: null,
        error: { message: e?.message ?? String(e), code: e?.code, details: e?.detail ?? null, hint: e?.hint ?? null },
        count: null,
        status: 400,
      };
    }
  }

  then<T1 = PgResult<R>, T2 = never>(
    onfulfilled?: ((value: PgResult<R>) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export class PgRestClient {
  constructor(private exec: Executor) {}

  from(table: string) {
    return new QueryBuilder<any[]>(this.exec, table);
  }

  async rpc(fn: string, args: Record<string, unknown> = {}): Promise<PgResult> {
    try {
      const keys = Object.keys(args);
      const params = keys.map((k) => toParam(args[k]));
      const argSql = keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(', ');
      const { rows } = await this.exec(`SELECT ${ident(fn)}(${argSql}) AS result`, params);
      return { data: rows[0]?.result ?? null, error: null, status: 200 };
    } catch (e: any) {
      return {
        data: null,
        error: { message: e?.message ?? String(e), code: e?.code, details: e?.detail ?? null, hint: e?.hint ?? null },
        status: 400,
      };
    }
  }
}
