// 칼럼 마스터(시험품목/항목) 일회성 임포트 스크립트
//   1) 마스터 xlsx 파싱 (2행 헤더, 모델명·Cat.No forward-fill)
//   2) DB column_models 와 cat_no(소문자) 매칭
//   3) 미매칭 cat_no 는 column_models 에 is_draft=true 로 신규 등록
//   4) column_test_mappings 에 전체 매핑 insert (idempotent: source 로 사전 삭제)
//
// 실행: node scripts/import_test_mappings.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// .env.local 수동 로드
const envRaw = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
const env = {};
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const SOURCE = 'master_import_2026';
const MASTER_PATH = 'C:\\Users\\user\\Desktop\\칼럼마스터_시험품목.xlsx';

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function norm(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

async function main() {
  // ── 1) xlsx 파싱 ──
  const wb = XLSX.read(fs.readFileSync(MASTER_PATH), { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // 2번째 행(index 1)이 실제 헤더 → range 로 지정
  const rows = XLSX.utils.sheet_to_json(ws, { range: 1, defval: null });

  // forward-fill 모델명 / Cat. No / 기본정보 (병합셀 대응)
  const FILL_COLS = ['모델명', 'Cat. No', 'KEP 코드', '내경', '길이', '입자크기 (µm)',
                     '단가 (원)', '최소 안전재고'];
  let last = {};
  const parsed = [];
  for (const r of rows) {
    const row = { ...r };
    for (const c of FILL_COLS) {
      if (norm(row[c]) === '') row[c] = last[c] ?? null;
      else last[c] = row[c];
    }
    // 품목이 있어야 유효 매핑
    if (norm(row['시험품목']) === '' && norm(row['시험항목']) === '') continue;
    parsed.push(row);
  }
  console.log(`파싱된 매핑 행: ${parsed.length}`);

  // ── 2) column_models 조회 → cat_no(소문자) → id 맵 ──
  const { data: cols, error: colErr } = await sb
    .from('column_models')
    .select('id, cat_no, model_name');
  if (colErr) throw colErr;
  const catToId = new Map();
  for (const c of cols) catToId.set(norm(c.cat_no).toLowerCase(), c.id);
  console.log(`기존 column_models: ${cols.length}`);

  // ── 3) 미매칭 cat_no → 신규 칼럼 등록 ──
  const unmatched = new Map(); // cat_no(lower) → 대표 row
  for (const r of parsed) {
    const cat = norm(r['Cat. No']);
    if (!cat) continue;
    const key = cat.toLowerCase();
    if (!catToId.has(key) && !unmatched.has(key)) unmatched.set(key, r);
  }
  console.log(`미매칭 cat_no(신규 등록 대상): ${unmatched.size}`);

  for (const [key, r] of unmatched) {
    const inner = norm(r['내경']);
    const length = norm(r['길이']);
    const size = inner && length ? `${inner} × ${length}` : (inner || length || null);
    const ps = norm(r['입자크기 (µm)']);
    const price = norm(r['단가 (원)']).replace(/[^0-9]/g, '');
    const minStock = norm(r['최소 안전재고']).replace(/[^0-9]/g, '');
    const insert = {
      model_name: norm(r['모델명']) || `(미상) ${norm(r['Cat. No'])}`,
      cat_no: norm(r['Cat. No']),
      size,
      particle_size: ps && !isNaN(Number(ps)) ? Number(ps) : null,
      kep_code: norm(r['KEP 코드']) || null,
      unit_price: price ? parseInt(price, 10) : 0,
      min_safety_stock: minStock ? parseInt(minStock, 10) : 2,
      total_stock: 0,
      is_draft: true,
      notes: '마스터 임포트 신규',
    };
    const { data: newCol, error: insErr } = await sb
      .from('column_models').insert(insert).select('id').single();
    if (insErr) throw insErr;
    catToId.set(key, newCol.id);
    console.log(`  + 신규 칼럼: ${insert.model_name} (${insert.cat_no})`);
  }

  // ── 4) column_test_mappings idempotent 재삽입 ──
  const { error: delErr } = await sb
    .from('column_test_mappings').delete().eq('source', SOURCE);
  if (delErr) throw delErr;

  const mappings = parsed.map(r => {
    const cat = norm(r['Cat. No']);
    return {
      model_id: catToId.get(cat.toLowerCase()) ?? null,
      cat_no: cat || null,
      product_name: norm(r['시험품목']) || '(미상)',
      test_item: norm(r['시험항목']) || null,
      source: SOURCE,
    };
  });

  // 배치 insert (100개씩)
  let inserted = 0;
  for (let i = 0; i < mappings.length; i += 100) {
    const batch = mappings.slice(i, i + 100);
    const { error } = await sb.from('column_test_mappings').insert(batch);
    if (error) throw error;
    inserted += batch.length;
  }
  console.log(`\n✅ 완료: 매핑 ${inserted}건 삽입, 신규 칼럼 ${unmatched.size}개 등록`);

  // 검증 출력
  const { count } = await sb
    .from('column_test_mappings')
    .select('*', { count: 'exact', head: true })
    .eq('source', SOURCE);
  console.log(`검증: column_test_mappings source=${SOURCE} 행 수 = ${count}`);
  const nullModel = mappings.filter(m => !m.model_id).length;
  console.log(`model_id 연결 안 된 행: ${nullModel}`);
}

main().catch(e => { console.error('임포트 실패:', e); process.exit(1); });
